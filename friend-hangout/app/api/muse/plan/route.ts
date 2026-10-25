import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { HangoutPreferences, PlanningViewType, Activity } from '@/types';
import { getDb } from '@/lib/db';
import { activityPolicy } from '@/lib/activityPolicy';
import { discoverActivities } from '@/lib/discoverActivities';
import { musePlanCacheKey, readMuseCache, writeMuseCache } from '@/lib/museCache';
import { museComplete } from '@/lib/museClient';
import { ENRICH_REASONING_EFFORT } from '@/lib/museEnrich';
import { heuristicWhy, museBudgetForPrompt, musePlanSystemPrompt, parseMusePlan, PLAN_MAX_COMPLETION_TOKENS, uniquePlanCandidates } from '@/lib/musePlan';
import { calculateAvailabilityOverlap, filterActivities } from '@/lib/planner';
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

    const now = new Date();
    const db = getDb();
    const location = preferences.location?.trim() || 'Austin, TX';

    // 1. Discover activities for the target city using OpenSERP / saved activities
    let discoveredForCity: Activity[] = [];
    try {
      const discovery = await discoverActivities(db, {
        location,
        category: 'all',
        allowMuse: true,
      });
      if (discovery.activities && discovery.activities.length > 0) {
        discoveredForCity = discovery.activities;
      }
    } catch {
      // Fallback to provided activities
    }

    // 2. Assemble candidate pool
    let pool: Activity[] = [];
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
      pool = activities;
    }

    // 3. Filter candidates by budget & selected interests
    let filtered = filterActivities(
      pool,
      preferences.maxBudgetPerPerson > 0 ? preferences.maxBudgetPerPerson : undefined,
      preferences.selectedInterests?.length ? preferences.selectedInterests : undefined
    );
    if (filtered.length < 3) {
      filtered = pool;
    }
    const candidates = uniquePlanCandidates(filtered.length > 0 ? filtered : (activities || []));

    if (candidates.length === 0) {
      return NextResponse.json({ error: 'No candidate activities available' }, { status: 400 });
    }

    const cacheKey = musePlanCacheKey({
      viewType,
      model: MUSE_MODEL,
      preferences,
      activities: candidates,
      budget: body.nessie
        ? {
            source: body.nessie.source,
            suggestedPerPerson: body.nessie.suggestedPerPerson,
            balance: body.nessie.balance,
            discretionary: body.nessie.discretionary,
          }
        : null,
    });
    const cached = readMuseCache(db, cacheKey, now);
    if (cached) {
      return NextResponse.json({
        isLive: true,
        cached: true,
        cachedAt: cached.createdAt,
        openSerpGrounded: discoveredForCity.length > 0,
        location,
        model: cached.model,
        aiRationale: cached.aiRationale,
        aiIcebreaker: cached.aiIcebreaker,
        aiCoordinationTip: cached.aiCoordinationTip,
        activities: cached.picked || [],
        budgetExplanation: cached.budgetExplanation,
        budgetTips: cached.budgetTips,
      });
    }

    if (!process.env.MUSE_API_KEY?.trim()) {
      const fallbackPicks = candidates.slice(0, 3).map((activity) => ({
        ...activity,
        whyThisFits: heuristicWhy(activity, preferences.selectedInterests || [], preferences.maxBudgetPerPerson),
      }));
      return NextResponse.json({
        isLive: false,
        openSerpGrounded: discoveredForCity.length > 0,
        location,
        activities: fallbackPicks,
        notice: 'MUSE_API_KEY is not configured in .env.local',
      });
    }

    const overlap = calculateAvailabilityOverlap(preferences.friends || []);
    const nessie = body.nessie;
    const systemPrompt = musePlanSystemPrompt(location);
    const userPrompt = JSON.stringify({
      location,
      group: preferences.groupName,
      friendCount: preferences.friendCount,
      date: preferences.date,
      overlap,
      maxBudgetPerPerson: preferences.maxBudgetPerPerson,
      interests: preferences.selectedInterests,
      viewType,
      nessie: museBudgetForPrompt(nessie),
      candidates: candidates.map((activity) => ({
        id: activity.id,
        name: activity.name,
        category: activity.category,
        neighborhood: activity.neighborhood,
        cost: activity.estimatedCostPerPerson,
        kind: activity.kind || 'place',
        description: activity.description.slice(0, 180),
      })),
    });

    const result = await museComplete(db, {
      purpose: 'plan',
      cacheKey: `plan:${cacheKey}`,
      temperature: 0.4,
      maxTokens: PLAN_MAX_COMPLETION_TOKENS,
      reasoningEffort: ENRICH_REASONING_EFFORT,
      now,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    if (result.limited) {
      return NextResponse.json({
        isLive: false,
        limited: true,
        openSerpGrounded: discoveredForCity.length > 0,
        location,
        activities: candidates.slice(0, 3).map((act) => ({
          ...act,
          whyThisFits: heuristicWhy(act, preferences.selectedInterests || [], preferences.maxBudgetPerPerson),
        })),
        notice: 'Muse daily limit reached. Showing the built-in picks.',
      });
    }
    if (result.truncated || !result.content) {
      return NextResponse.json({
        isLive: false,
        error: result.truncated ? 'Muse plan was cut off' : 'Muse did not return a plan',
      });
    }

    const parsed = parseMusePlan(result.content, new Set(candidates.map((activity) => activity.id)));
    const picks = parsed?.picks.length
      ? parsed.picks
      : candidates.slice(0, 3).map((activity) => ({
          id: activity.id,
          whyThisFits: heuristicWhy(activity, preferences.selectedInterests || [], preferences.maxBudgetPerPerson),
        }));
    const picked: Activity[] = [];
    for (const pick of picks) {
      const activity = candidates.find((item) => item.id === pick.id);
      if (activity) picked.push({ ...activity, whyThisFits: pick.whyThisFits });
    }
    const aiRationale = parsed?.aiRationale || '';
    if (!aiRationale && picked.length === 0) {
      return NextResponse.json({ isLive: false, error: 'Muse plan could not be read' });
    }

    writeMuseCache(
      db,
      cacheKey,
      {
        model: MUSE_MODEL,
        aiRationale: aiRationale || `Muse ranked these stops for ${location}.`,
        aiIcebreaker: parsed?.aiIcebreaker,
        aiCoordinationTip: parsed?.aiCoordinationTip,
        picked,
        budgetExplanation: parsed?.budgetExplanation,
        budgetTips: parsed?.budgetTips,
      },
      now,
      activityPolicy().museCacheTtlMs
    );

    return NextResponse.json({
      isLive: true,
      cached: result.cached,
      openSerpGrounded: discoveredForCity.length > 0,
      location,
      model: MUSE_MODEL,
      aiRationale: aiRationale || `Muse ranked these stops for ${location}.`,
      aiIcebreaker: parsed?.aiIcebreaker,
      aiCoordinationTip: parsed?.aiCoordinationTip,
      activities: picked,
      budgetExplanation: parsed?.budgetExplanation,
      budgetTips: parsed?.budgetTips,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ isLive: false, error: message });
  }
}
