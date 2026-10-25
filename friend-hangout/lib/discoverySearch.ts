import type { DatabaseSync } from 'node:sqlite';
import type { ActivityCategory } from '@/types';
import { classifyListing } from './activityClassify';
import type { ActivityPolicy } from './activityPolicy';
import {
  applyMuseEnrichment,
  applyRecheck,
  getActivityRow,
  listUnenrichedIds,
  markQueryRefreshed,
  upsertActivity,
} from './activityStore';
import { museComplete } from './museClient';
import { ENRICH_BATCH, enrichmentCacheKey, parseMuseEnrichments } from './museEnrich';
import { openSerpEngines, openSerpTimeoutMs } from './serviceTimeouts';

const CATEGORIES = new Set(['food', 'music', 'outdoors', 'gaming', 'sports', 'nightlife', 'arts', 'chill']);

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food & BBQ',
  music: 'Live Music',
  outdoors: 'Outdoors & Springs',
  gaming: 'Gaming & Arcades',
  sports: 'Sports & Active',
  nightlife: 'Nightlife & Drinks',
  arts: 'Arts & Culture',
  chill: 'Cafe & Social Chill',
};

export const DISCOVERY_CATEGORIES = ['all', ...CATEGORIES] as const;

type OpenSerpHit = {
  title?: string;
  url?: string;
  snippet?: string;
  domain?: string;
  engine?: string;
};

export type RefreshInput = {
  location: string;
  category: string;
  query: string;
  now?: Date;
  fetchImpl?: typeof fetch;
  policy?: ActivityPolicy;
  allowMuse?: boolean;
};

const inflight = new Map<string, Promise<void>>();

export function buildSearchText(location: string, category: string, query: string): string {
  return [location, category !== 'all' ? category : 'best things to do with friends venues activities', query]
    .filter(Boolean)
    .join(' ');
}

export function openSerpBaseUrl(raw = process.env.OPENSERP_URL): string {
  return (raw || 'http://127.0.0.1:7000').replace(/\/$/, '');
}

export async function refreshDiscoveryQuery(
  db: DatabaseSync,
  input: RefreshInput
): Promise<{ ok: boolean; ids: string[] }> {
  const now = input.now ?? new Date();
  const location = input.location.trim() || 'Austin, TX';
  const category = input.category.trim() || 'all';
  const query = input.query.trim();
  const searchText = buildSearchText(location, category, query);
  const hits = await fetchOpenSerp(searchText, input.fetchImpl);
  if (!hits) return { ok: false, ids: [] };

  const ids: string[] = [];
  for (const hit of hits) {
    const title = cleanTitle(hit.title || '');
    const url = hit.url || '';
    if (!title || !url || url.includes('google.com/search')) continue;
    const combined = `${title} ${hit.snippet || ''}`;
    const inferred = inferCategory(combined);
    const finalCategory = asCategory(category !== 'all' ? category : inferred.category);
    const classification = classifyListing({ title, snippet: hit.snippet || '', now });
    const saved = upsertActivity(db, {
      name: title,
      url,
      snippet: hit.snippet || `Discovered via OpenSERP on ${hit.domain || 'the web'}`,
      category: finalCategory,
      categoryLabel: category !== 'all' ? CATEGORY_LABELS[finalCategory] || inferred.label : inferred.label,
      location: `${location} (${hit.domain || 'Local venue'})`,
      neighborhood: hit.domain || 'Austin area',
      estimatedCostPerPerson: estimateCost(finalCategory),
      durationMinutes: 90,
      sourceQuery: searchText,
      engine: hit.engine,
      classification,
      now,
    });
    ids.push(saved.id);
  }

  markQueryRefreshed(db, { location, category, query, now });
  if (input.allowMuse) scheduleMuseClassification(db, ids, input.fetchImpl);
  return { ok: true, ids };
}

