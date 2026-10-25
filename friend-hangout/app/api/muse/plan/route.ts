import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { HangoutPreferences, PlanningViewType, Activity } from '@/types';
import { getDb } from '@/lib/db';
import { discoverActivities } from '@/lib/discoverActivities';
import { musePlanCacheKey, readMuseCache, writeMuseCache } from '@/lib/museCache';
import { heuristicWhy, uniquePlanCandidates, museBudgetForPrompt } from '@/lib/musePlan';
import { calculateAvailabilityOverlap, filterActivities } from '@/lib/planner';
import { activityPolicy } from '@/lib/activityPolicy';
import { getActivitiesForLocation } from '@/lib/mockData';
import type { HangoutBudgetEstimate } from '@/lib/nessieBudget';

const MUSE_API_KEY = process.env.MUSE_API_KEY;
const MUSE_BASE_URL = process.env.MUSE_BASE_URL || 'https://api.meta.ai/v1';
const MUSE_MODEL = process.env.MUSE_MODEL || 'muse-spark-1.3';

interface PlanSynthesisRequestBody {
  preferences: HangoutPreferences;
  viewType: PlanningViewType;
  activities?: Activity[];
  nessie?: HangoutBudgetEstimate | null;
}

interface MuseParsedResponse {
  picks?: Array<{ id: string; whyThisFits?: string }>;
  aiRationale?: string;
  aiIcebreaker?: string;
  aiCoordinationTip?: string;
}

