export type ActivityCategory =
  | 'food'
  | 'music'
  | 'outdoors'
  | 'gaming'
  | 'sports'
  | 'nightlife'
  | 'arts'
  | 'chill';

export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  categoryLabel: string;
  location: string;
  neighborhood: string;
  estimatedCostPerPerson: number;
  priceListed?: boolean;
  durationMinutes: number;
  description: string;
  highlights: string[];
  rating: number;
  reviewCount: number;
  popularTimes: string;
  bestFor: string;
  tags: string[];
  imageUrl?: string;
  sourceUrl?: string;
  isLiveResult?: boolean;
  uncertainties?: string[];
  kind?: 'event' | 'place';
  startDate?: string | null;
  endDate?: string | null;
  firstSeen?: string;
  lastSeen?: string;
  resultFreshness?: 'live' | 'saved' | 'catalog';
  museEnriched?: boolean;
  venue?: string;
  address?: string;
  whyThisFits?: string;
}

export interface TimeSlot {
  id: string;
  startTime: string; // e.g. "14:00"
  endTime: string;   // e.g. "19:00"
  label?: string;    // e.g. "Afternoon"
}

export interface CalendarBusyEvent {
  summary: string;
  startTime: string; // e.g. "09:30"
  endTime: string;   // e.g. "11:00"
  isAllDay?: boolean;
  date?: string;
}

export interface FreeWindow {
  startTime: string; // e.g. "13:00"
  endTime: string;   // e.g. "21:30"
  durationMinutes: number;
}

export interface FriendCalendarSyncDetails {
  source: 'google' | 'ical' | 'upload' | 'demo';
  syncedAt: string;
  eventsDetected: number;
  busyEvents: CalendarBusyEvent[];
  freeWindows: FreeWindow[];
  suggestedStart: string;
  suggestedEnd: string;
}

export interface Friend {
  id: string;
  name: string;
  avatarColor: string;
  availabilitySlots: TimeSlot[];
  budgetPreference?: number;
  topInterests: ActivityCategory[];
  status?: 'pending' | 'submitted';
  submittedAt?: string;
  nessieCustomerId?: string;
  calendarSynced?: boolean;
  calendarSyncDetails?: FriendCalendarSyncDetails;
}

export interface SquadPricePointResponse {
  isLive: boolean;
  model?: string;
  groupPricePoint: number;
  groupTotalPool: number;
  rationale: string;
  coordinationTip: string;
  source: 'nessie' | 'simulated';
  memberCount: number;
  allMembersCovered: boolean;
}

export interface HangoutPreferences {
  id?: string;
  groupName: string;
  friendCount: number;
  location: string;
  date: string;
  timePreference: 'afternoon' | 'evening' | 'all-day' | 'night';
  maxBudgetPerPerson: number;
  selectedInterests: ActivityCategory[];
  friends: Friend[];
}

export type PlanningViewType = 'overall' | 'cheapest' | 'interests';

export interface ItineraryItem {
  timeSlot: string; // e.g. "2:00 PM - 3:30 PM"
  activity: Activity;
  notes: string;
  allFriendsAvailable: boolean;
  availableFriendsCount: number;
}

export interface HangoutPlan {
  id: string;
  viewType: PlanningViewType;
  title: string;
  subtitle: string;
  activities: Activity[];
  itinerary: ItineraryItem[];
  totalCostPerPerson: number;
  totalGroupCost: number;
  budgetUtilizationPercentage: number;
  matchScore: number; // 0 - 100
  aiRationale: string;
  nessieFinancialInsight: {
    budgetStatus: 'under' | 'on-target' | 'over';
    savingsPerPerson: number;
    financialHealthScore: number; // 1 - 10
    budgetTip: string;
    source: 'nessie' | 'simulated';
  };
  isLiveAiGenerated?: boolean;
  aiModelUsed?: string;
  aiIcebreaker?: string;
  aiCoordinationTip?: string;
  museFromCache?: boolean;
  museCachedAt?: string;
  museLimited?: boolean;
}

export interface VoteRecord {
  friendId: string;
  friendName: string;
  reaction: 'up' | 'love' | 'down';
  timestamp: string;
}
