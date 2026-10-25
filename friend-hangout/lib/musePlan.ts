import { createHash } from 'node:crypto';
import type { Activity, HangoutPreferences } from '@/types';
import type { HangoutBudgetEstimate } from './nessieBudget';

export const PLAN_MAX_COMPLETION_TOKENS = 4000;
export const BUDGET_MAX_COMPLETION_TOKENS = 1500;

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

export function uniquePlanCandidates<T extends { id?: string; name?: string }>(activities: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const activity of activities) {
    const key = activity.id || activity.name || '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(activity);
  }
  return unique;
}

export function museBudgetPromptRules(): string {
  return `The nessie object has source "nessie" or "simulated", and figureLabel says which. When source is "nessie", budgetExplanation is a plain-language read of that customer's balances, and you may say what Nessie suggests. savingsBalance is held separately and is not spendable. plannedMonthlySavings is already set aside each month. balance is checking with credit-card debt subtracted, and Nessie does not change it when purchases or deposits are recorded. When source is "simulated", suggestedPerPerson is an estimate, not a bank figure. Call it an estimate in aiRationale and budgetExplanation. Do not say Nessie suggests it. When nessie is null, leave budgetExplanation empty.`;
}

export function musePlanSystemPrompt(location = 'Austin, TX'): string {
  const city = location.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || 'Austin';
  return `You are Meta Muse Spark planning a friend hangout in ${city}.
Reply with ONLY JSON:
{
  "picks": [{"id":"activity id","whyThisFits":"one short sentence"}],
  "aiRationale": "2-3 sentences",
  "aiIcebreaker": "one line",
  "aiCoordinationTip": "one line",
  "budgetExplanation": "plain language for the budget figure, or empty if none were provided",
  "budgetTips": ["up to 3 short tips"]
}
Choose up to 3 ids from the candidate list. Respect the budget and the overlap window.
${museBudgetPromptRules()}`;
}

export function hangoutGroupSize(preferences: { friendCount?: number; friends?: unknown[] }): number {
  const named = preferences.friends?.length ?? 0;
  if (named > 0) return named;
  return Math.max(1, preferences.friendCount || 1);
}

export function groupSizeInstruction(total: number): string {
  const people = Math.max(1, total);
  const others = Math.max(0, people - 1);
  const friendWord = others === 1 ? 'friend' : 'friends';
  return `The group is ${people} people total, including the person planning the day. That is the organizer plus ${others} ${friendWord}. Never say "you plus ${people} friends".`;
}

const LISTICLE_TITLE = /^\s*\d+\s+(best|top|great|fun|ultimate|essential|must|amazing)\b/i;

export function isListicleListing(name: string): boolean {
  const title = name.trim();
  return (
    LISTICLE_TITLE.test(title) ||
    /\b(best|top)\s+\d+\b/i.test(title) ||
    /\b\d+\s+best\b/i.test(title) ||
    /\b(things to do|group activities|date ideas|bucket list)\b/i.test(title)
  );
}

export function isGenericFillerActivity(activity: { id?: string; name: string }): boolean {
  return Boolean(activity.id?.startsWith('dyn-')) || isListicleListing(activity.name);
}

export function fillPlanPicks<T extends { id: string; name: string }>(
  musePicks: T[],
  candidates: T[],
  limit = 3
): { picks: T[]; usableMusePicks: number; degraded: boolean } {
  const picks: T[] = [];
  const seen = new Set<string>();
  for (const pick of musePicks) {
    if (!pick.id || seen.has(pick.id)) continue;
    seen.add(pick.id);
    picks.push(pick);
    if (picks.length >= limit) break;
  }
  const usableMusePicks = picks.length;
  const pools = [candidates.filter((item) => !isGenericFillerActivity(item)), candidates];
  for (const pool of pools) {
    for (const candidate of pool) {
      if (picks.length >= limit) break;
      if (!candidate.id || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      picks.push(candidate);
    }
  }
  return { picks, usableMusePicks, degraded: usableMusePicks < limit };
}

export function shouldCacheMusePlan(input: {
  truncated: boolean;
  content: string | null;
  usableMusePicks: number;
  rationale?: string | null;
}): boolean {
  if (input.truncated || !input.content?.trim()) return false;
  if (input.usableMusePicks < 3) return false;
  if (!input.rationale?.trim()) return false;
  return true;
}

export function rationaleFromActivities(names: string[], city: string): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return `${clean[0]} in ${city}.`;
  const head = clean.slice(0, -1).join(', ');
  return `${head}, and ${clean[clean.length - 1]} in ${city}.`;
}

export function museBudgetForPrompt(
  nessie: {
    source: string;
    balance: number;
    typicalMonthlySpend: number;
    recurringMonthly: number;
    annualChargesMonthly: number;
    upcomingCharges: number;
    safetyBuffer: number;
    discretionary: number;
    suggestedPerPerson: number;
    savingsBalance?: number;
    plannedMonthlySavings?: number;
  } | null
  | undefined
) {
  if (!nessie) return null;
  const simulated = nessie.source !== 'nessie';
  return {
    source: simulated ? 'simulated' : 'nessie',
    figureLabel: simulated ? 'simulated estimate' : 'Nessie suggestion',
    balance: nessie.balance,
    typicalMonthlySpend: nessie.typicalMonthlySpend,
    recurringMonthly: nessie.recurringMonthly,
    annualChargesMonthly: nessie.annualChargesMonthly,
    upcomingCharges: nessie.upcomingCharges,
    safetyBuffer: nessie.safetyBuffer,
    discretionary: nessie.discretionary,
    suggestedPerPerson: nessie.suggestedPerPerson,
    savingsBalance: nessie.savingsBalance ?? 0,
    plannedMonthlySavings: nessie.plannedMonthlySavings ?? 0,
  };
}

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
    | 'savingsBalance'
    | 'plannedMonthlySavings'
  >
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        v: 'budget-v2',
        balance: estimate.balance,
        typicalMonthlySpend: estimate.typicalMonthlySpend,
        recurringMonthly: estimate.recurringMonthly,
        annualChargesMonthly: estimate.annualChargesMonthly,
        upcomingCharges: estimate.upcomingCharges,
        safetyBuffer: estimate.safetyBuffer,
        discretionary: estimate.discretionary,
        suggestedPerPerson: estimate.suggestedPerPerson,
        friendCount: estimate.friendCount,
        savingsBalance: estimate.savingsBalance,
        plannedMonthlySavings: estimate.plannedMonthlySavings,
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

export function heuristicWhy(
  activity: { category: string; estimatedCostPerPerson: number },
  interests: string[],
  cap: number,
  location = 'Austin, TX'
): string {
  const city = location.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || 'Austin';
  const interest = interests.includes(activity.category)
    ? 'It matches an interest the group turned on'
    : `It is a ${city} stop the group can share`;
  const money = activity.estimatedCostPerPerson <= cap ? `and stays within the $${cap} cap` : `though it runs above the $${cap} cap`;
  return `${interest} ${money}.`;
}

function parseJson(content: string): unknown {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
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

