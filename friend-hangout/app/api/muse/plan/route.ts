import { NextRequest, NextResponse } from 'next/server';
import { HangoutPreferences, PlanningViewType, Activity } from '@/types';
import { calculateAvailabilityOverlap } from '@/lib/planner';

const MUSE_API_KEY = process.env.MUSE_API_KEY;
const MUSE_BASE_URL = process.env.MUSE_BASE_URL || 'https://api.meta.ai/v1';
const MUSE_MODEL = process.env.MUSE_MODEL || 'muse-spark-1.3';

interface PlanSynthesisRequestBody {
  preferences: HangoutPreferences;
  viewType: PlanningViewType;
  activities: Activity[];
}

interface MuseParsedResponse {
  aiRationale: string;
  aiIcebreaker?: string;
  aiCoordinationTip?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlanSynthesisRequestBody;
    const { preferences, viewType, activities } = body;

    if (!preferences || !activities || activities.length === 0) {
      return NextResponse.json(
        { error: 'Missing preferences or activities payload' },
        { status: 400 }
      );
    }

    if (!MUSE_API_KEY) {
      return NextResponse.json({
        isLive: false,
        notice: 'MUSE_API_KEY is not configured in .env.local',
      });
    }

    const overlap = calculateAvailabilityOverlap(preferences.friends || []);
    const friendNames = (preferences.friends || []).map((f) => f.name).join(', ') || 'The squad';
    const activityList = activities
      .map((a, i) => `${i + 1}. ${a.name} in ${a.neighborhood} ($${a.estimatedCostPerPerson}/person)`)
      .join('\n');

    const totalCost = activities.reduce((sum, a) => sum + a.estimatedCostPerPerson, 0);

    const viewTypeDescriptions: Record<PlanningViewType, string> = {
      overall: 'The Prime Austin Match: balanced group harmony, iconic local culture, and steady pacing',
      cheapest: 'Wallet-Friendly Austin Adventure: maximizing fun while keeping per-person spend as low as possible',
      interests: 'Interests & Passion Deep-Dive: strictly dialed to the friends highest-affinity vibe selections',
    };

    const systemPrompt = `You are Meta Muse Spark, an intelligent social planning copilot for friend groups hanging out in Austin, TX.
You synthesize custom hangout itineraries, availability windows, and group vibes into cohesive social experiences.
You must respond with ONLY a single raw JSON object (no markdown, no backticks, no code blocks) matching this schema:
{
  "aiRationale": "2-3 punchy, encouraging sentences explaining why this sequence works well for the squad, mentioning their time window or Austin local flavor.",
  "aiIcebreaker": "1 clever question, dare, or mini-trivia tailored to one of the selected venues for the group to talk about.",
  "aiCoordinationTip": "1 practical coordination tip (e.g. parking, timing, or regroup buffer)."
}`;

    const userPrompt = `Squad: "${preferences.groupName || 'Friends'}" (${preferences.friendCount} people: ${friendNames})
Target Date: ${preferences.date || 'Upcoming Saturday'}
Availability Overlap Window: ${overlap.commonStart} to ${overlap.commonEnd} (${overlap.overlapHours} hours total)
Target Budget: $${preferences.maxBudgetPerPerson}/person (Current Plan: $${totalCost}/person)
Optimization Goal: ${viewTypeDescriptions[viewType] || viewTypeDescriptions.overall}

Proposed Activities:
${activityList}

Generate the custom Meta Muse Spark plan synthesis JSON:`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

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
        max_tokens: 1800, // accommodate reasoning tokens + output tokens
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Meta Muse Spark API returned error status:', res.status, errText);
      return NextResponse.json({
        isLive: false,
        error: `Meta Muse API error ${res.status}`,
      });
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json({
        isLive: false,
        error: 'Empty response content from Meta Muse Spark',
      });
    }

    // Clean any potential markdown wrapping
    const cleaned = rawContent
      .replace(/^```(json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    try {
      const parsed: MuseParsedResponse = JSON.parse(cleaned);
      return NextResponse.json({
        isLive: true,
        model: MUSE_MODEL,
        aiRationale: parsed.aiRationale,
        aiIcebreaker: parsed.aiIcebreaker,
        aiCoordinationTip: parsed.aiCoordinationTip,
      });
    } catch {
      // If JSON parsing fails, extract raw string as aiRationale
      return NextResponse.json({
        isLive: true,
        model: MUSE_MODEL,
        aiRationale: cleaned,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      isLive: false,
      error: message,
    });
  }
}
