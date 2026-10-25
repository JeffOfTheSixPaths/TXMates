import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { discoverActivities } from '@/lib/discoverActivities';
import { resolveDiscoveryLocation } from '@/lib/discoverySearch';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await connection();
  const { searchParams } = new URL(req.url);
  const rawQ = searchParams.get('q') || '';
  const category = (searchParams.get('category') || 'all') as string;
  const { location: effectiveLocation, query: cleanQ } = resolveDiscoveryLocation(
    rawQ,
    searchParams.get('location') || ''
  );

  const payload = await discoverActivities(getDb(), {
    query: cleanQ,
    category,
    location: effectiveLocation,
    allowMuse: true,
  });

  return NextResponse.json(payload);
}