export async function POST(req: NextRequest) {
  try {
    await connection();
    const body = (await req.json()) as PlanSynthesisRequestBody;
    const { preferences, viewType, activities } = body;

    if (!preferences) {
      return NextResponse.json(
        { error: 'Missing preferences payload' },
        { status: 400 }
      );
    }

    const location = preferences.location?.trim() || 'Austin, TX';
    const cleanCity = location.replace(/\(.*?\)/g, '').split(',')[0]?.trim() || 'Austin';
    const cityName = cleanCity.charAt(0).toUpperCase() + cleanCity.slice(1);

    const db = getDb();

    // 1. Discover live candidate activities for the target city using OpenSERP
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
      // If OpenSERP is unavailable, proceed to fallback candidates
    }

    // 2. Assemble candidate pool
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

    // 3. Filter candidates by budget & selected interests
    let filtered = filterActivities(
      pool,
      preferences.maxBudgetPerPerson > 0 ? preferences.maxBudgetPerPerson : undefined,
      preferences.selectedInterests?.length ? preferences.selectedInterests : undefined
    );
    if (filtered.length < 3) {
      filtered = pool;
    }
    const candidates = uniquePlanCandidates(filtered.length > 0 ? filtered : pool);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'No candidate activities available' },
        { status: 400 }
      );
    }

    // 4. Check cache in SQLite
    const now = new Date();
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
      const cachedPicks = (cached.picked || []) as Array<{ id: string; whyThisFits?: string }>;
      const pickedActivities = cachedPicks
        .map((pick) => {
          const found = candidates.find((c) => c.id === pick.id);
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
        activities: pickedActivities.length > 0 ? pickedActivities : candidates.slice(0, 3),
      });
    }

    // 5. If no API key configured, return heuristic fallback picks
    if (!MUSE_API_KEY) {
      const fallbackPicks = candidates.slice(0, 3).map((act) => ({
        ...act,
        whyThisFits: heuristicWhy(act, preferences.selectedInterests || [], preferences.maxBudgetPerPerson, location),
      }));
      return NextResponse.json({
        isLive: false,
        openSerpGrounded: discoveredForCity.length > 0,
        location: cityName,
        activities: fallbackPicks,
        notice: 'MUSE_API_KEY is not configured in .env.local',
      });
    }

    // 6. Synthesize plan with Meta Muse Spark
    const overlap = calculateAvailabilityOverlap(preferences.friends || []);
    const friendNames = (preferences.friends || []).map((f) => f.name).join(', ') || 'The squad';

    const viewTypeDescriptions: Record<PlanningViewType, string> = {
      overall: `The Prime ${cityName} Match: balanced group harmony, iconic local culture, and steady pacing`,
      cheapest: `Wallet-Friendly ${cityName} Adventure: maximizing fun while keeping per-person spend as low as possible`,
      interests: 'Interests & Passion Deep-Dive: strictly dialed to the friends highest-affinity vibe selections',
    };

    const systemPrompt = `You are Meta Muse Spark, an intelligent social planning copilot for friend groups hanging out in ${cityName}.
You synthesize custom hangout itineraries, availability windows, and group vibes into cohesive social experiences.
You must choose up to 3 activity ids from the Candidate Activities list that best fit the squad's budget, overlap time window, and interests.
You must respond with ONLY a single raw JSON object (no markdown, no backticks, no code blocks) matching this schema:
{
  "picks": [
    { "id": "exact activity id from candidates", "whyThisFits": "one short sentence explaining why this fits the squad" }
  ],
  "aiRationale": "2-3 punchy, encouraging sentences explaining why this sequence works well for the squad, mentioning their time window or ${cityName} local flavor.",
  "aiIcebreaker": "1 clever question, dare, or mini-trivia tailored to one of the selected venues for the group to talk about.",
  "aiCoordinationTip": "1 practical coordination tip (e.g. parking, timing, or regroup buffer)."
}`;

    const candidateList = candidates
      .slice(0, 10)
      .map((a, i) => `${i + 1}. [ID: ${a.id}] ${a.name} in ${a.neighborhood} ($${a.estimatedCostPerPerson}/person, Category: ${a.categoryLabel || a.category})`)
      .join('\n');

    const budgetInfo = museBudgetForPrompt(body.nessie);

    const userPrompt = `Squad: "${preferences.groupName || 'Friends'}" (${preferences.friendCount} people: ${friendNames})
Location: ${cityName}
Target Date: ${preferences.date || 'Upcoming Saturday'}
Availability Overlap Window: ${overlap.commonStart} to ${overlap.commonEnd} (${overlap.overlapHours} hours total)
Target Budget: $${preferences.maxBudgetPerPerson}/person
Optimization Goal: ${viewTypeDescriptions[viewType] || viewTypeDescriptions.overall}
${budgetInfo ? `Financial Context: ${budgetInfo.figureLabel} suggests $${budgetInfo.suggestedPerPerson}/person.` : ''}

Candidate Activities (discovered via OpenSERP / local catalog):
${candidateList}

Select up to 3 best stops from the Candidate Activities and generate the JSON synthesis:`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout for reasoning models

    const res = await fetch(`${MUSE_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MUSE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MUSE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Meta Muse Spark API returned error status:', res.status, errText);
      const fallbackPicks = candidates.slice(0, 3).map((act) => ({
        ...act,
        whyThisFits: heuristicWhy(act, preferences.selectedInterests || [], preferences.maxBudgetPerPerson, location),
      }));
      return NextResponse.json({
        isLive: false,
        openSerpGrounded: discoveredForCity.length > 0,
        location: cityName,
        activities: fallbackPicks,
        error: `Meta Muse API error ${res.status}`,
      });
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      const fallbackPicks = candidates.slice(0, 3).map((act) => ({
        ...act,
        whyThisFits: heuristicWhy(act, preferences.selectedInterests || [], preferences.maxBudgetPerPerson, location),
      }));
      return NextResponse.json({
        isLive: false,
        openSerpGrounded: discoveredForCity.length > 0,
        location: cityName,
        activities: fallbackPicks,
        error: 'Empty response content from Meta Muse Spark',
      });
    }

    // Clean any potential markdown wrapping
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: MuseParsedResponse | null = null;
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

    // Resolve picks to Activity objects
    const pickedActivities: Activity[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(parsed?.picks)) {
      for (const pick of parsed.picks) {
        if (!pick || typeof pick.id !== 'string') continue;
        const match = candidates.find((c) => c.id === pick.id);
        if (match && !seenIds.has(match.id)) {
          seenIds.add(match.id);
          pickedActivities.push({
            ...match,
            whyThisFits: pick.whyThisFits || `Selected by Meta Muse for ${cityName}`,
          });
          if (pickedActivities.length >= 3) break;
        }
      }
    }

    // If fewer than 3 were picked, pad with top candidates
    if (pickedActivities.length < 3) {
      for (const candidate of candidates) {
        if (!seenIds.has(candidate.id)) {
          seenIds.add(candidate.id);
          pickedActivities.push({
            ...candidate,
            whyThisFits: heuristicWhy(candidate, preferences.selectedInterests || [], preferences.maxBudgetPerPerson, location),
          });
          if (pickedActivities.length >= 3) break;
        }
      }
    }

    const aiRationale = parsed?.aiRationale || `Meta Muse Spark curated top stops for ${cityName} to fit your squad's vibe and budget.`;

    // Cache valid plan synthesis in SQLite
    try {
      writeMuseCache(
        db,
        cacheKey,
        {
          model: MUSE_MODEL,
          aiRationale,
          aiIcebreaker: parsed?.aiIcebreaker,
          aiCoordinationTip: parsed?.aiCoordinationTip,
          picked: pickedActivities.map((a) => ({ id: a.id, whyThisFits: a.whyThisFits })),
        },
        now,
        activityPolicy().museCacheTtlMs
      );
    } catch {
      // Ignore cache write failures
    }

    return NextResponse.json({
      isLive: true,
      openSerpGrounded: discoveredForCity.length > 0,
      location: cityName,
      model: MUSE_MODEL,
      aiRationale,
      aiIcebreaker: parsed?.aiIcebreaker,
      aiCoordinationTip: parsed?.aiCoordinationTip,
      activities: pickedActivities,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      isLive: false,
      error: message,
    });
  }
}
