import type { DatabaseSync } from 'node:sqlite';
import type { ActivityCategory } from '@/types';
import { classifyListing } from './activityClassify';
import { inferActivityCategory } from './activityCategory';
import type { ActivityPolicy } from './activityPolicy';
import {
  applyMuseEnrichment,
  applyRecheck,
  getActivityRow,
  isSponsoredTitle,
  listUnenrichedIds,
  markQueryRefreshed,
  upsertActivity,
} from './activityStore';
import { museComplete } from './museClient';
import {
  ENRICH_BATCH,
  ENRICH_MAX_TOKENS,
  ENRICH_REASONING_EFFORT,
  enrichmentCacheKey,
  enrichmentContentCacheable,
  parseMuseEnrichments,
} from './museEnrich';
import { discoveryHitRejection } from './activityPolicy';
import {
  createActivitySearchProvider,
  type SearchContext,
  type SearchHit,
  type SearchProviderEnv,
  type SearchProviderName,
} from './searchProvider';

export { openSerpBaseUrl } from './serviceTimeouts';

const CATEGORIES = new Set(['food', 'music', 'outdoors', 'gaming', 'sports', 'nightlife', 'arts', 'chill']);

export const DISCOVERY_CATEGORIES = ['all', ...CATEGORIES] as const;

export type RefreshInput = {
  location: string;
  category: string;
  query: string;
  now?: Date;
  fetchImpl?: typeof fetch;
  policy?: ActivityPolicy;
  allowMuse?: boolean;
  awaitMuse?: boolean;
  searchEnv?: SearchProviderEnv;
};

const inflight = new Map<string, Promise<void>>();

const GENERIC_SEARCH = 'best things to do with friends venues activities';

const POPULAR_CITIES = [
  'dallas',
  'boston',
  'san antonio',
  'houston',
  'chicago',
  'new york',
  'nyc',
  'austin',
  'seattle',
  'denver',
  'miami',
  'atlanta',
  'los angeles',
  'san francisco',
  'orlando',
];

const CITY_ACRONYMS = new Set(['nyc', 'dfw', 'la']);

export function formatCityLabel(city: string): string {
  const trimmed = city.trim();
  const key = trimmed.toLowerCase();
  if (CITY_ACRONYMS.has(key)) return key.toUpperCase();
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeLocationLabel(location: string): string {
  const [cityPart, ...rest] = location.split(',');
  const city = formatCityLabel(cityPart || '');
  const region = rest
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^[a-z]{2}$/i.test(part) ? part.toUpperCase() : formatCityLabel(part)));
  return [city, ...region].filter(Boolean).join(', ');
}

