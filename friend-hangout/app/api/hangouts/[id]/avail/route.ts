import { NextRequest, NextResponse } from 'next/server';
import { updateFriendSubmission } from '@/lib/db';
import { ActivityCategory } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      friendId: string;
      friendName?: string;
      avatarColor?: string;
      startTime: string;
      endTime: string;
      budgetPreference?: number;
      topInterests?: ActivityCategory[];
    };

    if (!body.friendId || !body.startTime || !body.endTime) {
      return NextResponse.json(
        { error: 'Missing required fields (friendId, startTime, endTime)' },
        { status: 400 }
      );
    }

    const success = updateFriendSubmission(id, body.friendId, {
      friendName: body.friendName,
      avatarColor: body.avatarColor,
      startTime: body.startTime,
      endTime: body.endTime,
      budgetPreference: body.budgetPreference,
      topInterests: body.topInterests,
    });

    if (!success) {
      return NextResponse.json({ error: 'Hangout not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error recording friend availability in SQL:', err);
    return NextResponse.json(
      { error: 'Failed to record availability' },
      { status: 500 }
    );
  }
}
