import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ActivityCategory } from '@/types';
import type { CatalogEvent, EventBucket } from './eventCatalog';
import { chicagoCivilDate, civilDateOrNull, eventsDirectory, loadEventCatalog } from './eventCatalog';
import { normalizeName } from './activityStore';

export const TICKETMASTER_API = 'https://app.ticketmaster.com/discovery/v2/events.json';
export const TICKETMASTER_PAGE_SIZE = 30;

const CLASSIFICATIONS = ['music', 'sports', 'arts & theatre'] as const;

type TicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  dates?: {
    start?: { localDate?: string };
    end?: { localDate?: string };
    status?: { code?: string };
  };
  priceRanges?: Array<{ min?: number; currency?: string }>;
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      state?: { stateCode?: string };
      address?: { line1?: string };
      postalCode?: string;
    }>;
  };
};

export type CollectSummary = {
  added: CatalogEvent[];
  skipped: number;
  note: string | null;
};

export function mergeCollectedEvents(existing: CatalogEvent[], incoming: CatalogEvent[]): CollectSummary {
  const keys = new Set(existing.map(eventKey));
  const added: CatalogEvent[] = [];
  let skipped = 0;
  for (const event of incoming) {
    const key = eventKey(event);
    if (keys.has(key)) {
      skipped += 1;
      continue;
    }
    keys.add(key);
    added.push(event);
  }
  return { added, skipped, note: null };
}

export function parseTicketmasterPayload(payload: unknown): CatalogEvent[] {
  if (!payload || typeof payload !== 'object') return [];
  const embedded = (payload as { _embedded?: { events?: unknown[] } })._embedded;
  const list = Array.isArray(embedded?.events) ? embedded.events : [];
  const events: CatalogEvent[] = [];
  for (const item of list) {
    const event = ticketmasterEvent(item);
    if (event) events.push(event);
  }
  return events;
}

export function ticketmasterSearchUrl(apiKey: string, classificationName: string, startDate: string, page = 0): string {
  const url = new URL(TICKETMASTER_API);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('city', 'Austin');
  url.searchParams.set('stateCode', 'TX');
  url.searchParams.set('countryCode', 'US');
  url.searchParams.set('classificationName', classificationName);
  url.searchParams.set('startDateTime', `${startDate}T00:00:00Z`);
  url.searchParams.set('sort', 'date,asc');
  url.searchParams.set('size', String(TICKETMASTER_PAGE_SIZE));
  url.searchParams.set('page', String(page));
  return url.toString();
}

export async function collectIntoEventDirectory(options: {
  apiKey: string | undefined;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const apiKey = options.apiKey?.trim() || '';
  if (!apiKey) return 'Event collection skipped: TICKETMASTER_API_KEY is not set.';
  const now = options.now ?? new Date();
  const today = chicagoCivilDate(now);
  const incoming = await fetchTicketmasterEvents({ apiKey, startDate: today, fetchImpl: options.fetchImpl });
  const merged = mergeCollectedEvents(loadEventCatalog().events, incoming);
  for (const event of merged.added) {
    const folder = path.join(eventsDirectory(), event.bucket);
    mkdirSync(folder, { recursive: true });
    const file = path.join(folder, `${event.id}.json`);
    writeFileSync(file, `${JSON.stringify(event, null, 2)}\n`);
    console.log(`Added ${event.bucket}/${event.id}  ${event.name}  ${event.startDate}`);
  }
  return `Collected ${merged.added.length} new Ticketmaster events. Skipped ${merged.skipped} already saved. Today in America/Chicago is ${today}.`;
}

export async function fetchTicketmasterEvents(options: {
  apiKey: string;
  startDate: string;
  fetchImpl?: typeof fetch;
}): Promise<CatalogEvent[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const found: CatalogEvent[] = [];
  for (const classification of CLASSIFICATIONS) {
    const response = await fetchImpl(ticketmasterSearchUrl(options.apiKey, classification, options.startDate));
    if (!response.ok) {
      throw new Error(`Ticketmaster ${classification} search returned ${response.status}`);
    }
    const payload: unknown = await response.json();
    found.push(...parseTicketmasterPayload(payload));
  }
  return found;
}

function ticketmasterEvent(value: unknown): CatalogEvent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as TicketmasterEvent;
  const status = record.dates?.status?.code?.toLowerCase() || '';
  if (status === 'cancelled' || status === 'canceled') return null;
  const startDate = civilDateOrNull(record.dates?.start?.localDate);
  if (!startDate) return null;
  const name = clean(record.name);
  const sourceUrl = clean(record.url);
  const id = ticketmasterId(record.id);
  if (!name || !sourceUrl || !id || !/^https:\/\/\S+$/.test(sourceUrl)) return null;
  const venue = record._embedded?.venues?.[0];
  const city = clean(venue?.city?.name);
  const state = clean(venue?.state?.stateCode).toUpperCase();
  if (city && city.toLowerCase() !== 'austin') return null;
  if (state && state !== 'TX') return null;
  const segment = clean(record.classifications?.[0]?.segment?.name);
  const genre = clean(record.classifications?.[0]?.genre?.name);
  const bucket = bucketFor(segment);
  const category = categoryFor(segment);
  const minPrice = record.priceRanges?.find((range) => typeof range.min === 'number' && range.min >= 0)?.min;
  const venueName = clean(venue?.name);
  const line = clean(venue?.address?.line1);
  const postal = clean(venue?.postalCode);
  const address = [line, city || 'Austin', state || 'TX', postal].filter(Boolean).join(', ');
  const blurb = firstSentence(record.info) || firstSentence(record.pleaseNote);
  const description = blurb || `${name} at ${venueName || 'a venue in Austin, TX'}.`;
  return {
    id,
    name,
    bucket,
    category: category.id,
    categoryLabel: category.label,
    location: 'Austin, TX',
    neighborhood: venueName || 'Austin',
    venue: venueName,
    address,
    startDate,
    endDate: civilDateOrNull(record.dates?.end?.localDate) || startDate,
    sourceUrl,
    description,
    estimatedCostPerPerson: typeof minPrice === 'number' ? Math.round(minPrice) : null,
    durationMinutes: 150,
    durationIsEstimate: true,
    tags: [bucket === 'shows' ? 'Shows' : 'Local', segment, genre].filter(Boolean),
    highlights: [venueName, genre].filter(Boolean),
  };
}

function bucketFor(segment: string): EventBucket {
  const name = segment.toLowerCase();
  if (name === 'music' || name === 'sports') return 'shows';
  return 'local';
}

function categoryFor(segment: string): { id: ActivityCategory; label: string } {
  const name = segment.toLowerCase();
  if (name === 'music') return { id: 'music', label: 'Live Music' };
  if (name === 'sports') return { id: 'sports', label: 'Sports & Active' };
  return { id: 'arts', label: 'Arts & Culture' };
}

function ticketmasterId(value: string | undefined): string {
  const raw = clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!raw) return '';
  return `tm-${raw}`.slice(0, 80);
}

function eventKey(event: CatalogEvent): string {
  return `${normalizeName(event.name)}\n${event.startDate || ''}`;
}

function clean(value: string | undefined): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function firstSentence(value: string | undefined): string {
  const text = clean(value);
  if (!text) return '';
  return text.length > 320 ? `${text.slice(0, 317).trim()}...` : text;
}
