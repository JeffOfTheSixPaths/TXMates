import type { DatabaseSync } from 'node:sqlite';
import type { Activity } from '@/types';
import { classifyListing } from './activityClassify';
import { activityPolicy, isQueryFresh, type ActivityPolicy } from './activityPolicy';
import {
  cleanupActivities,
  discoveryCacheKey,
  getQueryRefreshedAt,
  searchSavedActivities,
  toActivity,
} from './activityStore';
import { searchCatalog } from './catalogSearch';
import {
  buildSearchText,
  openSerpBaseUrl,
  refreshDiscoveryQuery,
  scheduleDiscoveryRefresh,
  scheduleMuseClassification,
} from './discoverySearch';
import { MOCK_ACTIVITIES } from './mockData';
import { openSerpTimeoutMs } from './serviceTimeouts';

export type DiscoveryPayload = {
  source: 'openserp' | 'saved' | 'fallback';
  isLive: boolean;
  refreshing: boolean;
  relaxed: boolean;
  notice: string | null;
  queryUsed: string;
  activities: Activity[];
};

export type DiscoverInput = {
  query?: string;
  category?: string;
  location?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
  policy?: ActivityPolicy;
  allowMuse?: boolean;
};

export async function discoverActivities(db: DatabaseSync, input: DiscoverInput = {}): Promise<DiscoveryPayload> {
  const now = input.now ?? new Date();
  const policy = input.policy ?? activityPolicy();
  const location = input.location?.trim() || 'Austin, TX';
  const category = input.category?.trim() || 'all';
  const query = input.query?.trim() || '';
  const queryUsed = buildSearchText(location, category, query);
  const allowMuse = input.allowMuse !== false;

  cleanupActivities(db, now, policy);

  const saved = searchSavedActivities(db, { query, category });
  const cacheKey = discoveryCacheKey(location, category, query);
  const fresh = isQueryFresh(getQueryRefreshedAt(db, cacheKey), now, policy.cacheTtlMs);

  if (saved.rows.length > 0) {
    if (!fresh) {
      scheduleDiscoveryRefresh(db, {
        location,
        category,
        query,
        now,
        fetchImpl: input.fetchImpl,
        policy,
        allowMuse,
      });
    }
    return {
      source: 'saved',
      isLive: false,
      refreshing: !fresh,
      relaxed: saved.relaxed,
      notice: savedNotice(saved.relaxed, !fresh, query),
      queryUsed,
      activities: saved.rows.map((row) => toActivity(row, 'saved')),
    };
  }

  if (fresh) return fallbackPayload(category, query, queryUsed);

  const refreshed = await refreshDiscoveryQuery(db, {
    location,
    category,
    query,
    now,
    fetchImpl: input.fetchImpl,
    policy,
    allowMuse: false,
  });

  if (refreshed.ok) {
    if (allowMuse) scheduleMuseClassification(db, refreshed.ids, input.fetchImpl);
    const again = searchSavedActivities(db, { query, category });
    if (again.rows.length > 0) {
      const liveIds = new Set(refreshed.ids);
      return {
        source: 'openserp',
        isLive: true,
        refreshing: false,
        relaxed: again.relaxed,
        notice: again.relaxed ? relaxedNotice(query) : null,
        queryUsed,
        activities: again.rows.map((row) => toActivity(row, liveIds.has(row.id) ? 'live' : 'saved')),
      };
    }
  }

  return fallbackPayload(category, query, queryUsed);
}

function fallbackPayload(category: string, query: string, queryUsed: string): DiscoveryPayload {
  const pool = MOCK_ACTIVITIES.filter((activity) => category === 'all' || activity.category === category).map(
    (activity) => {
      const classification = classifyListing({ title: activity.name, snippet: activity.description });
      return {
        ...activity,
        isLiveResult: false,
        kind: classification.kind,
        startDate: classification.startDate,
        endDate: classification.endDate,
        uncertainties: ['Demo catalog item. OpenSERP has not saved a live result for this search yet.'],
      };
    }
  );
  const ranked = searchCatalog(pool, query);
  const timeout = openSerpTimeoutMs();
  const base = openSerpBaseUrl();
  const notice = ranked.relaxed
    ? `Nothing matched "${query}". Showing the wider Austin demo list. OpenSERP did not answer at ${base} within ${timeout}ms, and nothing saved matched either.`
    : `OpenSERP did not answer at ${base} within ${timeout}ms, and nothing is saved for this search yet. Serving the curated Austin demo catalog.`;
  return {
    source: 'fallback',
    isLive: false,
    refreshing: false,
    relaxed: ranked.relaxed,
    notice,
    queryUsed,
    activities: ranked.activities,
  };
}

function savedNotice(relaxed: boolean, refreshing: boolean, query: string): string {
  if (relaxed && refreshing) {
    return `Nothing matched "${query}". Showing the wider saved list while OpenSERP refreshes this search.`;
  }
  if (relaxed) {
    return `Nothing matched "${query}". Showing the wider saved list instead of an empty one.`;
  }
  if (refreshing) {
    return 'Saved spots are on screen. OpenSERP is refreshing this search in the background.';
  }
  return 'Saved spots from this machine. A new OpenSERP check runs once this search is a few hours old.';
}

function relaxedNotice(query: string): string {
  return `Nothing matched "${query}". Showing the wider list instead of an empty one.`;
}

