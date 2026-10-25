import type { Activity, ActivityCategory, HangoutPreferences, ItineraryItem } from '@/types';
import { coverageCount, parseSlotLabel } from './availabilityHeat';
import { searchCatalog } from './catalogSearch';
import { buildItinerary, TRAVEL_BUFFER_MINUTES } from './planner';

export { TRAVEL_BUFFER_MINUTES };

export type ItineraryEditState = {
  items: ItineraryItem[];
  locked: boolean;
};

export type ItineraryEditAction =
  | { type: 'reorder'; from: number; to: number }
  | { type: 'swap'; index: number; activity: Activity }
  | { type: 'lock' }
  | { type: 'unlock' };

export type SpendSummary = {
  totalCostPerPerson: number;
  totalGroupCost: number;
  savingsPerPerson: number;
  budgetUtilizationPercentage: number;
  budgetStatus: 'under' | 'on-target' | 'over';
  summary: string;
};

export type SwapFilterResult = {
  activities: Activity[];
  hidden: {
    expired: number;
    budget: number;
    availability: number;
    alreadyOnItinerary: number;
  };
};

export function indexFromPointer(clientY: number, midpoints: number[]): number {
  if (midpoints.length === 0) return 0;
  let target = 0;
  for (let i = 0; i < midpoints.length; i++) {
    const mid = midpoints[i];
    if (mid === undefined) continue;
    if (clientY > mid) target = Math.min(midpoints.length - 1, i + 1);
    else break;
  }
  return target;
}

export function reorderItinerary(
  items: ItineraryItem[],
  from: number,
  to: number,
  preferences: HangoutPreferences
): ItineraryItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const activities = items.map((item) => item.activity);
  const [moved] = activities.splice(from, 1);
  if (!moved) return items;
  activities.splice(to, 0, moved);
  return buildItinerary(activities, preferences);
}

export function swapItineraryStop(
  items: ItineraryItem[],
  index: number,
  activity: Activity,
  preferences: HangoutPreferences
): ItineraryItem[] {
  if (index < 0 || index >= items.length) return items;
  if (items[index]?.activity.id === activity.id) return items;
  const activities = items.map((item, itemIndex) => (itemIndex === index ? activity : item.activity));
  return buildItinerary(activities, preferences);
}

export function editItinerary(
  state: ItineraryEditState,
  action: ItineraryEditAction,
  preferences: HangoutPreferences
): ItineraryEditState {
  if (action.type === 'lock') return { items: state.items, locked: true };
  if (action.type === 'unlock') return { items: state.items, locked: false };
  if (state.locked) return state;
  if (action.type === 'reorder') {
    return { locked: false, items: reorderItinerary(state.items, action.from, action.to, preferences) };
  }
  return { locked: false, items: swapItineraryStop(state.items, action.index, action.activity, preferences) };
}

export function spendSummary(items: ItineraryItem[], friendCount: number, maxBudget: number): SpendSummary {
  const totalCostPerPerson = items.reduce((sum, item) => sum + item.activity.estimatedCostPerPerson, 0);
  const totalGroupCost = totalCostPerPerson * (friendCount || 1);
  const savingsPerPerson = Math.max(0, maxBudget - totalCostPerPerson);
  const budgetUtilizationPercentage = Math.min(
    150,
    Math.round((totalCostPerPerson / (maxBudget || 1)) * 100)
  );
  let budgetStatus: SpendSummary['budgetStatus'] = 'on-target';
  if (totalCostPerPerson < maxBudget * 0.75) budgetStatus = 'under';
  else if (totalCostPerPerson > maxBudget) budgetStatus = 'over';

  let summary = `$${totalCostPerPerson.toFixed(0)} a person uses ${budgetUtilizationPercentage}% of the $${maxBudget} cap.`;
  if (budgetStatus === 'under') {
    summary = `About $${savingsPerPerson.toFixed(0)} a person is left under the $${maxBudget} cap.`;
  } else if (budgetStatus === 'over') {
    summary = `This plan is $${(totalCostPerPerson - maxBudget).toFixed(0)} a person over the $${maxBudget} cap.`;
  }
  return {
    totalCostPerPerson,
    totalGroupCost,
    savingsPerPerson,
    budgetUtilizationPercentage,
    budgetStatus,
    summary,
  };
}

export function eventBlocked(activity: Activity, today: string, hangoutDate: string): boolean {
  if (activity.kind !== 'event') return false;
  const start = activity.startDate || null;
  const end = activity.endDate || activity.startDate || null;
  if (!start && !end) return false;
  if (end && end < today) return true;
  if (start && hangoutDate < start) return true;
  if (end && hangoutDate > end) return true;
  return false;
}

export function swapRespectsBudget(
  items: ItineraryItem[],
  index: number,
  candidate: Activity,
  maxBudget: number
): boolean {
  if (candidate.estimatedCostPerPerson > maxBudget) return false;
  const current = items[index]?.activity.estimatedCostPerPerson ?? 0;
  const nextTotal = items.reduce((sum, item, itemIndex) => {
    return sum + (itemIndex === index ? candidate.estimatedCostPerPerson : item.activity.estimatedCostPerPerson);
  }, 0);
  if (nextTotal <= maxBudget) return true;
  return candidate.estimatedCostPerPerson <= current;
}

export function swapRespectsAvailability(
  items: ItineraryItem[],
  index: number,
  candidate: Activity,
  preferences: HangoutPreferences
): boolean {
  if (preferences.friends.length === 0) return true;
  const activities = items.map((item, itemIndex) => (itemIndex === index ? candidate : item.activity));
  const next = buildItinerary(activities, preferences);
  return next.every((item) => {
    const slot = parseSlotLabel(item.timeSlot);
    if (!slot) return true;
    return coverageCount(preferences.friends, slot.start, slot.end).count > 0;
  });
}

export function filterSwapCandidates(input: {
  pool: Activity[];
  itinerary: ItineraryItem[];
  index: number;
  preferences: HangoutPreferences;
  today: string;
  query?: string;
  category?: ActivityCategory | 'all';
}): SwapFilterResult {
  const hidden = { expired: 0, budget: 0, availability: 0, alreadyOnItinerary: 0 };
  const scheduled = new Set(input.itinerary.map((item) => item.activity.id));
  const available: Activity[] = [];
  for (const activity of input.pool) {
    if (scheduled.has(activity.id)) {
      hidden.alreadyOnItinerary += 1;
      continue;
    }
    available.push(activity);
  }

  const category = input.category && input.category !== 'all' ? input.category : null;
  const categorized = category ? available.filter((activity) => activity.category === category) : available;
  const query = input.query?.trim() || '';
  let searched = categorized;
  if (query) {
    const result = searchCatalog(categorized, query);
    searched = result.relaxed ? [] : result.activities;
  }

  const activities: Activity[] = [];
  for (const activity of searched) {
    if (eventBlocked(activity, input.today, input.preferences.date)) {
      hidden.expired += 1;
      continue;
    }
    if (!swapRespectsBudget(input.itinerary, input.index, activity, input.preferences.maxBudgetPerPerson)) {
      hidden.budget += 1;
      continue;
    }
    if (!swapRespectsAvailability(input.itinerary, input.index, activity, input.preferences)) {
      hidden.availability += 1;
      continue;
    }
    activities.push(activity);
  }
  return { activities, hidden };
}
