import {
  Activity,
  ActivityCategory,
  HangoutPlan,
  HangoutPreferences,
  ItineraryItem,
  PlanningViewType,
  Friend,
} from '@/types';
import { MOCK_ACTIVITIES } from './mockData';

/**
 * Calculates common availability overlap among friends
 */
export function calculateAvailabilityOverlap(friends: Friend[]): {
  commonStart: string;
  commonEnd: string;
  overlapHours: number;
  availableFriendCount: number;
  allFriendsAvailable: boolean;
} {
  if (friends.length === 0) {
    return {
      commonStart: '14:00',
      commonEnd: '20:00',
      overlapHours: 6,
      availableFriendCount: 0,
      allFriendsAvailable: false,
    };
  }

  // Parse earliest end and latest start
  let latestStartMinutes = 0;
  let earliestEndMinutes = 24 * 60;

  let fullyOverlappingFriends = 0;

  friends.forEach((friend) => {
    if (friend.availabilitySlots.length > 0) {
      const slot = friend.availabilitySlots[0];
      const [startH, startM] = slot.startTime.split(':').map(Number);
      const [endH, endM] = slot.endTime.split(':').map(Number);

      const startMinutes = (startH || 0) * 60 + (startM || 0);
      const endMinutes = (endH || 0) * 60 + (endM || 0);

      if (startMinutes > latestStartMinutes) latestStartMinutes = startMinutes;
      if (endMinutes < earliestEndMinutes) earliestEndMinutes = endMinutes;
      fullyOverlappingFriends++;
    }
  });

  const validOverlap = earliestEndMinutes > latestStartMinutes;
  const startMinutes = validOverlap ? latestStartMinutes : 14 * 60; // 2:00 PM fallback
  const endMinutes = validOverlap ? earliestEndMinutes : 20 * 60;   // 8:00 PM fallback
  const overlapHours = Math.max(1, (endMinutes - startMinutes) / 60);

  const formatTime = (minutes: number) => {
    const h24 = Math.floor(minutes / 60);
    const m = minutes % 60;
    const padM = m < 10 ? `0${m}` : `${m}`;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    return `${h12}:${padM} ${ampm}`;
  };

  return {
    commonStart: formatTime(startMinutes),
    commonEnd: formatTime(endMinutes),
    overlapHours: Math.round(overlapHours * 10) / 10,
    availableFriendCount: validOverlap ? fullyOverlappingFriends : friends.length,
    allFriendsAvailable: validOverlap && fullyOverlappingFriends === friends.length,
  };
}

/**
 * Filter activities by budget and interests
 */
