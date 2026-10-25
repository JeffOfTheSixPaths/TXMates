import { createHash } from 'node:crypto';
import type { Activity, HangoutPreferences } from '@/types';
import type { HangoutBudgetEstimate } from './nessieBudget';

export type MusePick = { id: string; whyThisFits: string };

export type MusePlanCopy = {
  picks: MusePick[];
  aiRationale?: string;
  aiIcebreaker?: string;
  aiCoordinationTip?: string;
  budgetExplanation?: string;
  budgetTips?: string[];
};

export type BudgetCopy = {
  explanation: string;
  tips: string[];
};

export function planPromptCacheKey(input: {
  viewType: string;
  preferences: HangoutPreferences;
  activities: Array<Pick<Activity, 'id' | 'name' | 'estimatedCostPerPerson' | 'category'>>;
  budget?: Pick<HangoutBudgetEstimate, 'suggestedPerPerson' | 'balance' | 'discretionary' | 'source'> | null;
}): string {
  const activities = [...input.activities]
    .map((activity) => `${activity.id}|${activity.name}|${activity.category}|${activity.estimatedCostPerPerson}`)
    .sort();
  const raw = JSON.stringify({
    v: 'plan-v1',
    view: input.viewType,
    group: (input.preferences.groupName || '').trim().toLowerCase(),
    date: input.preferences.date,
    budget: input.preferences.maxBudgetPerPerson,
    interests: [...(input.preferences.selectedInterests || [])].sort(),
    friends: (input.preferences.friends || []).map((friend) => ({
      id: friend.id,
      start: friend.availabilitySlots[0]?.startTime || '',
      end: friend.availabilitySlots[0]?.endTime || '',
    })),
    activities,
    nessie: input.budget
      ? {
          source: input.budget.source,
          suggested: input.budget.suggestedPerPerson,
          balance: input.budget.balance,
          discretionary: input.budget.discretionary,
        }
      : null,
  });
  return createHash('sha256').update(raw).digest('hex');
}

export function budgetCopyCacheKey(
  estimate: Pick<
    HangoutBudgetEstimate,
    | 'balance'
    | 'typicalMonthlySpend'
    | 'recurringMonthly'
    | 'annualChargesMonthly'
    | 'upcomingCharges'
    | 'safetyBuffer'
    | 'discretionary'
    | 'suggestedPerPerson'
    | 'friendCount'
  >
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        v: 'budget-v1',
        balance: estimate.balance,
        typicalMonthlySpend: estimate.typicalMonthlySpend,
        recurringMonthly: estimate.recurringMonthly,
        annualChargesMonthly: estimate.annualChargesMonthly,
        upcomingCharges: estimate.upcomingCharges,
        safetyBuffer: estimate.safetyBuffer,
        discretionary: estimate.discretionary,
        suggestedPerPerson: estimate.suggestedPerPerson,
        friendCount: estimate.friendCount,
      })
    )
    .digest('hex');
}

export function parseMusePlan(content: string, allowedIds: Set<string>): MusePlanCopy | null {
  const record = asRecord(parseJson(content));
  if (!record) return null;
  const picks = Array.isArray(record.picks) ? record.picks : [];
  const parsedPicks: MusePick[] = [];
  for (const pick of picks) {
    const item = asRecord(pick);
    if (!item || typeof item.id !== 'string' || !allowedIds.has(item.id)) continue;
    if (parsedPicks.some((existing) => existing.id === item.id)) continue;
    const why = shortText(item.whyThisFits, 240);
    if (!why) continue;
    parsedPicks.push({ id: item.id, whyThisFits: why });
    if (parsedPicks.length >= 3) break;
  }
  return {
    picks: parsedPicks,
    aiRationale: shortText(record.aiRationale, 500) || undefined,
    aiIcebreaker: shortText(record.aiIcebreaker, 240) || undefined,
    aiCoordinationTip: shortText(record.aiCoordinationTip, 240) || undefined,
    budgetExplanation: shortText(record.budgetExplanation, 500) || undefined,
    budgetTips: stringList(record.budgetTips, 3, 180),
  };
}

export function parseBudgetCopy(content: string): BudgetCopy | null {
  const record = asRecord(parseJson(content));
  if (!record) return null;
  const explanation = shortText(record.explanation, 500);
  if (!explanation) return null;
  return { explanation, tips: stringList(record.tips, 3, 180) };
}

export function heuristicWhy(activity: { category: string; estimatedCostPerPerson: number }, interests: string[], cap: number): string {
  const interest = interests.includes(activity.category) ? 'It matches an interest the group turned on' : 'It is an Austin stop the group can share';
  const money = activity.estimatedCostPerPerson <= cap ? `and stays within the $${cap} cap` : `though it runs above the $${cap} cap`;
  return `${interest} ${money}.`;
}

function parseJson(content: string): unknown {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function shortText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.slice(0, max);
}

function stringList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    const text = shortText(entry, maxLen);
    if (!text) continue;
    items.push(text);
    if (items.length >= maxItems) break;
  }
  return items;
}

