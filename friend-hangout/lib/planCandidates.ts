import type { Activity, ActivityCategory, HangoutPreferences } from '@/types';
import { inferActivityCategory, isGeneralPlanQuery } from './activityCategory';
import { searchCatalog } from './catalogSearch';
import { curatedActivitiesForLocation, curatedDayParts, type DayPart } from './curatedActivities';
import { isListicleListing } from './musePlan';

const PART_ORDER: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];

export function isJunkPlanListing(activity: { id?: string; name: string; sourceUrl?: string }): boolean {
  return Boolean(activity.id?.startsWith('dyn-')) || isListicleListing(activity.name, activity.sourceUrl);
}

export function reclassifyActivity(activity: Activity): Activity {
  if (activity.id.startsWith('curated-') || activity.resultFreshness === 'catalog') return activity;
  const inferred = inferActivityCategory({
    title: activity.name,
    snippet: `${activity.description || ''} ${activity.neighborhood || ''}`,
    query: activity.sourceQuery,
  });
  if (inferred.category === activity.category && inferred.label === activity.categoryLabel) return activity;
  return { ...activity, category: inferred.category, categoryLabel: inferred.label };
}

function normalizedName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function dedupeActivities(activities: Activity[]): Activity[] {
  const byName = new Map<string, Activity>();
  for (const activity of activities) {
    const key = activity.id || normalizedName(activity.name);
    const nameKey = normalizedName(activity.name) || key;
    const existing = byName.get(nameKey);
    if (!existing) {
      byName.set(nameKey, activity);
      continue;
    }
    if (!existing.id.startsWith('curated-') && activity.id.startsWith('curated-')) {
      byName.set(nameKey, activity);
    }
  }
  return [...byName.values()];
}

