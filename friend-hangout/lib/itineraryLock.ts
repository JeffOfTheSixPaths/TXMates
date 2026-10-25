import type { DatabaseSync } from 'node:sqlite';
import type { Activity, ItineraryItem } from '@/types';

export type ItineraryLockRecord = {
  locked: boolean;
  snapshot: ItineraryItem[] | null;
};

export function ensureItineraryLockColumns(db: DatabaseSync) {
  const columns = new Set(
    (db.prepare(`PRAGMA table_info(hangouts)`).all() as Array<{ name: string }>).map((column) => column.name)
  );
  if (!columns.has('itinerary_locked')) {
    db.exec(`ALTER TABLE hangouts ADD COLUMN itinerary_locked INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columns.has('itinerary_snapshot')) {
    db.exec(`ALTER TABLE hangouts ADD COLUMN itinerary_snapshot TEXT`);
  }
}

export function parseItinerarySnapshot(raw: unknown): ItineraryItem[] | null {
  const value = typeof raw === 'string' ? parseJson(raw) : raw;
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) return null;
  const items: ItineraryItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const item = entry as ItineraryItem;
    if (typeof item.timeSlot !== 'string' || !isActivity(item.activity)) return null;
    items.push({
      timeSlot: item.timeSlot,
      activity: item.activity,
      notes: typeof item.notes === 'string' ? item.notes : '',
      allFriendsAvailable: Boolean(item.allFriendsAvailable),
      availableFriendsCount: typeof item.availableFriendsCount === 'number' ? item.availableFriendsCount : 0,
    });
  }
  return items;
}

export function readItineraryLock(db: DatabaseSync, hangoutId: string): ItineraryLockRecord {
  ensureItineraryLockColumns(db);
  const row = db
    .prepare(`SELECT itinerary_locked, itinerary_snapshot FROM hangouts WHERE id = ?`)
    .get(hangoutId) as { itinerary_locked: number | null; itinerary_snapshot: string | null } | undefined;
  if (!row) return { locked: false, snapshot: null };
  return {
    locked: row.itinerary_locked === 1,
    snapshot: parseItinerarySnapshot(row.itinerary_snapshot),
  };
}

export function writeItineraryLock(
  db: DatabaseSync,
  hangoutId: string,
  locked: boolean,
  snapshot: ItineraryItem[] | null
): ItineraryLockRecord {
  ensureItineraryLockColumns(db);
  const stored = snapshot ? JSON.stringify(snapshot) : null;
  const result = db
    .prepare(
      `UPDATE hangouts SET itinerary_locked = ?, itinerary_snapshot = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .run(locked ? 1 : 0, stored, hangoutId);
  if (result.changes === 0) {
    throw new Error('Hangout not found');
  }
  return readItineraryLock(db, hangoutId);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isActivity(value: unknown): value is Activity {
  if (!value || typeof value !== 'object') return false;
  const activity = value as Activity;
  return (
    typeof activity.id === 'string' &&
    activity.id.length > 0 &&
    typeof activity.name === 'string' &&
    typeof activity.estimatedCostPerPerson === 'number' &&
    typeof activity.durationMinutes === 'number'
  );
}
