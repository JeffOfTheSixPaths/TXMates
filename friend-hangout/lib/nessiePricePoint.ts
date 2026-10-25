import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import type { Friend, SquadPricePointResponse } from '@/types';
import { loadNessieBudget } from './nessieServer';
import { museComplete } from './museClient';
import { getDb } from './db';

const KNOWN_NESSIE_CUSTOMERS: Record<string, { id: string; name: string }> = {
  marcus: { id: '83541dfe-0a77-46ad-96dd-add64e9f7371', name: 'Marcus Whitfield' },
  priya: { id: 'a5465fe4-0226-4701-8fe6-a9dfa6928b29', name: 'Priya Raman' },
  tyler: { id: 'bb85e0fa-4390-4c2d-96de-e465e84430a6', name: 'Tyler Nguyen' },
  elena: { id: 'ebf3da9a-004d-46ee-b496-1f21c6c5d79b', name: 'Elena Morales' },
};

export function resolveCustomerId(friend: Friend): string | undefined {
  if (friend.nessieCustomerId) return friend.nessieCustomerId;
  const lower = friend.name.toLowerCase();
  for (const [key, entry] of Object.entries(KNOWN_NESSIE_CUSTOMERS)) {
    if (lower.includes(key)) return entry.id;
  }
  return undefined;
}

export function squadPricePointCacheKey(friends: Friend[]): string {
  const parts = friends.map((f) => `${f.id}:${f.name}:${f.nessieCustomerId || ''}`).sort();
  return 'squad-pp-priv:' + createHash('sha256').update(parts.join('|')).digest('hex');
}

export async function estimateSquadPricePoint(
  friends: Friend[],
  customDb?: DatabaseSync
): Promise<SquadPricePointResponse> {
  const db = customDb ?? getDb();

  // 1. Privately gather financial profiles and estimate each person's max amount to pay
  const memberCapacities = await Promise.all(
    friends.map(async (friend) => {
      const customerId = resolveCustomerId(friend);
      if (customerId) {
        try {
          const res = await loadNessieBudget({ customerId, friendCount: 1 });
          if (res.source === 'nessie') {
            const checking = res.estimate.balance;
            const debt = checking < 0 ? Math.abs(checking) : 0;
            const discretionary = res.estimate.discretionary;
            const baseline = res.estimate.suggestedPerPerson;

            // Calculate each person's max comfortable payment:
            let individualMax: number;
            if (debt > 0 || checking < 200) {
              individualMax = 15;
            } else if (checking > 5000 && discretionary > 1000) {
              individualMax = Math.min(85, Math.max(35, Math.round(baseline)));
            } else {
              individualMax = Math.min(50, Math.max(20, Math.round(baseline)));
            }

            return {
              friendId: friend.id,
              name: friend.name,
              customerId,
              individualMax,
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
        friendId: friend.id,
        name: friend.name,
        customerId: undefined,
        individualMax: pref,
        isNessieLive: false,
      };
    })
  );

  // 2. Call Meta Muse Spark to synthesize overall group price point with STRICT PRIVACY
  const systemPrompt = `You are Meta Muse Spark, an intelligent social finance planner.
You evaluate friend group financial capacity from Capital One Nessie to recommend a fair, empathetic group hangout budget cap.

STRICT PRIVACY POLICY:
- DO NOT reveal, mention, cite, or hint at any specific individual's bank balances, checking balances, savings, debts, or personal financial situation.
- Never say "Friend X has $Y in debt" or "Friend Z has $W balance".
- Only speak to the recommended overall amount of money for the group, collective group affordability, and practical coordination tips.

Calculate:
1. "groupPricePoint": The optimal group budget cap per person (number). It must accommodate the most financially constrained friends so that no one is priced out or stressed.
2. "rationale": 2-3 sentences explaining why this overall price point works well for the group, emphasizing inclusivity and shared enjoyment without revealing any private financial details.
3. "coordinationTip": 1 practical tip for keeping the hangout inclusive and fun within this overall budget.

Reply with ONLY raw JSON matching this schema:
{
  "groupPricePoint": number,
  "rationale": "2-3 sentences",
  "coordinationTip": "1 practical tip"
}`;

  const userPayload = {
    groupSize: memberCapacities.length,
    estimatedMaxPerPersonTiers: memberCapacities.map((m) => ({
      maxComfortableSpend: m.individualMax,
    })),
  };

  const cacheKey = squadPricePointCacheKey(friends);

  let rawMuseContent: string | null = null;
  let isLive = false;

  if (process.env.MUSE_API_KEY) {
    const museRes = await museComplete(db, {
      purpose: 'price-point',
      cacheKey,
      temperature: 0.3,
      maxTokens: 2500,
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

  // Calculate recommended group price point
  let groupPricePoint = parsed?.groupPricePoint;
  if (!groupPricePoint || !Number.isFinite(groupPricePoint)) {
    const minCap = Math.min(...memberCapacities.map((m) => m.individualMax));
    const avgCap = Math.round(
      memberCapacities.reduce((sum, m) => sum + m.individualMax, 0) / (memberCapacities.length || 1)
    );
    // Anchor to the lower end to protect financially constrained members
    groupPricePoint = Math.max(15, Math.min(minCap + 5, avgCap));
  }

  const groupTotalPool = groupPricePoint * memberCapacities.length;

  const rationale =
    parsed?.rationale ||
    `Based on squad spending limits, $${groupPricePoint} per person ($${groupTotalPool} total group pool) is the recommended target. This ensures the hangout remains comfortable and accessible for everyone without putting financial pressure on any mate.`;

  const coordinationTip =
    parsed?.coordinationTip ||
    'Anchor the outing around free outdoor spaces or casual food spots, allowing anyone wanting extra drinks or snacks to opt in independently.';

  const anyNessieLive = memberCapacities.some((m) => m.isNessieLive);

  // Return ONLY overall money amounts, NOT individual bank balances
  return {
    isLive,
    model: isLive ? 'muse-spark-1.3' : undefined,
    groupPricePoint,
    groupTotalPool,
    rationale,
    coordinationTip,
    source: anyNessieLive ? 'nessie' : 'simulated',
    memberCount: memberCapacities.length,
    allMembersCovered: true,
  };
}
