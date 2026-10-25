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
  resultFreshness?: 'live' | 'saved';
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

export interface Friend {
  id: string;
  name: string;
  avatarColor: string;
  availabilitySlots: TimeSlot[];
  budgetPreference?: number;
  topInterests: ActivityCategory[];
  status?: 'pending' | 'submitted';
  submittedAt?: string;
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
