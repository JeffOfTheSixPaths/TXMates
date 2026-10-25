import { DatabaseSync } from 'node:sqlite';
import { civilDate } from './activityClassify';

export type MuseTokenUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type MuseCallStatus = 'ok' | 'error';

export const DEFAULT_MUSE_MAX_CALLS_PER_DAY = 200;
const MAX_CALLS_CAP = 1000;

export function museMaxCallsPerDay(raw?: string): number {
  const value = raw === undefined ? process.env.MUSE_MAX_CALLS_PER_DAY : raw;
  if (value === undefined || value.trim() === '') return DEFAULT_MUSE_MAX_CALLS_PER_DAY;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MUSE_MAX_CALLS_PER_DAY;
  return Math.min(Math.round(parsed), MAX_CALLS_CAP);
}

export function ensureMuseUsage(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS muse_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      called_at TEXT NOT NULL,
      purpose TEXT NOT NULL,
      cache_key TEXT,
      model TEXT,
      status TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_muse_calls_day ON muse_calls (day, status);

    CREATE TABLE IF NOT EXISTS muse_response_cache (
      cache_key TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

export function museCallsToday(db: DatabaseSync, now = new Date()): number {
  ensureMuseUsage(db);
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM muse_calls WHERE day = ? AND status IN ('ok', 'error')`)
    .get(civilDate(now)) as { n: number } | undefined;
  return Number(row?.n || 0);
}

export function museCallAllowed(db: DatabaseSync, now = new Date(), limit = museMaxCallsPerDay()): boolean {
  if (limit <= 0) return false;
  return museCallsToday(db, now) < limit;
}

export function recordMuseCall(
  db: DatabaseSync,
  input: {
    purpose: string;
    cacheKey?: string | null;
    model?: string | null;
    status: MuseCallStatus;
    usage?: MuseTokenUsage | null;
    now?: Date;
  }
) {
  ensureMuseUsage(db);
  const now = input.now ?? new Date();
  db.prepare(
    `INSERT INTO muse_calls (
      day, called_at, purpose, cache_key, model, status, prompt_tokens, completion_tokens, total_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    civilDate(now),
    now.toISOString(),
    input.purpose,
    input.cacheKey || null,
    input.model || null,
    input.status,
    input.usage?.promptTokens ?? null,
    input.usage?.completionTokens ?? null,
    input.usage?.totalTokens ?? null
  );
}

export function readMuseContentCache(db: DatabaseSync, cacheKey: string, now = new Date()): string | null {
  ensureMuseUsage(db);
  const row = db
    .prepare(`SELECT content, expires_at FROM muse_response_cache WHERE cache_key = ?`)
    .get(cacheKey) as { content: string; expires_at: string } | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) <= now.getTime()) {
    db.prepare(`DELETE FROM muse_response_cache WHERE cache_key = ?`).run(cacheKey);
    return null;
  }
  return row.content;
}

export function writeMuseContentCache(
  db: DatabaseSync,
  input: { cacheKey: string; purpose: string; content: string; now?: Date; ttlMs: number }
) {
  ensureMuseUsage(db);
  const now = input.now ?? new Date();
  db.prepare(
    `INSERT INTO muse_response_cache (cache_key, purpose, content, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       content = excluded.content,
       created_at = excluded.created_at,
       expires_at = excluded.expires_at`
  ).run(
    input.cacheKey,
    input.purpose,
    input.content,
    now.toISOString(),
    new Date(now.getTime() + input.ttlMs).toISOString()
  );
}

export function tokenUsageFromApi(payload: unknown): MuseTokenUsage | null {
  if (!payload || typeof payload !== 'object') return null;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== 'object') return null;
  const record = usage as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
  const prompt = numberOrNull(record.prompt_tokens);
  const completion = numberOrNull(record.completion_tokens);
  const total = numberOrNull(record.total_tokens);
  if (prompt === null && completion === null && total === null) return null;
  return { promptTokens: prompt, completionTokens: completion, totalTokens: total };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
