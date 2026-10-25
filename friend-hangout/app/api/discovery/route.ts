import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { discoverActivities } from '@/lib/discoverActivities';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await connection();
  const { searchParams } = new URL(req.url);
  const rawQ = searchParams.get('q') || '';
  const category = (searchParams.get('category') || 'all') as string;
  let location = searchParams.get('location') || '';

  // Extract city if explicitly typed in search query (e.g. "boston bakeries", "dallas parks")
  let cleanQ = rawQ;
  const popularCities = [
    'dallas', 'boston', 'san antonio', 'houston', 'chicago',
    'new york', 'nyc', 'austin', 'seattle', 'denver',
    'miami', 'atlanta', 'los angeles', 'san francisco', 'orlando'
  ];

  for (const city of popularCities) {
    const reg = new RegExp(`\\b${city}\\b`, 'i');
    if (reg.test(rawQ)) {
      location = city.charAt(0).toUpperCase() + city.slice(1);
      cleanQ = rawQ.replace(new RegExp(`\\b${city}\\s*(,\\s*[a-z]{2})?\\b`, 'gi'), '').trim();
      break;
    }
  }

  const effectiveLocation = location || 'Austin, TX';

  const payload = await discoverActivities(getDb(), {
    query: cleanQ,
    category,
    location: effectiveLocation,
    allowMuse: true,
  });

  return NextResponse.json(payload);
}
