import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { discoverActivities } from '@/lib/discoverActivities';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await connection();
  const { searchParams } = new URL(req.url);
  const payload = await discoverActivities(getDb(), {
    query: searchParams.get('q') || '',
    category: searchParams.get('category') || 'all',
    location: searchParams.get('location') || 'Austin, TX',
  });
  return NextResponse.json(payload);
}
