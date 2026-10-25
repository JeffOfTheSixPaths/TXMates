import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { Friend } from '@/types';
import { INITIAL_FRIENDS } from '@/lib/mockData';
import { estimateSquadPricePoint } from '@/lib/nessiePricePoint';

export async function GET() {
  await connection();
  const advisory = await estimateSquadPricePoint(INITIAL_FRIENDS);
  return NextResponse.json(advisory);
}

export async function POST(req: NextRequest) {
  await connection();
  try {
    const body = await req.json().catch(() => ({}));
    const friends: Friend[] = Array.isArray(body?.friends) && body.friends.length > 0
      ? body.friends
      : INITIAL_FRIENDS;

    const advisory = await estimateSquadPricePoint(friends);
    return NextResponse.json(advisory);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
