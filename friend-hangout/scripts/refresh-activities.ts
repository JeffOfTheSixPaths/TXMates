/**
 * Refresh stale OpenSERP searches, recheck quiet places, and delete expired rows.
 * Run from the friend-hangout folder. Safe for Windows Task Scheduler. Never prints API keys.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { activityPolicy } from '../lib/activityPolicy';
import { isQueryFresh } from '../lib/activityPolicy';
import {
  cleanupActivities,
  discoveryCacheKey,
  ensureActivityTables,
  listDiscoveryQueries,
  listPlacesDueForRecheck,
} from '../lib/activityStore';
import { DISCOVERY_CATEGORIES, discoveryRefreshSettled, recheckPlace, refreshDiscoveryQuery } from '../lib/discoverySearch';
import { parseEnvFile } from '../lib/nessieSeed';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadLocalEnv() {
  let text = '';
  try {
    text = readFileSync(path.join(root, '.env.local'), 'utf8');
  } catch {
    return;
  }
  const values = parseEnvFile(text);
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv();
  const force = process.argv.includes('--force');
  const now = new Date();
  const policy = activityPolicy();
  const location = process.env.ACTIVITY_LOCATION?.trim() || 'Austin, TX';
  const dataDir = path.join(root, 'data');
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'txmates.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  ensureActivityTables(db);

  const planned = new Map<string, { location: string; category: string; query: string }>();
  for (const category of DISCOVERY_CATEGORIES) {
    const query = '';
    planned.set(discoveryCacheKey(location, category, query), { location, category, query });
  }
  for (const row of listDiscoveryQueries(db)) {
    planned.set(row.cache_key, { location: row.location, category: row.category, query: row.query });
  }

  const storedAt = new Map(listDiscoveryQueries(db).map((row) => [row.cache_key, row.refreshed_at]));
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;
  for (const [cacheKey, job] of planned) {
    const fresh = isQueryFresh(storedAt.get(cacheKey) ?? null, now, policy.cacheTtlMs);
    if (fresh && !force) {
      skipped += 1;
      continue;
    }
    const result = await refreshDiscoveryQuery(db, { ...job, now, allowMuse: true });
    if (result.ok) refreshed += 1;
    else failed += 1;
  }
  await discoveryRefreshSettled();

  const places = listPlacesDueForRecheck(db, now, policy.placeRecheckDays, policy.recheckLimit);
  let kept = 0;
  let removed = 0;
  let recheckSkipped = 0;
  for (const place of places) {
    const outcome = await recheckPlace(db, place.id, { location, now });
    if (outcome === 'kept') kept += 1;
    else if (outcome === 'removed') removed += 1;
    else recheckSkipped += 1;
  }

  const cleanup = cleanupActivities(db, now, policy);
  db.close();

  console.log(`Refreshed ${refreshed} searches (${failed} failed, ${skipped} still fresh).`);
  console.log(`Rechecked ${places.length} places: kept ${kept}, removed ${removed}, skipped ${recheckSkipped}.`);
  console.log(`Cleanup removed ${cleanup.deletedEvents} expired events and ${cleanup.removedPlaces} stale places.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Activity refresh failed';
  console.error(message);
  process.exitCode = 1;
});
