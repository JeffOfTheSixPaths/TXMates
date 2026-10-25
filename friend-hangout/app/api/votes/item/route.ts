import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  getUserItemVotes,
  getDownvotedActivities,
  recordUserItemVote,
} from '@/lib/userVotes';
import type { ItemVoteReaction } from '@/types';

export async function GET(req: NextRequest) {
  try {
    await connection();
    const { searchParams } = new URL(req.url);

    const userIdsParam = searchParams.get('userIds');
    const customerIdsParam = searchParams.get('customerIds');
    const activityIdsParam = searchParams.get('activityIds');

    const userIds = userIdsParam ? userIdsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const customerIds = customerIdsParam ? customerIdsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const activityIds = activityIdsParam ? activityIdsParam.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    const db = getDb();
    const votes = getUserItemVotes(db, { userIds, customerIds, activityIds });
    const downvoted = getDownvotedActivities(db, { userIds, customerIds });

    return NextResponse.json({
      votes,
      downvotedActivityIds: Array.from(downvoted.ids),
      downvotedActivityNames: Array.from(downvoted.names),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch item votes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface VoteItemBody {
  userId: string;
  customerId?: string;
  friendName: string;
  activityId: string;
  activityName: string;
  vote: ItemVoteReaction | null;
}

export async function POST(req: NextRequest) {
  try {
    await connection();
    const body = (await req.json()) as VoteItemBody;

    if (!body || !body.userId || !body.activityId || !body.friendName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, friendName, and activityId are required.' },
        { status: 400 }
      );
    }

    if (body.vote !== null && body.vote !== 'up' && body.vote !== 'love' && body.vote !== 'down') {
      return NextResponse.json(
        { error: "Invalid vote value. Must be 'up', 'love', 'down', or null." },
        { status: 400 }
      );
    }

    const db = getDb();
    const result = recordUserItemVote(db, {
      userId: body.userId,
      customerId: body.customerId,
      friendName: body.friendName,
      activityId: body.activityId,
      activityName: body.activityName,
      vote: body.vote,
    });

    const downvoted = getDownvotedActivities(db, {
      userIds: [body.userId],
      customerIds: body.customerId ? [body.customerId] : undefined,
    });

    const message =
      body.vote === 'down'
        ? `Saved to ${body.friendName}'s account: Future recommendations will show this place less often.`
        : body.vote === 'love'
          ? `Saved to ${body.friendName}'s account: Highly recommended!`
          : body.vote === 'up'
            ? `Saved to ${body.friendName}'s account: Liked for future plans.`
            : `Vote cleared from ${body.friendName}'s account.`;

    return NextResponse.json({
      ok: true,
      result,
      vote: body.vote,
      activityId: body.activityId,
      userId: body.userId,
      downvotedActivityIds: Array.from(downvoted.ids),
      downvotedActivityNames: Array.from(downvoted.names),
      message,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record vote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
