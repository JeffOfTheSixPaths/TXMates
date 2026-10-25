import type { DatabaseSync } from 'node:sqlite';
import type { Activity } from '@/types';
import { classifyListing } from './activityClassify';
import { activityPolicy, isQueryFresh, type ActivityPolicy } from './activityPolicy';
import {
  cleanupActivities,
  discoveryCacheKey,
  getActivityRow,
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
import { catalogActivitiesForSearch } from './eventCatalog';
import { getActivitiesForLocation } from './mockData';
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
  awaitMuse?: boolean;
  catalogActivities?: Activity[];
};

export async function discoverActivities(db: DatabaseSync, input: DiscoverInput = {}): Promise<DiscoveryPayload> {
  const now = input.now ?? new Date();
  const policy = input.policy ?? activityPolicy();
  const location = input.location?.trim() || 'Austin, TX';
  const category = input.category?.trim() || 'all';
  const query = input.query?.trim() || '';
  const queryUsed = buildSearchText(location, category, query);
  const allowMuse = input.allowMuse !== false;
  const awaitMuse = Boolean(input.awaitMuse);

  cleanupActivities(db, now, policy);

  const catalog = catalogActivitiesForSearch(category, query, now, location, input.catalogActivities);
  const withCatalog = (activities: Activity[]) => mergeActivities(activities, catalog);

  const saved = searchSavedActivities(db, { query, category, location });
  const cacheKey = discoveryCacheKey(location, category, query);
  const fresh = isQueryFresh(getQueryRefreshedAt(db, cacheKey), now, policy.cacheTtlMs);

  if (query && saved.relaxed) {
    const fromThisSearch = saved.rows.filter((row) => row.source_query === queryUsed);
    if (fromThisSearch.length > 0) {
      return {
        source: 'saved',
        isLive: false,
        refreshing: false,
        relaxed: false,
        notice: null,
        queryUsed,
        activities: withCatalog(fromThisSearch.map((row) => toActivity(row, 'saved'))),
      };
    }

    if (!fresh) {
      const refreshed = await refreshDiscoveryQuery(db, {
        location,
        category,
        query,
        now,
        fetchImpl: input.fetchImpl,
        policy,
        allowMuse,
        awaitMuse,
      });
      if (refreshed.ok && refreshed.ids.length > 0) {
        if (allowMuse && !awaitMuse) scheduleMuseClassification(db, refreshed.ids, input.fetchImpl);
        const liveRows = refreshed.ids
          .map((id) => getActivityRow(db, id))
          .filter((row): row is NonNullable<typeof row> => Boolean(row));
        if (liveRows.length > 0) {
          return {
            source: 'openserp',
            isLive: true,
            refreshing: false,
            relaxed: false,
            notice: null,
            queryUsed,
            activities: withCatalog(liveRows.map((row) => toActivity(row, 'live'))),
          };
        }
      }
    }

    if (saved.rows.length > 0) {
      return {
        source: 'saved',
        isLive: false,
        refreshing: false,
        relaxed: true,
        notice: widerAfterMiss(query),
        queryUsed,
        activities: withCatalog(saved.rows.map((row) => toActivity(row, 'saved'))),
      };
    }

    return fallbackPayload(category, query, queryUsed, catalog, location);
  }

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
      activities: withCatalog(saved.rows.map((row) => toActivity(row, 'saved'))),
    };
  }

  if (fresh) return fallbackPayload(category, query, queryUsed, catalog, location);

  const refreshed = await refreshDiscoveryQuery(db, {
    location,
    category,
    query,
    now,
    fetchImpl: input.fetchImpl,
    policy,
    allowMuse,
    awaitMuse,
  });

  if (refreshed.ok) {
    if (allowMuse && !awaitMuse) scheduleMuseClassification(db, refreshed.ids, input.fetchImpl);
    const again = searchSavedActivities(db, { query, category, location });
    if (again.rows.length > 0) {
      const liveIds = new Set(refreshed.ids);
      return {
        source: 'openserp',
        isLive: true,
        refreshing: false,
        relaxed: again.relaxed,
        notice: again.relaxed ? relaxedNotice(query) : null,
        queryUsed,
        activities: withCatalog(again.rows.map((row) => toActivity(row, liveIds.has(row.id) ? 'live' : 'saved'))),
      };
    }
  }

  return fallbackPayload(category, query, queryUsed, catalog, location);
}

function mergeActivities(activities: Activity[], catalog: Activity[]): Activity[] {
  if (catalog.length === 0) return activities;
  const seen = new Set(activities.map((activity) => activity.id));
  const merged = activities.slice();
  for (const activity of catalog) {
    if (seen.has(activity.id)) continue;
    seen.add(activity.id);
    merged.push(activity);
  }
  return merged;
}

function fallbackPayload(
  category: string,
  query: string,
  queryUsed: string,
  catalog: Activity[],
  location?: string
): DiscoveryPayload {
  const city = location?.trim() || 'Austin, TX';
  const cleanCity = city.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || 'Austin';
  const pool = [
    ...catalog,
    ...getActivitiesForLocation(city)
      .filter((activity) => category === 'all' || activity.category === category)
      .map((activity) => {
        const classification = classifyListing({ title: activity.name, snippet: activity.description });
        return {
          ...activity,
          isLiveResult: false,
          kind: classification.kind,
          startDate: classification.startDate,
          endDate: classification.endDate,
          uncertainties: [`Curated ${cleanCity} venue catalog with verified neighborhood and realistic pricing`],
        };
      }),
  ];
  const ranked = searchCatalog(pool, query);
  const timeout = openSerpTimeoutMs();
  const base = openSerpBaseUrl();
  const hasCatalog = ranked.activities.some((activity) => activity.resultFreshness === 'catalog');
  const onlyCatalog = hasCatalog && ranked.activities.every((activity) => activity.resultFreshness === 'catalog');
  const notice = ranked.relaxed
    ? `Nothing matched "${query}". Showing the wider ${cleanCity} demo list. OpenSERP did not answer at ${base} within ${timeout}ms, and nothing saved matched either.`
    : onlyCatalog
      ? `OpenSERP did not answer at ${base} within ${timeout}ms. Showing upcoming ${cleanCity} events from the saved calendar.`
      : hasCatalog
        ? `OpenSERP did not answer at ${base} within ${timeout}ms, and nothing is saved for this search yet. Showing upcoming ${cleanCity} events and the demo catalog.`
        : `OpenSERP did not answer at ${base} within ${timeout}ms, and nothing is saved for this search yet. Serving the curated ${cleanCity} demo catalog.`;
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

function widerAfterMiss(query: string): string {
  return `Nothing matched "${query}". OpenSERP did not return results, so this is the wider saved list.`;
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
