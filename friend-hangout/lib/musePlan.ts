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
const LISTICLE_LEAD = /^\s*(the\s+)?(absolute\s+|ultimate\s+)?(best|top)\b/i;
const TOP_RATED = /\btop[-\s]rated\b/i;
const PLURAL_CATEGORY_IN_TEXAS =
  /\b(?:escape\s+rooms|restaurants|bars|breweries|cafes|bakeries|donuts|tacos|arcades|museums|parks|venues|activities|spots|places|games|clubs|joints|trails)\s+in\s+[^|,]{2,40},\s*tx\b/i;
const PUBLISHER_SUFFIX =
  /\|\s*[^|]{0,48}\b(magazine|eater|houstonia|timeout|chronicle|infatuation|thrillist|texas monthly|do512|tripadvisor)\b/i;

export function isListicleListing(name: string, url?: string): boolean {
  if (url && /yelp\.com\/search/i.test(url)) return true;
  if (url && /(?:youtube\.com|youtu\.be)/i.test(url)) return true;
  const title = name.trim();
  if (!title) return false;
  return (
    LISTICLE_TITLE.test(title) ||
    LISTICLE_LEAD.test(title) ||
    TOP_RATED.test(title) ||
    PLURAL_CATEGORY_IN_TEXAS.test(title) ||
    /\b(best|top)\s+\d+\b/i.test(title) ||
    /\b\d+\s+best\b/i.test(title) ||
    /\bbest\b[^|]{0,60}\bin\b/i.test(title) ||
    PUBLISHER_SUFFIX.test(title) ||
    /\b(things to do|group activities|date ideas|bucket list)\b/i.test(title)
  );
}

export function isGenericFillerActivity(activity: { id?: string; name: string; sourceUrl?: string }): boolean {
  return Boolean(activity.id?.startsWith('dyn-')) || isListicleListing(activity.name, activity.sourceUrl);
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

const CITY_NOTE: Record<string, string> = {
  austin: 'Austin wants a spring, a table, or a stage, not a list of best-ofs.',
  houston: 'Keep Houston in one part of town: a bayou, a museum district, or a neighborhood joint.',
  dallas: 'Dallas lands better at Klyde Warren, Deep Ellum, or a real room than a donut roundup.',
  'san antonio': 'San Antonio hangs together on the River Walk or at the Pearl.',
};

const CITY_TIP: Record<string, string> = {
  austin: 'Park once near South Congress or the lake and walk the middle stop. Rideshares stack up after dark.',
  houston: 'Houston is a driving city. Park for the first stop and do not cross the loop again for the third.',
  dallas: 'Klyde Warren and Deep Ellum are the easy handoffs. The Design District and Arlington need a car.',
  'san antonio': 'The River Walk and the Pearl are different trips if you are walking. Leave a rideshare between them.',
};

function cityKey(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/,?\s*tx$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rationaleFromActivities(names: string[], city: string): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  const note = CITY_NOTE[cityKey(city)] || `Keep every stop in ${city}.`;
  if (clean.length === 0) return note;
  if (clean.length === 1) return `${clean[0]} in ${city}. ${note}`;
  if (clean.length === 2) return `${clean[0]}, then ${clean[1]}. ${note}`;
  return `${clean[0]}, then ${clean[1]}, and finish at ${clean[clean.length - 1]}. ${note}`;
}

const ICEBREAKER: Record<string, (name: string, city: string) => string> = {
  food: (name, city) => `Who has the strongest ${city} food opinion, and will they defend it at ${name}?`,
  music: (name) => `At ${name}, everyone names the first song that would get them out of the chair.`,
  outdoors: (name) => `First person to ${name} picks the photo spot. Everyone else has to use it.`,
  gaming: (name) => `At ${name}, loser of the first game owes the group a round of water.`,
  sports: (name, city) => `Before ${name}, pick a ${city} team and stick with it for the rest of the day.`,
  nightlife: (name) => `At ${name}, each person owes the group one story from this year.`,
  arts: (name) => `Inside ${name}, find one thing you would actually send to the group chat.`,
  chill: (name) => `At ${name}, phones stay down until everyone has a drink in hand.`,
};

export function localPlanCopy(
  activities: Array<{ name: string; category: string }>,
  city: string
): { aiRationale: string; aiIcebreaker: string; aiCoordinationTip: string } {
  const first = activities[0];
  const icebreaker = first
    ? (ICEBREAKER[first.category] || ICEBREAKER.chill)(first.name, city)
    : `What is the one thing this ${city} day has to include?`;
  return {
    aiRationale: rationaleFromActivities(
      activities.map((activity) => activity.name),
      city
    ),
    aiIcebreaker: icebreaker,
    aiCoordinationTip: CITY_TIP[cityKey(city)] || 'Leave twenty minutes between stops so nobody is sprinting.',
  };
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
    v: 'plan-v2',
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

const WHY_LEAD: Record<string, string> = {
  food: 'Feed the group at a real {city} table',
  music: 'Give the night a live room in {city}',
  outdoors: 'Get everyone outside while the day is still easy in {city}',
  gaming: 'Put a game between the group instead of another scroll through {city}',
  sports: 'Spend the energy somewhere built for a group in {city}',
  nightlife: 'Land a round at a {city} bar people already know',
  arts: 'Put a real {city} museum or hall on the day',
  chill: 'Start with coffee so the group can actually talk in {city}',
};

export function heuristicWhy(
  activity: { category: string; estimatedCostPerPerson: number; name?: string },
  interests: string[],
  cap: number,
  location = 'Austin, TX'
): string {
  const city = location.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || 'Austin';
  const template = WHY_LEAD[activity.category] || 'It is a {city} stop the group can share';
  const lead = template.replaceAll('{city}', city);
  const interest = interests.includes(activity.category) ? ' It matches an interest the group turned on.' : '';
  const money =
    activity.estimatedCostPerPerson <= cap ? `and stays within the $${cap} cap` : `though it runs above the $${cap} cap`;
  return `${lead} ${money}.${interest}`;
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