export function resolveDiscoveryLocation(rawQ: string, locationParam: string): { location: string; query: string } {
  let location = locationParam;
  let cleanQ = rawQ;
  for (const city of POPULAR_CITIES) {
    const named = new RegExp(`\\b${escapeRegex(city)}\\b`, 'i');
    if (!named.test(rawQ)) continue;
    location = formatCityLabel(city);
    cleanQ = rawQ.replace(new RegExp(`\\b${escapeRegex(city)}\\s*(,\\s*[a-z]{2})?\\b`, 'gi'), ' ');
    break;
  }
  cleanQ = cleanQ
    .replace(/\s+(in|near|around)\s*$/i, ' ')
    .replace(/^(in|near|around)\s+/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { location: normalizeLocationLabel(location || 'Austin, TX'), query: cleanQ };
}

export function buildSearchText(location: string, category: string, query: string): string {
  const place = location.trim();
  const term = query.trim().replace(/\s+(in|near|around)$/i, '').trim();
  const focusedCategory = category !== 'all' && category.trim() ? category.trim() : '';
  if (term) {
    const parts = [term];
    if (focusedCategory && !term.toLowerCase().includes(focusedCategory.toLowerCase())) parts.push(focusedCategory);
    const placeCity = place.split(',')[0]?.trim().toLowerCase() || '';
    if (place && placeCity && !term.toLowerCase().includes(placeCity)) parts.push('in', place);
    return parts.join(' ');
  }
  return [place, focusedCategory || GENERIC_SEARCH].filter(Boolean).join(' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const cleanCity = location.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || 'Austin';
  const cityLabel = formatCityLabel(cleanCity);
  const searched = await fetchActivitySearch(
    searchText,
    input.fetchImpl,
    {
      location,
      query: searchText,
    },
    input.searchEnv
  );
  const hits = searched.hits;
  if (!hits) return { ok: false, ids: [] };
  const discoveredVia = searched.provider === 'serpapi' ? 'SerpApi' : 'OpenSERP';

  const ids: string[] = [];
  for (const hit of hits) {
    const rawTitle = hit.title || '';
    const title = cleanTitle(rawTitle);
    const url = hit.url || '';
    if (!title || !url || url.includes('google.com/search')) continue;
    if (isSponsoredTitle(rawTitle) || isSponsoredTitle(title)) continue;
    if (
      discoveryHitRejection({
        title,
        snippet: hit.snippet || '',
        url,
        location,
        query: searchText,
      })
    ) {
      continue;
    }
    const inferred = inferActivityCategory({
      title,
      snippet: hit.snippet || '',
      query,
    });
    const finalCategory = inferred.category;
    const classification = classifyListing({ title, snippet: hit.snippet || '', now });
    const saved = upsertActivity(db, {
      name: title,
      url,
      snippet: hit.snippet || `Discovered via ${discoveredVia} on ${hit.domain || 'the web'}`,
      category: finalCategory,
      categoryLabel: inferred.label,
      location: `${location} (${hit.domain || 'Local venue'})`,
      neighborhood: hit.domain || `${cityLabel} Area`,
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
  if (input.allowMuse) {
    if (input.awaitMuse) {
      await enrichStoredActivities(db, ids.slice(0, 6), input.fetchImpl);
    } else {
      scheduleMuseClassification(db, ids, input.fetchImpl);
    }
  }
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
  const job = enrichStoredActivities(db, ids, fetchImpl)
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
  const searched = await fetchActivitySearch(text, input.fetchImpl, {
    location: input.location || 'Austin, TX',
    query: place.name,
    requireQueryMatch: false,
  });
  const hits = searched.hits;
  if (!hits) return 'skipped';
  return applyRecheck(
    db,
    placeId,
    hits.map((hit) => ({ url: hit.url, name: cleanTitle(hit.title || '') })),
    now
  );
}

export async function enrichStoredActivities(
  db: DatabaseSync,
  ids: string[],
  fetchImpl?: typeof fetch,
  options?: { maxNew?: number; includeExtras?: boolean }
) {
  const maxNew = options?.maxNew ?? ENRICH_BATCH;
  const includeExtras = options?.includeExtras !== false;
  const pending = ids.filter((id) => {
    const row = getActivityRow(db, id);
    return row && !row.enriched_at;
  });
  const extra = includeExtras ? listUnenrichedIds(db, maxNew).filter((id) => !pending.includes(id)) : [];
  const batch = [...pending, ...extra].slice(0, maxNew);
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
    maxTokens: ENRICH_MAX_TOKENS,
    reasoningEffort: ENRICH_REASONING_EFFORT,
    cacheContent: enrichmentContentCacheable,
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

export function filterDiscoveryHits(hits: SearchHit[], engine: string, context: SearchContext): SearchHit[] {
  const accepted = hits.filter((hit) => {
    const title = cleanTitle(hit.title || '');
    if (!title || !(hit.url || '') || isSponsoredTitle(hit.title || '') || isSponsoredTitle(title)) return false;
    return (
      discoveryHitRejection({
        title,
        snippet: hit.snippet || '',
        url: hit.url || '',
        location: context.location,
        query: context.query,
        requireQueryMatch: context.requireQueryMatch,
      }) === null
    );
  });
  return accepted.map((hit) => ({ ...hit, engine: hit.engine || engine }));
}

async function fetchActivitySearch(
  searchText: string,
  fetchImpl: typeof fetch = fetch,
  context: SearchContext = {
    location: 'Austin, TX',
    query: searchText,
  },
  env?: SearchProviderEnv
): Promise<{ provider: SearchProviderName; hits: SearchHit[] | null }> {
  const provider = createActivitySearchProvider({
    env,
    filterHits: filterDiscoveryHits,
  });
  const hits = await provider.search(searchText, fetchImpl, context);
  return { provider: provider.name, hits };
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
    .replace(/\s*[-|–]\s*(Yelp|TripAdvisor|Eater\b.*|Austin Chronicle|The Infatuation|Timeout|Chronicle\b.*|Do512|Austin Texas|Guide).*$/i, '')
    .trim();
}

