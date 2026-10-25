import { NextResponse } from 'next/server';
import { NESSIE_REQUEST_TIMEOUT_MS, nessieBaseUrl, nessieCheckUrl } from '@/lib/nessieServer';

const NESSIE_API_KEY = process.env.NESSIE_API_KEY;

export async function GET() {
  const endpoint = nessieBaseUrl();
  if (!NESSIE_API_KEY) {
    return NextResponse.json({
      isLive: false,
      status: 'simulated',
      endpoint,
      notice: 'NESSIE_API_KEY is not configured in .env.local. Running in local deterministic financial simulation mode.',
    });
  }

  try {
    const res = await fetch(nessieCheckUrl(NESSIE_API_KEY), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(NESSIE_REQUEST_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        isLive: true,
        status: 'connected',
        endpoint,
        sampleMerchantCount: Array.isArray(data) ? data.length : 0,
      });
    }

    return NextResponse.json({
      isLive: false,
      status: 'error',
      endpoint,
      statusCode: res.status,
      error: `Capital One Nessie responded with status ${res.status}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({
      isLive: false,
      status: 'error',
      endpoint,
      error: message,
    });
  }
}
