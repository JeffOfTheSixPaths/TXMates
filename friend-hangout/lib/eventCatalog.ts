import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Activity, ActivityCategory } from '@/types';
import { searchCatalog } from './catalogSearch';

export const EVENT_BUCKETS = ['local', 'shows'] as const;
export type EventBucket = (typeof EVENT_BUCKETS)[number];

const CATEGORIES = new Set<ActivityCategory>([
  'food',
  'music',
  'outdoors',
  'gaming',
  'sports',
  'nightlife',
  'arts',
  'chill',
]);

export type CatalogEvent = {
  id: string;
  name: string;
  bucket: EventBucket;
  category: ActivityCategory;
  categoryLabel: string;
  location: string;
  neighborhood: string;
  venue: string;
  address: string;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string;
  description: string;
  estimatedCostPerPerson: number | null;
  durationMinutes: number;
  durationIsEstimate: boolean;
  tags: string[];
  highlights: string[];
};

export type RemovedEvent = {
  id: string;
  name: string;
  bucket: EventBucket;
  startDate: string | null;
  endDate: string | null;
  file: string;
};

export type PruneResult = {
  today: string;
  removed: RemovedEvent[];
  kept: number;
  undated: number;
  unreadable: string[];
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function eventsDirectory(): string {
  return path.join(root, 'data', 'events');
}

export function chicagoCivilDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Could not read the America/Chicago calendar date');
  return `${year}-${month}-${day}`;
}

export function civilDateOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return value;
}

export function eventIsPast(
  event: { startDate: string | null; endDate: string | null },
  today: string
): boolean {
  const end = civilDateOrNull(event.endDate) || civilDateOrNull(event.startDate);
  if (!end) return false;
  return end < today;
}

export function eventIsUndated(event: { startDate: string | null; endDate: string | null }): boolean {
  return !civilDateOrNull(event.endDate) && !civilDateOrNull(event.startDate);
}

export function parseCatalogEvent(value: unknown): CatalogEvent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const bucket = record.bucket === 'local' || record.bucket === 'shows' ? record.bucket : null;
  const category = typeof record.category === 'string' && CATEGORIES.has(record.category as ActivityCategory)
    ? (record.category as ActivityCategory)
    : null;
  const categoryLabel = typeof record.categoryLabel === 'string' ? record.categoryLabel.trim() : '';
  const sourceUrl = typeof record.sourceUrl === 'string' ? record.sourceUrl.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  if (!id || !name || !bucket || !category || !categoryLabel || !description) return null;
  if (!/^https:\/\/\S+$/.test(sourceUrl)) return null;
  const cost = record.estimatedCostPerPerson;
  const estimatedCostPerPerson =
    cost === null ? null : typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? Math.round(cost) : null;
  if (cost !== null && estimatedCostPerPerson === null) return null;
  const durationMinutes = record.durationMinutes;
  if (typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return null;
  return {
    id,
    name,
    bucket,
    category,
    categoryLabel,
    location: stringOr(record.location, 'Austin, TX'),
    neighborhood: stringOr(record.neighborhood, 'Austin'),
    venue: stringOr(record.venue, ''),
    address: stringOr(record.address, ''),
    startDate: civilDateOrNull(record.startDate),
    endDate: civilDateOrNull(record.endDate),
    sourceUrl,
    description,
    estimatedCostPerPerson,
    durationMinutes,
    durationIsEstimate: record.durationIsEstimate === true,
    tags: stringList(record.tags),
    highlights: stringList(record.highlights),
  };
}

export function catalogEventToActivity(event: CatalogEvent): Activity {
  const priceListed = event.estimatedCostPerPerson !== null;
  const uncertainties = ['Dates and details come from the linked source.'];
  if (!priceListed) uncertainties.push('Ticket price was not on the source page.');
  if (event.durationIsEstimate) uncertainties.push('Length is a planning estimate.');
  return {
    id: event.id,
    name: event.name,
    category: event.category,
    categoryLabel: event.categoryLabel,
    location: event.location,
    neighborhood: event.neighborhood,
    estimatedCostPerPerson: event.estimatedCostPerPerson ?? 0,
    priceListed,
    durationMinutes: event.durationMinutes,
    description: event.description,
    highlights: event.highlights,
    rating: 0,
    reviewCount: 0,
    popularTimes: '',
    bestFor: event.venue || event.neighborhood,
    tags: event.tags,
    sourceUrl: event.sourceUrl,
    kind: 'event',
    startDate: event.startDate,
    endDate: event.endDate,
    venue: event.venue || undefined,
    address: event.address || undefined,
    resultFreshness: 'catalog',
    uncertainties,
  };
}

export function loadEventCatalog(directory = eventsDirectory()): { events: CatalogEvent[]; unreadable: string[] } {
  const events: CatalogEvent[] = [];
  const unreadable: string[] = [];
  for (const bucket of EVENT_BUCKETS) {
    const folder = path.join(directory, bucket);
    let names: string[] = [];
    try {
      names = readdirSync(folder);
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(folder, name);
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        unreadable.push(file);
        continue;
      }
      const event = parseCatalogEvent(parsed);
      if (!event) {
        unreadable.push(file);
        continue;
      }
      events.push(event);
    }
  }
  return { events, unreadable };
}

export function pruneEventDirectory(directory: string, now: Date): PruneResult {
  const today = chicagoCivilDate(now);
  const removed: RemovedEvent[] = [];
  let kept = 0;
  let undated = 0;
  const unreadable: string[] = [];

  for (const bucket of EVENT_BUCKETS) {
    const folder = path.join(directory, bucket);
    let names: string[] = [];
    try {
      names = readdirSync(folder);
    } catch {
      continue;
    }
    for (const name of names.sort()) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(folder, name);
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        unreadable.push(file);
        continue;
      }
      const event = parseCatalogEvent(parsed);
      if (!event) {
        unreadable.push(file);
        continue;
      }
      if (eventIsUndated(event)) {
        undated += 1;
        kept += 1;
        continue;
      }
      if (!eventIsPast(event, today)) {
        kept += 1;
        continue;
      }
      unlinkSync(file);
      removed.push({
        id: event.id,
        name: event.name,
        bucket: event.bucket,
        startDate: event.startDate,
        endDate: event.endDate,
        file,
      });
    }
  }

  return { today, removed, kept, undated, unreadable };
}

export function selectCatalogActivities(
  activities: Activity[],
  category: string,
  query: string,
  today: string
): Activity[] {
  const current = activities.filter(
    (activity) => !eventIsPast({ startDate: activity.startDate ?? null, endDate: activity.endDate ?? null }, today)
  );
  const pool =
    category === 'all' || !category
      ? current
      : current.filter((activity) => activity.category === category);
  const queryText = query.trim();
  const ordered = [...pool].sort((left, right) => {
    const date = (left.startDate || '9999').localeCompare(right.startDate || '9999');
    if (date !== 0) return date;
    return left.name.localeCompare(right.name);
  });
  if (!queryText) return ordered;
  const searched = searchCatalog(ordered, queryText);
  if (searched.relaxed) return [];
  return searched.activities;
}

export function catalogActivitiesForSearch(
  category: string,
  query: string,
  now: Date,
  location = 'Austin, TX',
  preset?: Activity[]
): Activity[] {
  if (!/austin/i.test(location) && location.trim() !== '') return [];
  const today = chicagoCivilDate(now);
  const activities = preset ?? loadEventCatalog().events.map(catalogEventToActivity);
  return selectCatalogActivities(activities, category, query, today);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}
