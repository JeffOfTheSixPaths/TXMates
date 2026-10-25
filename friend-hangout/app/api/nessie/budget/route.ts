import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { loadNessieBudget, safeId } from '@/lib/nessieServer';

export async function GET(req: NextRequest) {
  await connection();
  const friendCount = Number(req.nextUrl.searchParams.get('friendCount') || '1');
  const budget = await loadNessieBudget({
    customerId: safeId(req.nextUrl.searchParams.get('customerId')),
    accountId: safeId(req.nextUrl.searchParams.get('accountId')),
    friendCount: Number.isFinite(friendCount) ? friendCount : 1,
    now: new Date(),
  });
  return NextResponse.json(budget);
}
