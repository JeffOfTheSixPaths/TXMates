import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { HangoutPreferences, PlanningViewType, Activity } from '@/types';
import { getDb } from '@/lib/db';
import { discoverActivities } from '@/lib/discoverActivities';
import { formatCityLabel } from '@/lib/discoverySearch';
import { stablePlanCacheKey, readMuseCache, writeMuseCache } from '@/lib/museCache';
import { museComplete } from '@/lib/museClient';
import { ENRICH_REASONING_EFFORT, PLAN_ENRICH_LIMIT } from '@/lib/museEnrich';
import { getActivityRow } from '@/lib/activityStore';
import { enrichStoredActivities } from '@/lib/discoverySearch';
import {
  fillPlanPicks,
  groupSizeInstruction,
  hangoutGroupSize,
  heuristicWhy,
  isListicleListing,
  museBudgetForPrompt,
  museBudgetPromptRules,
  parseMusePlan,
  PLAN_MAX_COMPLETION_TOKENS,
  rationaleFromActivities,
  shouldCacheMusePlan,
  uniquePlanCandidates,
} from '@/lib/musePlan';
import { calculateAvailabilityOverlap, filterActivities } from '@/lib/planner';
import { activityPolicy } from '@/lib/activityPolicy';
import { getActivitiesForLocation } from '@/lib/mockData';
import { museCallAllowed, museCallsToday, museMaxCallsPerDay } from '@/lib/museUsage';
import type { HangoutBudgetEstimate } from '@/lib/nessieBudget';

const MUSE_MODEL = process.env.MUSE_MODEL || 'muse-spark-1.3';

interface PlanSynthesisRequestBody {
  preferences: HangoutPreferences;
  viewType: PlanningViewType;
  activities?: Activity[];
  nessie?: HangoutBudgetEstimate | null;
}

