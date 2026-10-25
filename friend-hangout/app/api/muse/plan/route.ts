import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { HangoutPreferences, PlanningViewType, Activity } from '@/types';
import { getDb } from '@/lib/db';
import { activityPolicy } from '@/lib/activityPolicy';
import { musePlanCacheKey, readMuseCache, writeMuseCache } from '@/lib/museCache';
import { museComplete } from '@/lib/museClient';
import { heuristicWhy, museBudgetForPrompt, musePlanSystemPrompt, parseMusePlan, uniquePlanCandidates } from '@/lib/musePlan';
import { calculateAvailabilityOverlap } from '@/lib/planner';
import type { HangoutBudgetEstimate } from '@/lib/nessieBudget';

const MUSE_MODEL = process.env.MUSE_MODEL || 'muse-spark-1.3';

interface PlanSynthesisRequestBody {
  preferences: HangoutPreferences;
  viewType: PlanningViewType;
  activities: Activity[];
  nessie?: HangoutBudgetEstimate | null;
}

export async function POST(req: NextRequest) {
  try {
    await connection();
    const body = (await req.json()) as PlanSynthesisRequestBody;
    const { preferences, viewType, activities } = body;

    if (!preferences || !activities || activities.length === 0) {
      return NextResponse.json({ error: 'Missing preferences or activities payload' }, { status: 400 });
    }

    const now = new Date();
    const db = getDb();
    const candidates = uniquePlanCandidates(activities);
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
      return NextResponse.json({
        isLive: false,
        notice: 'MUSE_API_KEY is not configured in .env.local',
      });
    }

    const overlap = calculateAvailabilityOverlap(preferences.friends || []);
    const nessie = body.nessie;
    const systemPrompt = musePlanSystemPrompt();
    const userPrompt = JSON.stringify({
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
      maxTokens: 1800,
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
        notice: 'Muse daily limit reached. Showing the built-in picks.',
      });
    }
    if (!result.content) {
      return NextResponse.json({ isLive: false, error: 'Muse did not return a plan' });
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
        aiRationale: aiRationale || 'Muse ranked these stops for the group.',
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
      model: MUSE_MODEL,
      aiRationale: aiRationale || 'Muse ranked these stops for the group.',
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