/** General city searches stay. One-off topic searches contribute at most one hit per category. */
export function limitDiscoveredForPlan(activities: Activity[]): Activity[] {
  const usable = activities.map(reclassifyActivity).filter((activity) => !isJunkPlanListing(activity));
  const general: Activity[] = [];
  const narrow: Activity[] = [];
  for (const activity of usable) {
    if (isGeneralPlanQuery(activity.sourceQuery || '')) general.push(activity);
    else narrow.push(activity);
  }
  const seen = new Set<string>();
  const capped: Activity[] = [];
  for (const activity of narrow) {
    const key = `${activity.category}|${(activity.sourceQuery || '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    capped.push(activity);
  }
  if (general.length >= 3) return dedupeActivities([...general, ...capped.slice(0, 4)]);
  return dedupeActivities([...general, ...capped]);
}

export function assemblePlanCandidates(input: {
  discovered?: Activity[];
  extra?: Activity[];
  location: string;
  interests?: ActivityCategory[];
}): Activity[] {
  const discovered = limitDiscoveredForPlan(input.discovered || []);
  const curated = curatedActivitiesForLocation(input.location);
  const interests = input.interests || [];
  const scoped = interests.length ? curated.filter((activity) => interests.includes(activity.category)) : curated;
  const curatedPool = scoped.length >= 3 ? scoped : curated;
  const extras = (input.extra || []).map(reclassifyActivity).filter((activity) => !isJunkPlanListing(activity));
  return dedupeActivities([...discovered, ...extras, ...curatedPool]);
}

export function dayPartsOf(activity: { tags?: string[]; popularTimes?: string }): DayPart[] {
  const tagged = curatedDayParts(activity);
  if (tagged.length > 0) return tagged;
  const text = (activity.popularTimes || '').toLowerCase();
  const found: DayPart[] = [];
  if (/morning|breakfast/.test(text)) found.push('morning');
  if (/afternoon|lunch|midday/.test(text)) found.push('afternoon');
  if (/evening|sunset|dinner/.test(text)) found.push('evening');
  if (/\bnight\b|late/.test(text)) found.push('night');
  return found;
}

export function prefersWindow(
  activity: { tags?: string[]; popularTimes?: string },
  preference?: HangoutPreferences['timePreference']
): boolean {
  const parts = dayPartsOf(activity);
  if (parts.length === 0 || !preference || preference === 'all-day') return true;
  if (preference === 'afternoon') return parts.some((part) => part === 'morning' || part === 'afternoon' || part === 'evening');
  if (preference === 'evening') return parts.some((part) => part === 'afternoon' || part === 'evening' || part === 'night');
  return parts.some((part) => part === 'evening' || part === 'night');
}

export function takeVaried<T extends { id: string; category: string }>(pool: T[], count: number): T[] {
  const selected: T[] = [];
  const used = new Set<string>();
  for (const activity of pool) {
    if (selected.length >= count) break;
    if (used.has(activity.category)) continue;
    selected.push(activity);
    used.add(activity.category);
  }
  if (selected.length < count) {
    for (const activity of pool) {
      if (selected.length >= count) break;
      if (selected.some((item) => item.id === activity.id)) continue;
      selected.push(activity);
    }
  }
  return selected;
}

export function orderForDay<T extends { tags?: string[]; popularTimes?: string }>(
  activities: T[],
  preference?: HangoutPreferences['timePreference']
): T[] {
  const score = (activity: T) => {
    const parts = dayPartsOf(activity);
    if (parts.length === 0) return 1;
    if (preference === 'night') {
      if (parts.includes('night')) return 2;
      if (parts.includes('evening')) return 1;
      return 0;
    }
    return Math.min(...parts.map((part) => PART_ORDER.indexOf(part)));
  };
  return [...activities].sort((left, right) => score(left) - score(right));
}

export function selectPlanStops(
  candidates: Activity[],
  preferences: Pick<HangoutPreferences, 'maxBudgetPerPerson' | 'selectedInterests' | 'timePreference'>,
  limit = 3
): Activity[] {
  let pool = candidates.filter((activity) => !isJunkPlanListing(activity));
  const cap = preferences.maxBudgetPerPerson;
  if (cap > 0) {
    const affordable = pool.filter((activity) => activity.estimatedCostPerPerson <= cap);
    if (affordable.length >= limit) pool = affordable;
  }
  const interests = preferences.selectedInterests || [];
  if (interests.length > 0) {
    const matched = pool.filter((activity) => interests.includes(activity.category));
    if (matched.length >= limit) pool = matched;
  }
  const timed = pool.filter((activity) => prefersWindow(activity, preferences.timePreference));
  if (timed.length >= limit) pool = timed;
  const ranked = [...pool].sort((left, right) => {
    const signature = Number(right.tags?.includes('signature')) - Number(left.tags?.includes('signature'));
    if (signature !== 0) return signature;
    return left.estimatedCostPerPerson - right.estimatedCostPerPerson;
  });
  return orderForDay(takeVaried(ranked, limit), preferences.timePreference);
}

/** Round-robin by category so Muse sees more than one theme. */
export function diverseCandidates(activities: Activity[], limit: number): Activity[] {
  const buckets = new Map<string, Activity[]>();
  for (const activity of activities) {
    const list = buckets.get(activity.category) || [];
    list.push(activity);
    buckets.set(activity.category, list);
  }
  const categories = [...buckets.keys()];
  const picked: Activity[] = [];
  let index = 0;
  while (picked.length < limit) {
    let added = false;
    for (const category of categories) {
      const bucket = buckets.get(category) || [];
      const next = bucket[index];
      if (!next) continue;
      picked.push(next);
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
    index += 1;
  }
  return picked;
}

const DISCOVERY_CURATED_LEAD = 6;

/**
 * Live and saved hits stay. Curated venues for this city and category are always
 * mixed in, with a few real places at the front. A specific query only adds
 * curated venues that match the topic, so a miss does not dump the whole city.
 */
export function withCuratedFallback(
  activities: Activity[],
  input: { location?: string; category?: string; query?: string }
): Activity[] {
  const kept = activities
    .map((activity) => reclassifyActivity({ ...activity, sourceQuery: activity.sourceQuery || input.query }))
    .filter((activity) => !isJunkPlanListing(activity));
  const category = input.category || 'all';
  const curated = curatedForDiscovery(input.location, category, (input.query || '').trim());
  const lead = leadCurated(curated, category);
  return dedupeActivities([...lead, ...kept, ...curated]);
}

function curatedForDiscovery(location: string | undefined, category: string, query: string): Activity[] {
  const curated = curatedActivitiesForLocation(location).filter(
    (activity) => category === 'all' || activity.category === category
  );
  if (!query || isGeneralPlanQuery(query)) return curated;
  const city = (location || '').replace(/\(.*?\)/g, '').split(',')[0]?.trim() || '';
  const topic = city ? query.replace(new RegExp(`\\b${escapeRegExp(city)}\\b`, 'ig'), ' ') : query;
  const ranked = searchCatalog(curated, topic);
  return ranked.relaxed ? [] : ranked.activities;
}

function leadCurated(curated: Activity[], category: string): Activity[] {
  if (category !== 'all') return curated;
  const ranked = [...curated].sort(
    (left, right) =>
      Number(Boolean(right.tags?.includes('signature'))) - Number(Boolean(left.tags?.includes('signature')))
  );
  return takeVaried(ranked, DISCOVERY_CURATED_LEAD);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
