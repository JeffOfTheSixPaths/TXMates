import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import type { Friend, SquadPricePointResponse, FriendPricePointRecommendation } from '@/types';
import { loadNessieBudget } from './nessieServer';
import { museComplete } from './museClient';
import { getDb } from './db';

const KNOWN_NESSIE_CUSTOMERS: Record<string, { id: string; name: string }> = {
  marcus: { id: '83541dfe-0a77-46ad-96dd-add64e9f7371', name: 'Marcus Whitfield' },
  priya: { id: 'a5465fe4-0226-4701-8fe6-a9dfa6928b29', name: 'Priya Raman' },
  tyler: { id: 'bb85e0fa-4390-4c2d-96de-e465e84430a6', name: 'Tyler Nguyen' },
  elena: { id: 'ebf3da9a-004d-46ee-b496-1f21c6c5d79b', name: 'Elena Morales' },
};

function resolveCustomerId(friend: Friend): string | undefined {
  if (friend.nessieCustomerId) return friend.nessieCustomerId;
  const lower = friend.name.toLowerCase();
  for (const [key, entry] of Object.entries(KNOWN_NESSIE_CUSTOMERS)) {
    if (lower.includes(key)) return entry.id;
  }
  return undefined;
}

export function squadPricePointCacheKey(friends: Friend[]): string {
  const parts = friends.map((f) => `${f.id}:${f.name}:${f.nessieCustomerId || ''}`).sort();
  return 'squad-pp:' + createHash('sha256').update(parts.join('|')).digest('hex');
}

