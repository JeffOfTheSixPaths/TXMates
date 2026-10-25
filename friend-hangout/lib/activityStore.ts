import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Activity, ActivityCategory } from '@/types';
import type { Classification } from './activityClassify';
import type { MuseEnrichment } from './museEnrich';
import { civilDate } from './activityClassify';
import { searchCatalog } from './catalogSearch';
import { daysAgoIso, type ActivityPolicy } from './activityPolicy';

export type ActivityDraft = {
  name: string;
  url: string;
  snippet: string;
  category: ActivityCategory;
  categoryLabel: string;
  location: string;
  neighborhood: string;
  estimatedCostPerPerson: number;
  durationMinutes: number;
  sourceQuery: string;
  engine?: string;
  classification: Classification;
  now: Date;
};

export type ActivityRow = {
  id: string;
  name: string;
  normalized_name: string;
  url: string;
  normalized_url: string;
  category: ActivityCategory;
  category_label: string;
  kind: 'event' | 'place';
  description: string;
  location: string;
  neighborhood: string;
  estimated_cost: number;
  duration_minutes: number;
  highlights: string;
  rating: number;
  review_count: number;
  popular_times: string;
  best_for: string;
  tags: string;
  source_query: string;
  start_date: string | null;
  end_date: string | null;
  first_seen: string;
  last_seen: string;
  status: string;
  classification_source: string;
  venue?: string | null;
  address?: string | null;
  enriched_at?: string | null;
};

export type DiscoveryQueryRow = {
  cache_key: string;
  location: string;
  category: string;
  query: string;
  refreshed_at: string | null;
};

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
]);

export function ensureActivityTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      url TEXT NOT NULL,
      normalized_url TEXT NOT NULL,
      category TEXT NOT NULL,
      category_label TEXT NOT NULL,
      kind TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      estimated_cost INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      highlights TEXT NOT NULL,
      rating REAL NOT NULL,
      review_count INTEGER NOT NULL,
      popular_times TEXT NOT NULL,
      best_for TEXT NOT NULL,
      tags TEXT NOT NULL,
      source_query TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      status TEXT NOT NULL,
      classification_source TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activities_status_category ON activities (status, category);
    CREATE INDEX IF NOT EXISTS idx_activities_kind_seen ON activities (kind, last_seen);

    CREATE TABLE IF NOT EXISTS discovery_queries (
      cache_key TEXT PRIMARY KEY,
      location TEXT NOT NULL,
      category TEXT NOT NULL,
      query TEXT NOT NULL,
      refreshed_at TEXT
    );
  `);
  const columns = new Set(
    (db.prepare(`PRAGMA table_info(activities)`).all() as Array<{ name: string }>).map((column) => column.name)
  );
  if (!columns.has('venue')) db.exec(`ALTER TABLE activities ADD COLUMN venue TEXT`);
  if (!columns.has('address')) db.exec(`ALTER TABLE activities ADD COLUMN address TEXT`);
  if (!columns.has('enriched_at')) db.exec(`ALTER TABLE activities ADD COLUMN enriched_at TEXT`);
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) parsed.searchParams.delete(key);
    }
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    const search = parsed.searchParams.toString();
    return `${host}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function activityId(name: string, url: string): string {
  return createHash('sha256')
    .update(`${normalizeUrl(url)}\n${normalizeName(name)}`)
    .digest('hex')
    .slice(0, 24);
}

