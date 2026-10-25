import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export type MuseCacheInput = {
  viewType: string;
  model?: string;
  preferences: {
    groupName?: string;
    location?: string;
    date?: string;
    timePreference?: string;
    maxBudgetPerPerson?: number;
    selectedInterests?: string[];
    friends?: Array<{
      id?: string;
      name?: string;
      budgetPreference?: number;
      topInterests?: string[];
      availabilitySlots?: Array<{ startTime?: string; endTime?: string }>;
    }>;
  };
  activities: Array<{
    id?: string;
    name?: string;
    category?: string;
    estimatedCostPerPerson?: number;
  }>;
  budget?: {
    source?: string;
    suggestedPerPerson?: number;
    balance?: number;
    discretionary?: number;
  } | null;
};

export type MuseCachePayload = {
  model: string;
  aiRationale: string;
  aiIcebreaker?: string;
  aiCoordinationTip?: string;
  createdAt: string;
  picked?: unknown[];
  budgetExplanation?: string;
  budgetTips?: string[];
};

type CacheRow = {
  payload: string;
  created_at: string;
  expires_at: string;
};

export function ensureMuseCache(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS muse_plan_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

export function stablePlanCacheKey(input: {
  hangoutId?: string | null;
  city: string;
  windowStart: string;
  windowEnd: string;
  budgetTier: number;
  interests: string[];
  candidateIds: string[];
  viewType: string;
}): string {
  const normalized = {
    v: 'plan-stable-v2',
    hangoutId: (input.hangoutId || '').trim(),
    city: input.city.trim().toLowerCase().replace(/\s+/g, ' '),
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    budgetTier: input.budgetTier,
    interests: [...input.interests].map((item) => item.toLowerCase()).sort(),
    candidateIds: [...new Set(input.candidateIds.filter(Boolean))].sort(),
    viewType: input.viewType,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function musePlanCacheKey(input: MuseCacheInput): string {
  const friends = [...(input.preferences.friends || [])]
    .map((friend) => ({
      id: friend.id || '',
      name: (friend.name || '').trim().toLowerCase(),
      budget: friend.budgetPreference ?? null,
      interests: [...(friend.topInterests || [])].map((item) => item.toLowerCase()).sort(),
      slots: [...(friend.availabilitySlots || [])]
        .map((slot) => `${slot.startTime || ''}-${slot.endTime || ''}`)
        .sort(),
    }))
    .sort((left, right) => left.id.localeCompare(right.id) || left.name.localeCompare(right.name));

  const activities = [...input.activities]
    .map((activity) => ({
      id: activity.id || '',
      name: (activity.name || '').trim().toLowerCase(),
      category: activity.category || '',
      cost: activity.estimatedCostPerPerson ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id) || left.name.localeCompare(right.name));

  const normalized = {
    model: input.model || '',
    viewType: input.viewType,
    groupName: (input.preferences.groupName || '').trim().toLowerCase(),
    location: (input.preferences.location || '').trim().toLowerCase(),
    date: input.preferences.date || '',
    timePreference: input.preferences.timePreference || '',
    maxBudgetPerPerson: input.preferences.maxBudgetPerPerson ?? null,
    interests: [...(input.preferences.selectedInterests || [])].map((item) => item.toLowerCase()).sort(),
    friends,
    activities,
    budget: input.budget
      ? {
          source: input.budget.source || '',
          suggestedPerPerson: input.budget.suggestedPerPerson ?? null,
          balance: input.budget.balance ?? null,
          discretionary: input.budget.discretionary ?? null,
        }
      : null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function readMuseCache(db: DatabaseSync, cacheKey: string, now: Date): MuseCachePayload | null {
  ensureMuseCache(db);
  const row = db.prepare(`SELECT payload, created_at, expires_at FROM muse_plan_cache WHERE cache_key = ?`).get(cacheKey) as
    | CacheRow
    | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) <= now.getTime()) {
    db.prepare(`DELETE FROM muse_plan_cache WHERE cache_key = ?`).run(cacheKey);
    return null;
  }
  try {
    const payload = JSON.parse(row.payload) as Omit<MuseCachePayload, 'createdAt'>;
    if (!payload.aiRationale) return null;
    return { ...payload, createdAt: row.created_at };
  } catch {
    return null;
  }
}

export function writeMuseCache(
  db: DatabaseSync,
  cacheKey: string,
  payload: Omit<MuseCachePayload, 'createdAt'>,
  now: Date,
  ttlMs: number
) {
  ensureMuseCache(db);
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  db.prepare(
    `INSERT INTO muse_plan_cache (cache_key, payload, created_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       created_at = excluded.created_at,
       expires_at = excluded.expires_at`
  ).run(cacheKey, JSON.stringify(payload), createdAt, expiresAt);
}

export function deleteExpiredMuseCache(db: DatabaseSync, now: Date): number {
  ensureMuseCache(db);
  const rows = db
    .prepare(`SELECT cache_key FROM muse_plan_cache WHERE expires_at <= ?`)
    .all(now.toISOString()) as Array<{ cache_key: string }>;
  const remove = db.prepare(`DELETE FROM muse_plan_cache WHERE cache_key = ?`);
  for (const row of rows) remove.run(row.cache_key);
  return rows.length;
}