export async function estimateSquadPricePoint(
  friends: Friend[],
  customDb?: DatabaseSync
): Promise<SquadPricePointResponse> {
  const db = customDb ?? getDb();

  // 1. Gather Nessie financial profiles for all friends in parallel
  const profiles = await Promise.all(
    friends.map(async (friend) => {
      const customerId = resolveCustomerId(friend);
      if (customerId) {
        try {
          const res = await loadNessieBudget({ customerId, friendCount: 1 });
          if (res.source === 'nessie') {
            const checking = res.estimate.balance;
            const savings = res.estimate.savingsBalance;
            const debt = checking < 0 ? Math.abs(checking) : 0;
            return {
              friend,
              customerId,
              checking: Math.max(0, checking),
              savings,
              debt,
              discretionary: res.estimate.discretionary,
              typicalSpend: res.estimate.typicalMonthlySpend,
              recurringBills: res.estimate.recurringMonthly,
              suggestedBaseline: res.estimate.suggestedPerPerson,
              isNessieLive: true,
            };
          }
        } catch {
          // Fallback to simulated profile below
        }
      }

      // Default simulated profile based on friend budget preference
      const pref = friend.budgetPreference || 30;
      return {
        friend,
        customerId,
        checking: pref * 10,
        savings: pref * 5,
        debt: 0,
        discretionary: pref * 2,
        typicalSpend: pref * 8,
        recurringBills: pref * 6,
        suggestedBaseline: pref,
        isNessieLive: false,
      };
    })
  );

  // 2. Call Meta Muse Spark to synthesize individual & group price points
  const systemPrompt = `You are Meta Muse Spark, an intelligent social finance planner.
You evaluate friend group financial profiles from Capital One Nessie to recommend fair, empathetic hangout price points where no friend feels excluded or financially strained.
Calculate:
1. "groupPricePoint": The optimal group budget cap per person. It must accommodate the most financially constrained friends (those with low checking, debt, or tight margins) so no one is priced out.
2. "rationale": 2-3 sentences explaining the group sweet spot and why this price point works for the squad.
3. "coordinationTip": 1 practical tip for keeping the hangout fun and inclusive despite budget differences.
4. "friendRecommendations": Array for every friend with:
   - "name": friend's exact name
   - "suggestedPricePoint": their personal comfortable spending limit
   - "insight": 1 sentence explaining their capacity based on their checking, debt, bills, and savings.

Reply with ONLY raw JSON matching this schema:
{
  "groupPricePoint": number,
  "rationale": "2-3 sentences",
  "coordinationTip": "1 practical tip",
  "friendRecommendations": [
    {
      "name": "Friend Name",
      "suggestedPricePoint": number,
      "insight": "1 sentence"
    }
  ]
}`;

  const userPayload = profiles.map((p) => ({
    name: p.friend.name,
    checkingBalance: p.checking,
    savingsBalance: p.savings,
    creditCardDebt: p.debt,
    typicalMonthlySpend: Math.round(p.typicalSpend),
    recurringBillsMonthly: Math.round(p.recurringBills),
    discretionaryMonthly: Math.round(p.discretionary),
    nessieCalculatedBaseline: p.suggestedBaseline,
  }));

  const cacheKey = squadPricePointCacheKey(friends);

  let rawMuseContent: string | null = null;
  let isLive = false;

  if (process.env.MUSE_API_KEY) {
    const museRes = await museComplete(db, {
      purpose: 'price-point',
      cacheKey,
      temperature: 0.3,
      maxTokens: 3500,
      reasoningEffort: 'low',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });
    if (museRes.content && !museRes.truncated) {
      rawMuseContent = museRes.content;
      isLive = true;
    }
  }

  // 3. Parse Meta Muse output or generate deterministic fallback
  let parsed: {
    groupPricePoint?: number;
    rationale?: string;
    coordinationTip?: string;
    friendRecommendations?: Array<{
      name?: string;
      suggestedPricePoint?: number;
      insight?: string;
    }>;
  } | null = null;

  if (rawMuseContent) {
    const cleaned = rawMuseContent.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          parsed = null;
        }
      }
    }
  }

  // Build friend recommendations
  const recommendations: FriendPricePointRecommendation[] = profiles.map((p) => {
    const match = parsed?.friendRecommendations?.find(
      (r) => r.name && p.friend.name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
    );

    let pricePoint = match?.suggestedPricePoint;
    if (pricePoint === undefined || !Number.isFinite(pricePoint)) {
      if (p.debt > 0 || p.checking < 200) {
        pricePoint = 15;
      } else if (p.checking > 5000) {
        pricePoint = Math.min(85, Math.round(p.suggestedBaseline || 50));
      } else {
        pricePoint = Math.max(20, Math.round(p.suggestedBaseline || 30));
      }
    }

    let insight = match?.insight;
    if (!insight) {
      if (p.debt > 0) {
        insight = `Managing $${p.debt} in credit card balance; keeping spending conservative protects cash flow.`;
      } else if (p.savings > 10000) {
        insight = `High liquidity and $${Math.round(p.savings).toLocaleString()} in savings provide strong financial comfort.`;
      } else if (p.checking < 500) {
        insight = `Modest checking balance; lower-cost stops prevent budget strain.`;
      } else {
        insight = `Healthy checking cushion with balanced recurring obligations.`;
      }
    }

    return {
      friendId: p.friend.id,
      name: p.friend.name,
      nessieCustomerId: p.customerId,
      checkingBalance: p.checking,
      savingsBalance: p.savings,
      debt: p.debt,
      discretionary: p.discretionary,
      suggestedPricePoint: pricePoint,
      insight,
    };
  });

  // Calculate group price point
  let groupPricePoint = parsed?.groupPricePoint;
  if (!groupPricePoint || !Number.isFinite(groupPricePoint)) {
    const minRec = Math.min(...recommendations.map((r) => r.suggestedPricePoint));
    const avgRec = Math.round(
      recommendations.reduce((sum, r) => sum + r.suggestedPricePoint, 0) / (recommendations.length || 1)
    );
    groupPricePoint = Math.max(15, Math.min(minRec + 10, avgRec));
  }

  const rationale =
    parsed?.rationale ||
    `Meta Muse Spark analyzed Nessie balances across the squad and recommends $${groupPricePoint}/person as the inclusive target. This ensures friends with tighter cash flow or debt participate comfortably without financial pressure.`;

  const coordinationTip =
    parsed?.coordinationTip ||
    'Anchor around free outdoor spaces or casual food trucks with a low-cost ceiling, allowing anyone who wants extra treats to opt in independently.';

  const anyNessieLive = profiles.some((p) => p.isNessieLive);

  return {
    isLive,
    model: isLive ? 'muse-spark-1.3' : undefined,
    groupPricePoint,
    rationale,
    coordinationTip,
    friends: recommendations,
    source: anyNessieLive ? 'nessie' : 'simulated',
  };
}