export function discoveryCacheKey(location: string, category: string, query: string): string {
  const raw = [location, category, query].map((part) => part.trim().toLowerCase()).join('\n');
  return createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

export function listingMatchesPlace(
  place: { normalizedUrl: string; normalizedName: string },
  hit: { url?: string; name?: string }
): boolean {
  if (hit.url && place.normalizedUrl && normalizeUrl(hit.url) === place.normalizedUrl) return true;
  if (hit.name && place.normalizedName && normalizeName(hit.name) === place.normalizedName) return true;
  return false;
}

export function upsertActivity(db: DatabaseSync, draft: ActivityDraft): { id: string; action: 'inserted' | 'updated' } {
  ensureActivityTables(db);
  const id = activityId(draft.name, draft.url);
  const existing = getActivityRow(db, id);
  const nowIso = draft.now.toISOString();
  const classification = existing ? mergedClassification(existing, draft.classification) : draft.classification;
  const highlights = JSON.stringify([
    draft.engine ? `OpenSERP ${draft.engine}` : 'OpenSERP',
    classification.kind === 'event' ? 'Event' : 'Place',
  ]);
  const tags = JSON.stringify(['Saved', draft.categoryLabel, classification.kind === 'event' ? 'Event' : 'Place']);

  if (!existing) {
    db.prepare(
      `INSERT INTO activities (
        id, name, normalized_name, url, normalized_url, category, category_label, kind,
        description, location, neighborhood, estimated_cost, duration_minutes, highlights,
        rating, review_count, popular_times, best_for, tags, source_query, start_date,
        end_date, first_seen, last_seen, status, classification_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    ).run(
      id,
      draft.name,
      normalizeName(draft.name),
      draft.url,
      normalizeUrl(draft.url),
      draft.category,
      draft.categoryLabel,
      classification.kind,
      draft.snippet || `Saved from OpenSERP for ${draft.sourceQuery}`,
      draft.location,
      draft.neighborhood,
      draft.estimatedCostPerPerson,
      draft.durationMinutes,
      highlights,
      4.6,
      120,
      'Afternoons & Evenings',
      classification.kind === 'event' ? 'Time-bound Austin plans' : 'A place the group can return to',
      tags,
      draft.sourceQuery,
      classification.startDate,
      classification.endDate,
      nowIso,
      nowIso,
      classification.source
    );
    return { id, action: 'inserted' };
  }

  db.prepare(
    `UPDATE activities SET
      description = ?,
      category = ?,
      category_label = ?,
      kind = ?,
      start_date = ?,
      end_date = ?,
      source_query = ?,
      last_seen = ?,
      status = 'active',
      classification_source = ?,
      highlights = ?,
      tags = ?
    WHERE id = ?`
  ).run(
    draft.snippet || existing.description,
    draft.category,
    draft.categoryLabel,
    classification.kind,
    classification.startDate,
    classification.endDate,
    draft.sourceQuery,
    nowIso,
    classification.source,
    highlights,
    tags,
    id
  );
  return { id, action: 'updated' };
}

export function updateActivityClassification(db: DatabaseSync, id: string, classification: Classification) {
  ensureActivityTables(db);
  const kind = classification.kind === 'place' ? 'place' : 'event';
  db.prepare(
    `UPDATE activities SET kind = ?, start_date = ?, end_date = ?, classification_source = ? WHERE id = ?`
  ).run(
    kind,
    kind === 'event' ? classification.startDate : null,
    kind === 'event' ? classification.endDate : null,
    classification.source,
    id
  );
}

export function getActivityRow(db: DatabaseSync, id: string): ActivityRow | null {
  ensureActivityTables(db);
  const row = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id) as ActivityRow | undefined;
  return row ?? null;
}

export function searchSavedActivities(
  db: DatabaseSync,
  input: { query: string; category: string }
): { rows: ActivityRow[]; relaxed: boolean } {
  ensureActivityTables(db);
  const category = input.category || 'all';
  const rows = db
    .prepare(
      `SELECT * FROM activities WHERE status = 'active' AND (? = 'all' OR category = ?) ORDER BY last_seen DESC`
    )
    .all(category, category) as ActivityRow[];
  const searchable = rows.map((row) => ({
    row,
    name: row.name,
    description: row.description,
    tags: parseJsonArray(row.tags),
    category: row.category,
    categoryLabel: row.category_label,
    neighborhood: row.neighborhood,
    highlights: parseJsonArray(row.highlights),
  }));
  const result = searchCatalog(searchable, input.query);
  return { rows: result.activities.map((item) => item.row), relaxed: result.relaxed };
}

export function isSponsoredTitle(title: string): boolean {
  return /\sAd$/i.test(title.trim());
}

export function purgeSponsoredActivities(db: DatabaseSync): number {
  ensureActivityTables(db);
  const rows = db.prepare(`SELECT id, name FROM activities`).all() as Array<{ id: string; name: string }>;
  const remove = db.prepare(`DELETE FROM activities WHERE id = ?`);
  let removed = 0;
  for (const row of rows) {
    if (!isSponsoredTitle(row.name)) continue;
    remove.run(row.id);
    removed += 1;
  }
  return removed;
}

export function cleanupActivities(
  db: DatabaseSync,
  now: Date,
  policy: Pick<ActivityPolicy, 'eventTtlDays' | 'placeStaleDays'>
): { deletedEvents: number; removedPlaces: number } {
  ensureActivityTables(db);
  purgeSponsoredActivities(db);
  const today = civilDate(now);
  const eventCutoff = daysAgoIso(now, policy.eventTtlDays);
  const placeCutoff = daysAgoIso(now, policy.placeStaleDays);

  const expiredEvents = db
    .prepare(
      `SELECT id FROM activities WHERE kind = 'event' AND (
        (coalesce(end_date, start_date) IS NOT NULL AND coalesce(end_date, start_date) < ?)
        OR (start_date IS NULL AND end_date IS NULL AND last_seen <= ?)
      )`
    )
    .all(today, eventCutoff) as Array<{ id: string }>;
  const stalePlaces = db
    .prepare(`SELECT id FROM activities WHERE kind = 'place' AND last_seen <= ?`)
    .all(placeCutoff) as Array<{ id: string }>;

  const remove = db.prepare(`DELETE FROM activities WHERE id = ?`);
  for (const row of expiredEvents) remove.run(row.id);
  const unlist = db.prepare(`UPDATE activities SET status = 'unlisted' WHERE id = ?`);
  for (const row of stalePlaces) {
    unlist.run(row.id);
    remove.run(row.id);
  }
  return { deletedEvents: expiredEvents.length, removedPlaces: stalePlaces.length };
}

export function listPlacesDueForRecheck(db: DatabaseSync, now: Date, recheckDays: number, limit: number): ActivityRow[] {
  ensureActivityTables(db);
  return db
    .prepare(
      `SELECT * FROM activities WHERE kind = 'place' AND status = 'active' AND last_seen <= ? ORDER BY last_seen ASC LIMIT ?`
    )
    .all(daysAgoIso(now, recheckDays), limit) as ActivityRow[];
}

export function applyRecheck(
  db: DatabaseSync,
  placeId: string,
  hits: Array<{ url?: string; name?: string }>,
  now: Date
): 'kept' | 'removed' | 'skipped' {
  const place = getActivityRow(db, placeId);
  if (!place || place.kind !== 'place') return 'skipped';
  const matched = hits.some((hit) =>
    listingMatchesPlace(
      { normalizedUrl: place.normalized_url, normalizedName: place.normalized_name },
      hit
    )
  );
  if (matched) {
    db.prepare(`UPDATE activities SET last_seen = ?, status = 'active' WHERE id = ?`).run(now.toISOString(), placeId);
    return 'kept';
  }
  db.prepare(`UPDATE activities SET status = 'unlisted' WHERE id = ?`).run(placeId);
  db.prepare(`DELETE FROM activities WHERE id = ?`).run(placeId);
  return 'removed';
}

export function markQueryRefreshed(
  db: DatabaseSync,
  input: { location: string; category: string; query: string; now: Date }
) {
  ensureActivityTables(db);
  const cacheKey = discoveryCacheKey(input.location, input.category, input.query);
  db.prepare(
    `INSERT INTO discovery_queries (cache_key, location, category, query, refreshed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET refreshed_at = excluded.refreshed_at`
  ).run(cacheKey, input.location, input.category, input.query, input.now.toISOString());
}

export function getQueryRefreshedAt(db: DatabaseSync, cacheKey: string): string | null {
  ensureActivityTables(db);
  const row = db.prepare(`SELECT refreshed_at FROM discovery_queries WHERE cache_key = ?`).get(cacheKey) as
    | { refreshed_at: string | null }
    | undefined;
  return row?.refreshed_at ?? null;
}

export function listDiscoveryQueries(db: DatabaseSync): DiscoveryQueryRow[] {
  ensureActivityTables(db);
  return db.prepare(`SELECT * FROM discovery_queries ORDER BY refreshed_at ASC`).all() as DiscoveryQueryRow[];
}

export function listUnenrichedIds(db: DatabaseSync, limit: number): string[] {
  ensureActivityTables(db);
  const rows = db
    .prepare(
      `SELECT id FROM activities WHERE status = 'active' AND enriched_at IS NULL ORDER BY first_seen DESC LIMIT ?`
    )
    .all(limit) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

export function applyMuseEnrichment(
  db: DatabaseSync,
  enrichment: MuseEnrichment,
  now: Date
): 'applied' | 'skipped' | 'missing' {
  const row = getActivityRow(db, enrichment.id);
  if (!row) return 'missing';
  if (row.enriched_at) return 'skipped';
  const tags = enrichment.tags.length > 0 ? enrichment.tags : parseJsonArray(row.tags);
  db.prepare(
    `UPDATE activities SET
      kind = ?,
      start_date = ?,
      end_date = ?,
      category = COALESCE(?, category),
      category_label = COALESCE(?, category_label),
      estimated_cost = COALESCE(?, estimated_cost),
      venue = ?,
      address = ?,
      location = COALESCE(?, location),
      neighborhood = COALESCE(?, neighborhood),
      tags = ?,
      classification_source = 'muse',
      enriched_at = ?
    WHERE id = ? AND enriched_at IS NULL`
  ).run(
    enrichment.kind,
    enrichment.kind === 'event' ? enrichment.startDate : null,
    enrichment.kind === 'event' ? enrichment.endDate : null,
    enrichment.category,
    enrichment.categoryLabel,
    enrichment.estimatedCostPerPerson,
    enrichment.venue,
    enrichment.address,
    enrichment.address,
    enrichment.venue,
    JSON.stringify(tags),
    now.toISOString(),
    enrichment.id
  );
  return 'applied';
}

export function toActivity(row: ActivityRow, freshness: 'live' | 'saved'): Activity {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    categoryLabel: row.category_label,
    location: row.location,
    neighborhood: row.neighborhood,
    estimatedCostPerPerson: row.estimated_cost,
    durationMinutes: row.duration_minutes,
    description: row.description,
    highlights: parseJsonArray(row.highlights),
    rating: row.rating,
    reviewCount: row.review_count,
    popularTimes: row.popular_times,
    bestFor: row.best_for,
    tags: parseJsonArray(row.tags),
    sourceUrl: row.url,
    isLiveResult: freshness === 'live',
    resultFreshness: freshness,
    kind: row.kind,
    startDate: row.start_date,
    endDate: row.end_date,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    venue: row.venue || undefined,
    address: row.address || undefined,
    museEnriched: row.classification_source === 'muse' && Boolean(row.enriched_at),
    uncertainties: [
      'Price estimated from the venue category',
      freshness === 'saved' ? 'Saved locally from an earlier OpenSERP result' : 'Fresh OpenSERP result, saved locally',
    ],
  };
}

function mergedClassification(existing: ActivityRow, incoming: Classification): Classification {
  if (incoming.source === 'muse') {
    return incoming.kind === 'place'
      ? { kind: 'place', startDate: null, endDate: null, source: 'muse' }
      : incoming;
  }
  if (existing.kind === 'event' || incoming.kind === 'event') {
    const startDate = incoming.startDate || existing.start_date;
    const endDate = incoming.endDate || existing.end_date || startDate;
    return { kind: 'event', startDate, endDate, source: existing.classification_source === 'muse' ? 'muse' : 'heuristic' };
  }
  return { kind: 'place', startDate: null, endDate: null, source: 'heuristic' };
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
