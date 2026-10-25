import { NextResponse } from 'next/server';

const NESSIE_API_KEY = process.env.NESSIE_API_KEY;
const NESSIE_BASE_URL = process.env.NESSIE_BASE_URL || 'http://api.nessieisreal.com';

export async function GET() {
  if (!NESSIE_API_KEY) {
    return NextResponse.json({
      isLive: false,
      status: 'simulated',
      notice: 'NESSIE_API_KEY is not configured in .env.local. Running in local deterministic financial simulation mode.',
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${NESSIE_BASE_URL}/merchants?key=${NESSIE_API_KEY}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        isLive: true,
        status: 'connected',
        endpoint: NESSIE_BASE_URL,
        sampleMerchantCount: Array.isArray(data) ? data.length : 0,
      });
    }

    return NextResponse.json({
      isLive: false,
      status: 'error',
      statusCode: res.status,
      error: `Capital One Nessie responded with status ${res.status}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      isLive: false,
      status: 'error',
      error: message,
    });
  }
}