export function filterActivities(
  activities: Activity[],
  maxBudget?: number,
  interests?: ActivityCategory[],
  searchQuery?: string
): Activity[] {
  return activities.filter((act) => {
    // Budget filter
    if (maxBudget !== undefined && act.estimatedCostPerPerson > maxBudget) {
      return false;
    }

    // Interests filter
    if (interests && interests.length > 0) {
      if (!interests.includes(act.category)) {
        return false;
      }
    }

    // Search query filter
    if (searchQuery && searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase().trim();
      const matchName = act.name.toLowerCase().includes(query);
      const matchDesc = act.description.toLowerCase().includes(query);
      const matchNeigh = act.neighborhood.toLowerCase().includes(query);
      const matchTags = act.tags.some((t) => t.toLowerCase().includes(query));
      if (!matchName && !matchDesc && !matchNeigh && !matchTags) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Formats a 24-hr time offset into a readable string
 */
function addMinutesToTime(startHour24: number, startMinute: number, minutesToAdd: number): string {
  const total = startHour24 * 60 + startMinute + minutesToAdd;
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const padM = m < 10 ? `0${m}` : `${m}`;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  return `${h12}:${padM} ${ampm}`;
}

/**
 * Builds chronological itinerary items for selected activities
 */
function createItinerary(
  activities: Activity[],
  preferences: HangoutPreferences
): ItineraryItem[] {
  // Determine start hour based on time preference
  let startHour = 14; // default 2 PM
  let startMinute = 0;

  if (preferences.timePreference === 'afternoon') {
    startHour = 13;
  } else if (preferences.timePreference === 'evening') {
    startHour = 17;
  } else if (preferences.timePreference === 'night') {
    startHour = 19;
  } else if (preferences.timePreference === 'all-day') {
    startHour = 11;
  }

  // Adjust if friends have a common start
  const overlap = calculateAvailabilityOverlap(preferences.friends);
  if (overlap.commonStart) {
    const parts = overlap.commonStart.split(' ');
    const [h, m] = parts[0].split(':').map(Number);
    if (parts[1] === 'PM' && h < 12) startHour = h + 12;
    else if (parts[1] === 'AM' && h === 12) startHour = 0;
    else startHour = h;
    startMinute = m || 0;
  }

  let currentElapsed = 0;
  const items: ItineraryItem[] = [];

  activities.forEach((act, idx) => {
    const startTimeStr = addMinutesToTime(startHour, startMinute, currentElapsed);
    const endTimeStr = addMinutesToTime(startHour, startMinute, currentElapsed + act.durationMinutes);
    const slotString = `${startTimeStr} - ${endTimeStr}`;

    let note = '';
    if (idx === 0) {
      note = `Group rendezvous at ${act.neighborhood}. Settle in and kick off the day.`;
    } else if (idx === activities.length - 1) {
      note = `Grand finale for ${preferences.groupName}. Wrap up, recap, and plan the next meetup.`;
    } else {
      note = `Mid-hangout transition. 15-minute commute/stroll buffer included.`;
    }

    items.push({
      timeSlot: slotString,
      activity: act,
      notes: note,
      allFriendsAvailable: true,
      availableFriendsCount: preferences.friends.length || preferences.friendCount,
    });

    // Add activity duration + 20 minute travel/buffer
    currentElapsed += act.durationMinutes + 20;
  });

  return items;
}

/**
 * Generate plan based on view type
 */
export function generatePlan(
  preferences: HangoutPreferences,
  viewType: PlanningViewType
): HangoutPlan {
  const { maxBudgetPerPerson, selectedInterests, friendCount } = preferences;

  const candidateActivities = [...MOCK_ACTIVITIES];

  // Helper score for interest match
  const getInterestScore = (act: Activity): number => {
    if (selectedInterests.length === 0) return 1;
    return selectedInterests.includes(act.category) ? 3 : 0;
  };

  let chosenActivities: Activity[] = [];
  let title = '';
  let subtitle = '';
  let aiRationale = '';

  if (viewType === 'cheapest') {
    title = 'Wallet-Friendly Austin Adventure';
    subtitle = 'Optimized for maximum fun at minimal per-person spend, backed by simulated Nessie savings.';
    
    // Sort strictly by cost ascending, giving a small preference to interest match
    candidateActivities.sort((a, b) => {
      const costDiff = a.estimatedCostPerPerson - b.estimatedCostPerPerson;
      if (costDiff !== 0) return costDiff;
      return getInterestScore(b) - getInterestScore(a);
    });

    // Pick 3 diverse cheap activities
    chosenActivities = candidateActivities.slice(0, 3);
    aiRationale = `Meta Muse Spark curated 3 ultra-affordable Austin favorites with a blended average cost well under $${maxBudgetPerPerson}/person. Keeps your crew energized without financial stress.`;
  } else if (viewType === 'interests') {
    title = 'Interests & Passion Deep-Dive';
    subtitle = 'Tailored strictly around your group’s chosen categories and vibe preferences.';

    // Sort by highest interest match first, then rating
    candidateActivities.sort((a, b) => {
      const scoreA = getInterestScore(a);
      const scoreB = getInterestScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.rating - a.rating;
    });

    // Filter to those within or reasonably close to budget
    const affordableCandidates = candidateActivities.filter(
      (a) => a.estimatedCostPerPerson <= maxBudgetPerPerson * 0.7
    );

    chosenActivities = (affordableCandidates.length >= 3 ? affordableCandidates : candidateActivities).slice(0, 3);
    aiRationale = `Meta Muse Spark prioritized top-rated venues matching your selected interests (${selectedInterests.join(', ') || 'all categories'}). Highly rated spots designed to guarantee maximum engagement.`;
  } else {
    // 'overall' - Best balanced match
    title = 'The Prime Austin Match';
    subtitle = 'The ideal equilibrium of your group’s interests, budget comfort, and schedule flow.';

    // Composite scoring: Interest (40%) + Budget Fit (30%) + Rating (30%)
    candidateActivities.sort((a, b) => {
      const intScoreA = getInterestScore(a) * 15;
      const intScoreB = getInterestScore(b) * 15;

      const budgetFitA = a.estimatedCostPerPerson <= maxBudgetPerPerson ? 25 : -20;
      const budgetFitB = b.estimatedCostPerPerson <= maxBudgetPerPerson ? 25 : -20;

      const ratingScoreA = a.rating * 10;
      const ratingScoreB = b.rating * 10;

      const totalA = intScoreA + budgetFitA + ratingScoreA;
      const totalB = intScoreB + budgetFitB + ratingScoreB;

      return totalB - totalA;
    });

    // Select 3 activities ensuring category variety if possible
    const selected: Activity[] = [];
    const usedCategories = new Set<string>();

    for (const act of candidateActivities) {
      if (selected.length >= 3) break;
      if (!usedCategories.has(act.category) || selected.length >= candidateActivities.length - 1) {
        selected.push(act);
        usedCategories.add(act.category);
      }
    }

    if (selected.length < 3) {
      chosenActivities = candidateActivities.slice(0, 3);
    } else {
      chosenActivities = selected;
    }

    aiRationale = `Meta Muse Spark engineered this itinerary for balanced group harmony. Combines relaxing group activities with iconic Austin flavor, timed perfectly with your group's availability window.`;
  }

  // Cost calculation
  const totalCostPerPerson = chosenActivities.reduce(
    (acc, act) => acc + act.estimatedCostPerPerson,
    0
  );
  const totalGroupCost = totalCostPerPerson * (friendCount || 1);
  const budgetUtilizationPercentage = Math.min(
    150,
    Math.round((totalCostPerPerson / (maxBudgetPerPerson || 1)) * 100)
  );

  const savingsPerPerson = Math.max(0, maxBudgetPerPerson - totalCostPerPerson);

  // Capital One Nessie financial simulation insights
  let budgetStatus: 'under' | 'on-target' | 'over' = 'on-target';
  let financialHealthScore = 8;
  let budgetTip = '';

  if (totalCostPerPerson < maxBudgetPerPerson * 0.75) {
    budgetStatus = 'under';
    financialHealthScore = 10;
    budgetTip = `Simulated Nessie Insight: Excellent financial efficiency! Each friend saves ~$${savingsPerPerson.toFixed(0)}, leaving a comfortable buffer for rideshares or spontaneous treats.`;
  } else if (totalCostPerPerson <= maxBudgetPerPerson) {
    budgetStatus = 'on-target';
    financialHealthScore = 9;
    budgetTip = `Simulated Nessie Insight: Perfectly balanced. At $${totalCostPerPerson}/person, you’re utilizing ${budgetUtilizationPercentage}% of the target budget with zero overdraft risk.`;
  } else {
    budgetStatus = 'over';
    financialHealthScore = 6;
    const overage = totalCostPerPerson - maxBudgetPerPerson;
    budgetTip = `Simulated Nessie Alert: This combination exceeds target budget by $${overage.toFixed(0)}/person. Consider swapping an activity or opting for happy-hour pricing.`;
  }

  // Calculate overall match score
  let matchScore = 85;
  if (viewType === 'overall') matchScore = 94;
  else if (viewType === 'cheapest') matchScore = 88;
  else if (viewType === 'interests') matchScore = 96;

  // Build the proposed itinerary
  const itinerary = createItinerary(chosenActivities, preferences);

  return {
    id: `plan-${viewType}-txmates`,
    viewType,
    title,
    subtitle,
    activities: chosenActivities,
    itinerary,
    totalCostPerPerson,
    totalGroupCost,
    budgetUtilizationPercentage,
    matchScore,
    aiRationale,
    nessieFinancialInsight: {
      budgetStatus,
      savingsPerPerson,
      financialHealthScore,
      budgetTip,
    },
  };
}