export function scheduleDiscoveryRefresh(db: DatabaseSync, input: RefreshInput): Promise<void> {
  const key = `${input.location}\n${input.category}\n${input.query}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const job = refreshDiscoveryQuery(db, { ...input, allowMuse: input.allowMuse !== false })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      if (inflight.get(key) === job) inflight.delete(key);
    });
  inflight.set(key, job);
  return job;
}

export function discoveryRefreshSettled(): Promise<void> {
  return Promise.all([...inflight.values()]).then(() => undefined);
}

export function scheduleMuseClassification(db: DatabaseSync, ids: string[], fetchImpl?: typeof fetch) {
  const key = process.env.MUSE_API_KEY?.trim();
  if (!key || ids.length === 0) return;
  const jobKey = `muse:${ids.slice().sort().join(',')}`;
  if (inflight.has(jobKey)) return;
  const job = classifyStoredWithMuse(db, ids, fetchImpl)
    .catch(() => undefined)
    .finally(() => {
      if (inflight.get(jobKey) === job) inflight.delete(jobKey);
    });
  inflight.set(jobKey, job);
}

export async function recheckPlace(
  db: DatabaseSync,
  placeId: string,
  input: { location?: string; now?: Date; fetchImpl?: typeof fetch }
): Promise<'kept' | 'removed' | 'skipped'> {
  const place = getActivityRow(db, placeId);
  if (!place || place.kind !== 'place') return 'skipped';
  const now = input.now ?? new Date();
  const text = `"${place.name}" ${input.location || 'Austin, TX'}`;
  const hits = await fetchOpenSerp(text, input.fetchImpl);
  if (!hits) return 'skipped';
  return applyRecheck(
    db,
    placeId,
    hits.map((hit) => ({ url: hit.url, name: cleanTitle(hit.title || '') })),
    now
  );
}

async function classifyStoredWithMuse(db: DatabaseSync, ids: string[], fetchImpl?: typeof fetch) {
  const pending = ids.filter((id) => {
    const row = getActivityRow(db, id);
    return row && !row.enriched_at;
  });
  const extra = listUnenrichedIds(db, ENRICH_BATCH).filter((id) => !pending.includes(id));
  const batch = [...pending, ...extra].slice(0, ENRICH_BATCH);
  if (batch.length === 0) return;
  const listings = batch
    .map((id) => getActivityRow(db, id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      id: row.id,
      title: row.name,
      snippet: row.description,
      url: row.url,
      heuristicKind: classifyListing({ title: row.name, snippet: row.description }).kind,
    }));
  if (listings.length === 0) return;
  const result = await museComplete(db, {
    purpose: 'enrich',
    cacheKey: enrichmentCacheKey(listings.map((item) => item.id)),
    temperature: 0,
    maxTokens: 1600,
    fetchImpl,
    messages: [
      {
        role: 'system',
        content:
          'Enrich each listing. kind is "event" for a festival, concert, fair, show, or tour, otherwise "place". Reply with only a JSON array of {"id","kind","startDate","endDate","venue","address","estimatedCostPerPerson","category","tags"}. Dates are YYYY-MM-DD or null. category is one of food, music, outdoors, gaming, sports, nightlife, arts, chill. estimatedCostPerPerson is a number. tags is an array of short strings.',
      },
      { role: 'user', content: JSON.stringify(listings) },
    ],
  });
  if (!result.content) return;
  const parsed = parseMuseEnrichments(result.content);
  const now = new Date();
  for (const item of listings) {
    const enrichment = parsed.get(item.id);
    if (!enrichment) continue;
    applyMuseEnrichment(db, enrichment, now);
  }
}

async function fetchOpenSerp(searchText: string, fetchImpl: typeof fetch = fetch): Promise<OpenSerpHit[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openSerpTimeoutMs());
  try {
    const url = `${openSerpBaseUrl()}/mega/search?engines=${encodeURIComponent(openSerpEngines())}&text=${encodeURIComponent(searchText)}&limit=12&mode=any`;
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { results?: OpenSerpHit[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function inferCategory(text: string): { category: ActivityCategory; label: string } {
  const lower = text.toLowerCase();
  if (/\b(bbq|barbecue|food|taco|restaurant|eat)\b/.test(lower)) return { category: 'food', label: CATEGORY_LABELS.food };
  if (/\b(music|concert|band|honky|jazz)\b/.test(lower)) return { category: 'music', label: CATEGORY_LABELS.music };
  if (/\b(park|lake|swim|spring|kayak|outdoor)\b/.test(lower)) return { category: 'outdoors', label: CATEGORY_LABELS.outdoors };
  if (/\b(arcade|game|pinball|golf)\b/.test(lower)) return { category: 'gaming', label: CATEGORY_LABELS.gaming };
  if (/\b(climb|sport|gym|fitness)\b/.test(lower)) return { category: 'sports', label: CATEGORY_LABELS.sports };
  if (/\b(bar|cocktail|beer|nightlife|brewery)\b/.test(lower)) return { category: 'nightlife', label: CATEGORY_LABELS.nightlife };
  if (/\b(art|museum|gallery|sculpture)\b/.test(lower)) return { category: 'arts', label: CATEGORY_LABELS.arts };
  return { category: 'chill', label: CATEGORY_LABELS.chill };
}

function asCategory(value: string): ActivityCategory {
  return CATEGORIES.has(value) ? (value as ActivityCategory) : 'chill';
}

function estimateCost(category: ActivityCategory): number {
  switch (category) {
    case 'food':
      return 25;
    case 'outdoors':
      return 10;
    case 'gaming':
      return 15;
    case 'music':
      return 20;
    case 'nightlife':
      return 25;
    case 'sports':
      return 20;
    case 'arts':
      return 15;
    case 'chill':
      return 12;
    default:
      return 20;
  }
}

export function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[-|–]\s*(Yelp|TripAdvisor|Eater Austin|Austin Chronicle|The Infatuation|Do512|Austin Texas).*$/i, '')
    .trim();
}