export async function POST(req: NextRequest) {
  try {
    await connection();
    const body = (await req.json()) as PlanSynthesisRequestBody;
    const { preferences, viewType, activities } = body;

    if (!preferences) {
      return NextResponse.json({ error: 'Missing preferences payload' }, { status: 400 });
    }

    const location = preferences.location?.trim() || 'Austin, TX';
    const cleanCity = location.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || 'Austin';
    const cityName = formatCityLabel(cleanCity);
    const db = getDb();
    const now = new Date();

    let discoveredForCity: Activity[] = [];
    try {
      const discovery = await discoverActivities(db, {
        location,
        category: 'all',
        allowMuse: false,
      });
      if (discovery.activities && discovery.activities.length > 0) {
        discoveredForCity = discovery.activities;
      }
    } catch {
      // OpenSERP can be down. The catalog below still gives the plan real places.
    }

    const pool: Activity[] = [];
    if (discoveredForCity.length > 0) {
      pool.push(...discoveredForCity);
      if (Array.isArray(activities)) {
        for (const act of activities) {
          if (!pool.some((item) => item.id === act.id || item.name.toLowerCase() === act.name.toLowerCase())) {
            pool.push(act);
          }
        }
      }
    } else if (Array.isArray(activities) && activities.length > 0) {
      pool.push(...activities);
    } else {
      pool.push(...getActivitiesForLocation(location));
    }

    let filtered = filterActivities(
      pool,
      preferences.maxBudgetPerPerson > 0 ? preferences.maxBudgetPerPerson : undefined,
      preferences.selectedInterests?.length ? preferences.selectedInterests : undefined
    );
    if (filtered.length < 3) filtered = pool;
    const candidates = rankPlanCandidates(uniquePlanCandidates(filtered.length > 0 ? filtered : pool));

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No candidate activities available' }, { status: 400 });
    }

    const overlap = calculateAvailabilityOverlap(preferences.friends || []);
    const cacheKey = stablePlanCacheKey({
      hangoutId: preferences.id,
      city: cityName,
      windowStart: overlap.commonStart,
      windowEnd: overlap.commonEnd,
      budgetTier: preferences.maxBudgetPerPerson,
      interests: preferences.selectedInterests || [],
      candidateIds: candidates.map((activity) => activity.id),
      viewType,
    });
    const cached = readMuseCache(db, cacheKey, now);
    if (cached) {
      const cachedPicks = (cached.picked || []) as Array<{ id: string; whyThisFits?: string }>;
      const pickedActivities = cachedPicks
        .map((pick) => {
          const found = candidates.find((item) => item.id === pick.id);
          return found ? { ...found, whyThisFits: pick.whyThisFits } : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return NextResponse.json({
        isLive: true,
        cached: true,
        cachedAt: cached.createdAt,
        openSerpGrounded: discoveredForCity.length > 0,
        location: cityName,
        model: cached.model,
        aiRationale: cached.aiRationale,
        aiIcebreaker: cached.aiIcebreaker,
        aiCoordinationTip: cached.aiCoordinationTip,
        budgetExplanation: cached.budgetExplanation,
        budgetTips: cached.budgetTips,
        activities: pickedActivities.length > 0 ? pickedActivities : candidates.slice(0, 3),
      });
    }

    if (!process.env.MUSE_API_KEY?.trim()) {
      return NextResponse.json({
        isLive: false,
        openSerpGrounded: discoveredForCity.length > 0,
        location: cityName,
        notice: 'MUSE_API_KEY is not configured in .env.local',
      });
    }

    const grounded = withSavedEnrichment(candidates, db);
    const enrichRoom = museCallsToday(db, now) + 1 < museMaxCallsPerDay() && museCallAllowed(db, now);
    if (enrichRoom) {
      const enrichIds = grounded
        .filter((activity) => {
          const row = getActivityRow(db, activity.id);
          return Boolean(row && !row.enriched_at);
        })
        .slice(0, PLAN_ENRICH_LIMIT)
        .map((activity) => activity.id);
      if (enrichIds.length > 0) {
        await enrichStoredActivities(db, enrichIds, undefined, {
          maxNew: PLAN_ENRICH_LIMIT,
          includeExtras: false,
        });
      }
    }
    const promptCandidates = withSavedEnrichment(grounded, db);
    const forMuse = promptCandidates.filter((activity) => !isListicleListing(activity.name));
    const museList = (forMuse.length >= 3 ? forMuse : promptCandidates).slice(0, 10);

    const friendNames = (preferences.friends || []).map((friend) => friend.name).filter(Boolean).join(', ');
    const groupTotal = hangoutGroupSize(preferences);
    const viewTypeDescriptions: Record<PlanningViewType, string> = {
      overall: `The Prime ${cityName} Match: balanced group harmony, iconic local culture, and steady pacing`,
      cheapest: `Wallet-Friendly ${cityName} Adventure: maximizing fun while keeping per-person spend as low as possible`,
      interests: 'Interests & Passion Deep-Dive: strictly dialed to the friends highest-affinity vibe selections',
    };
    const systemPrompt = `You are Meta Muse Spark, an intelligent social planning copilot for friend groups hanging out in ${cityName}.
You synthesize custom hangout itineraries, availability windows, and group vibes into cohesive social experiences.
You must choose up to 3 activity ids from the Candidate Activities list that best fit the squad's budget, overlap time window, and interests.
Prefer a specific venue or a dated event over a listicle or roundup page such as "18 Best Group Activities in Austin".
You must respond with ONLY a single raw JSON object (no markdown, no backticks, no code blocks) matching this schema:
{
  "picks": [
    { "id": "exact activity id from candidates", "whyThisFits": "one short sentence explaining why this fits the squad" }
  ],
  "aiRationale": "2-3 punchy, encouraging sentences explaining why this sequence works well for the squad, mentioning their time window or ${cityName} local flavor.",
  "aiIcebreaker": "1 clever question, dare, or mini-trivia tailored to one of the selected venues for the group to talk about.",
  "aiCoordinationTip": "1 practical coordination tip (e.g. parking, timing, or regroup buffer).",
  "budgetExplanation": "plain language for the budget figure, or empty if none were provided",
  "budgetTips": ["up to 3 short tips"]
}
${museBudgetPromptRules()}`;

    const candidateList = museList
      .map(
        (activity, index) =>
          `${index + 1}. [ID: ${activity.id}] ${activity.name} in ${activity.neighborhood} ($${activity.estimatedCostPerPerson}/person, Category: ${activity.categoryLabel || activity.category})`
      )
      .join('\n');
    const budgetInfo = museBudgetForPrompt(body.nessie);
    const userPrompt = `Squad: "${preferences.groupName || 'Friends'}"
${groupSizeInstruction(groupTotal)}
People: ${friendNames || 'the group'}
Location: ${cityName}
Target Date: ${preferences.date || 'Upcoming Saturday'}
Availability Overlap Window: ${overlap.commonStart} to ${overlap.commonEnd} (${overlap.overlapHours} hours total)
Target Budget: $${preferences.maxBudgetPerPerson}/person
Optimization Goal: ${viewTypeDescriptions[viewType] || viewTypeDescriptions.overall}
Financial context: ${budgetInfo ? JSON.stringify(budgetInfo) : 'none'}

Candidate Activities (discovered via OpenSERP / local catalog):
${candidateList}

Select up to 3 specific venues or events from the Candidate Activities and generate the JSON synthesis:`;

    const result = await museComplete(db, {
      purpose: 'plan',
      cacheKey: `plan:${cacheKey}`,
      temperature: 0.7,
      maxTokens: PLAN_MAX_COMPLETION_TOKENS,
      reasoningEffort: ENRICH_REASONING_EFFORT,
      now,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const realPicks = promptCandidates.map((activity) => ({
      ...activity,
      whyThisFits: heuristicWhy(
        activity,
        preferences.selectedInterests || [],
        preferences.maxBudgetPerPerson,
        location
      ),
    }));

    if (result.limited) {
      const filled = fillPlanPicks([], realPicks).picks;
      return NextResponse.json({
        isLive: false,
        limited: true,
        filled: true,
        openSerpGrounded: discoveredForCity.length > 0,
        location: cityName,
        activities: filled,
        aiRationale: rationaleFromActivities(
          filled.map((activity) => activity.name),
          cityName
        ),
        notice: 'Muse daily limit reached. Showing saved spots instead of a new plan.',
      });
    }

    const parsed =
      result.content && !result.truncated
        ? parseMusePlan(result.content, new Set(museList.map((activity) => activity.id)))
        : null;
    const musePicks = (parsed?.picks || [])
      .map((pick) => {
        const match = promptCandidates.find((activity) => activity.id === pick.id);
        return match ? { ...match, whyThisFits: pick.whyThisFits } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const filled = fillPlanPicks(musePicks, realPicks);
    const aiRationale =
      parsed?.aiRationale ||
      rationaleFromActivities(
        filled.picks.map((activity) => activity.name),
        cityName
      );
    const cacheable = shouldCacheMusePlan({
      truncated: result.truncated,
      content: result.content,
      usableMusePicks: filled.usableMusePicks,
      rationale: parsed?.aiRationale,
    });

    if (cacheable && parsed) {
      try {
        writeMuseCache(
          db,
          cacheKey,
          {
            model: MUSE_MODEL,
            aiRationale,
            aiIcebreaker: parsed.aiIcebreaker,
            aiCoordinationTip: parsed.aiCoordinationTip,
            budgetExplanation: parsed.budgetExplanation,
            budgetTips: parsed.budgetTips,
            picked: filled.picks.map((activity) => ({ id: activity.id, whyThisFits: activity.whyThisFits })),
          },
          now,
          activityPolicy().museCacheTtlMs
        );
      } catch {
        // A plan can still be returned when SQLite refuses the cache write.
      }
    }

    return NextResponse.json({
      isLive: Boolean(result.content) && !result.truncated && filled.usableMusePicks > 0,
      filled: filled.degraded || result.truncated || !parsed?.aiRationale,
      cached: false,
      openSerpGrounded: discoveredForCity.length > 0,
      location: cityName,
      model: MUSE_MODEL,
      aiRationale,
      aiIcebreaker: parsed?.aiIcebreaker,
      aiCoordinationTip: parsed?.aiCoordinationTip,
      budgetExplanation: parsed?.budgetExplanation,
      budgetTips: parsed?.budgetTips,
      activities: filled.picks,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      isLive: false,
      error: message,
    });
  }
}

function rankPlanCandidates(activities: Activity[]): Activity[] {
  return [...activities].sort((left, right) => Number(isListicleListing(left.name)) - Number(isListicleListing(right.name)));
}

function withSavedEnrichment(activities: Activity[], db: ReturnType<typeof getDb>): Activity[] {
  return activities.map((activity) => {
    const row = getActivityRow(db, activity.id);
    if (!row?.enriched_at) return activity;
    return {
      ...activity,
      category: row.category,
      categoryLabel: row.category_label,
      estimatedCostPerPerson: row.estimated_cost,
      neighborhood: row.venue || row.neighborhood || activity.neighborhood,
      venue: row.venue || activity.venue,
      address: row.address || activity.address,
      kind: row.kind,
      museEnriched: true,
    };
  });
}
