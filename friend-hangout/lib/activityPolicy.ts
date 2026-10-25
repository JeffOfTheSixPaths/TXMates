import { resolveTimeoutMs } from './serviceTimeouts';

export type ActivityPolicy = {
  cacheTtlMs: number;
  eventTtlDays: number;
  placeStaleDays: number;
  placeRecheckDays: number;
  recheckLimit: number;
  museCacheTtlMs: number;
};

const HOUR_MS = 3_600_000;

export function activityPolicy(env: NodeJS.ProcessEnv = process.env): ActivityPolicy {
  const cacheHours = resolveTimeoutMs(env.ACTIVITY_CACHE_TTL_HOURS, 8, 1, 24);
  const eventTtlDays = resolveTimeoutMs(env.ACTIVITY_EVENT_TTL_DAYS, 30, 1, 365);
  const placeStaleDays = resolveTimeoutMs(env.ACTIVITY_PLACE_STALE_DAYS, 60, 1, 365);
  let placeRecheckDays = resolveTimeoutMs(env.ACTIVITY_PLACE_RECHECK_DAYS, 30, 1, 365);
  if (placeRecheckDays >= placeStaleDays) {
    placeRecheckDays = Math.max(1, placeStaleDays - 1);
  }
  const museCacheHours = resolveTimeoutMs(env.MUSE_CACHE_TTL_HOURS, 12, 1, 168);
  return {
    cacheTtlMs: cacheHours * HOUR_MS,
    eventTtlDays,
    placeStaleDays,
    placeRecheckDays,
    recheckLimit: resolveTimeoutMs(env.ACTIVITY_RECHECK_LIMIT, 8, 1, 50),
    museCacheTtlMs: museCacheHours * HOUR_MS,
  };
}

export function isQueryFresh(refreshedAt: string | null, now: Date, ttlMs: number): boolean {
  if (!refreshedAt) return false;
  const then = Date.parse(refreshedAt);
  if (!Number.isFinite(then)) return false;
  return now.getTime() - then < ttlMs;
}

export function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
