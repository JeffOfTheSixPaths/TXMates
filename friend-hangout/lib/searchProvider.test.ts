import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverActivities } from './discoverActivities.ts';
import { filterDiscoveryHits } from './discoverySearch.ts';
import {
  createActivitySearchProvider,
  mapSerpApiResults,
  resolveSearchProvider,
  type SearchContext,
  type SearchHit,
  type SearchLogger,
} from './searchProvider.ts';

const SECRET = 'test-serpapi-key-not-real';
const FIXTURE = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'serpapi-google.json'), 'utf8')
) as { google: unknown; google_local: unknown };

const DALLAS: SearchContext = { location: 'Dallas', query: 'bakeries in Dallas' };

function memoryLog(): { log: SearchLogger; lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    log: {
      info(message) {
        lines.push(`info:${message}`);
      },
      warn(message) {
        lines.push(`warn:${message}`);
      },
    },
  };
}

function passthrough(hits: SearchHit[]): SearchHit[] {
  return hits;
}

describe('search provider selection', () => {
  it('defaults to openserp when unset or invalid', () => {
    assert.deepEqual(resolveSearchProvider({}), { provider: 'openserp', fellBackFromMissingKey: false });
    assert.deepEqual(resolveSearchProvider({ SEARCH_PROVIDER: '' }), {
      provider: 'openserp',
      fellBackFromMissingKey: false,
    });
    assert.deepEqual(resolveSearchProvider({ SEARCH_PROVIDER: 'google' }), {
      provider: 'openserp',
      fellBackFromMissingKey: false,
    });
    assert.deepEqual(resolveSearchProvider({ SEARCH_PROVIDER: 'OpenSERP', SERPAPI_API_KEY: SECRET }), {
      provider: 'openserp',
      fellBackFromMissingKey: false,
    });
  });

  it('selects serpapi when SEARCH_PROVIDER=serpapi and a key is set', () => {
    assert.deepEqual(resolveSearchProvider({ SEARCH_PROVIDER: 'serpapi', SERPAPI_API_KEY: SECRET }), {
      provider: 'serpapi',
      fellBackFromMissingKey: false,
    });
    assert.deepEqual(resolveSearchProvider({ SEARCH_PROVIDER: '  SERPAPI  ', SERPAPI_API_KEY: `  ${SECRET}  ` }), {
      provider: 'serpapi',
      fellBackFromMissingKey: false,
    });
  });

  it('falls back to openserp and warns when serpapi is selected without a key', async () => {
    assert.deepEqual(resolveSearchProvider({ SEARCH_PROVIDER: 'serpapi' }), {
      provider: 'openserp',
      fellBackFromMissingKey: true,
    });
    assert.deepEqual(resolveSearchProvider({ SEARCH_PROVIDER: 'serpapi', SERPAPI_API_KEY: '   ' }), {
      provider: 'openserp',
      fellBackFromMissingKey: true,
    });

    const { log, lines } = memoryLog();
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requested.push(String(input));
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const provider = createActivitySearchProvider({
      env: {
        SEARCH_PROVIDER: 'serpapi',
        SERPAPI_API_KEY: '   ',
        OPENSERP_URL: 'http://127.0.0.1:7000',
        OPENSERP_ENGINES: 'duckduckgo,bing',
      },
      filterHits: passthrough,
      log,
    });
    assert.equal(provider.name, 'openserp');
    const hits = await provider.search('bakeries in Dallas', fetchImpl, DALLAS);
    assert.deepEqual(hits, []);
    assert.deepEqual(
      requested.map((url) => new URL(url).searchParams.get('engines')),
      ['duckduckgo', 'bing']
    );
    assert.equal(requested.some((url) => /serpapi\.com|api_key/i.test(url)), false);
    assert.deepEqual(lines, [
      'warn:SEARCH_PROVIDER=serpapi but SERPAPI_API_KEY is missing; using OpenSERP.',
      'info:Activity search provider=openserp',
    ]);
  });
});

describe('serpapi response mapping', () => {
  it('maps organic results and local places into the OpenSERP hit shape', () => {
    const hits = mapSerpApiResults(FIXTURE.google, 'google');
    assert.deepEqual(
      hits.map((hit) => ({ title: hit.title, url: hit.url, engine: hit.engine, domain: hit.domain })),
      [
        {
          title: 'Empire Baking Company',
          url: 'https://empirebaking.com/dallas',
          engine: 'google',
          domain: 'empirebaking.com',
        },
        {
          title: 'Sign in to your Microsoft account',
          url: 'https://login.live.com/',
          engine: 'google',
          domain: 'login.live.com',
        },
        {
          title: 'Harlingen Bakery',
          url: 'https://harlingenbakery.example/',
          engine: 'google',
          domain: 'harlingenbakery.example',
        },
        {
          title: 'LiveScore basketball',
          url: 'https://www.livescore.com/basketball',
          engine: 'google',
          domain: 'livescore.com',
        },
        {
          title: 'Dallas Bakery Guide Ad',
          url: 'https://ads.example/guide',
          engine: 'google',
          domain: 'ads.example',
        },
        {
          title: 'Village Baking Co',
          url: 'https://villagebaking.com/',
          engine: 'google_local',
          domain: 'villagebaking.com',
        },
      ]
    );
    const empire = hits[0];
    assert.equal(empire?.snippet, 'Dallas bakery and breakfast pastries');
    const village = hits.find((hit) => hit.title === 'Village Baking Co');
    assert.match(village?.snippet || '', /Neighborhood bakery in Dallas/);
    assert.match(village?.snippet || '', /Dallas, TX 75219/);
    assert.equal(
      hits.some((hit) => hit.url?.includes('serpapi.com') || hit.url?.includes('google.com/search')),
      false
    );
    assert.equal(
      hits.some((hit) => hit.title === 'Sponsored Dallas Bakery' || hit.title === 'Counter Only Bakery'),
      false
    );
  });

  it('maps a google_local array and keeps the first hit when the website repeats', () => {
    const local = mapSerpApiResults(FIXTURE.google_local, 'google_local');
    assert.deepEqual(
      local.map((hit) => hit.title),
      ['Village Baking Co', 'Corner Bakery Dallas', 'Harlingen Sweets']
    );
    assert.equal(local.every((hit) => hit.engine === 'google_local'), true);
    assert.equal(local.find((hit) => hit.title === 'Corner Bakery Dallas')?.url, 'https://cornerbakery.example/dallas');
  });

  it('filters junk and the wrong city from a mocked SerpApi fetch without logging the key', async () => {
    const { log, lines } = memoryLog();
    const requested: URL[] = [];
    const signals: Array<AbortSignal | null | undefined> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      requested.push(url);
      signals.push(init?.signal);
      assert.equal(init?.cache, 'no-store');
      const engine = url.searchParams.get('engine');
      const body = engine === 'google_local' ? FIXTURE.google_local : FIXTURE.google;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const provider = createActivitySearchProvider({
      env: { SEARCH_PROVIDER: 'serpapi', SERPAPI_API_KEY: SECRET, OPENSERP_TIMEOUT_MS: '15000' },
      filterHits: filterDiscoveryHits,
      log,
    });
    assert.equal(provider.name, 'serpapi');
    const hits = await provider.search('bakeries in Dallas', fetchImpl, DALLAS);
    assert.deepEqual(
      requested.map((url) => url.searchParams.get('engine')),
      ['google', 'google_local']
    );
    for (const url of requested) {
      assert.equal(url.origin + url.pathname, 'https://serpapi.com/search.json');
      assert.equal(url.searchParams.get('api_key'), SECRET);
      assert.equal(url.searchParams.get('q'), 'bakeries in Dallas');
      assert.equal(url.searchParams.get('num'), '12');
      assert.equal(url.searchParams.get('location'), null);
    }
    assert.equal(signals[0], signals[1]);
    assert.ok(signals[0] instanceof AbortSignal);
    assert.deepEqual(
      hits?.map((hit) => ({ title: hit.title, engine: hit.engine })),
      [
        { title: 'Empire Baking Company', engine: 'google' },
        { title: 'Village Baking Co', engine: 'google_local' },
        { title: 'Corner Bakery Dallas', engine: 'google_local' },
      ]
    );
    assert.deepEqual(lines, ['info:Activity search provider=serpapi']);
    assert.equal(lines.some((line) => line.includes(SECRET) || line.includes('api_key')), false);
    assert.equal(JSON.stringify(hits).includes(SECRET), false);
  });

  it('keeps Google results when google_local fails, and returns null when both fail', async () => {
    const { log, lines } = memoryLog();
    let mode: 'partial' | 'down' = 'partial';
    const fetchImpl: typeof fetch = async (input) => {
      const engine = new URL(String(input)).searchParams.get('engine');
      if (mode === 'down' || engine === 'google_local') return new Response('nope', { status: 500 });
      return new Response(JSON.stringify(FIXTURE.google), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const provider = createActivitySearchProvider({
      env: { SEARCH_PROVIDER: 'serpapi', SERPAPI_API_KEY: SECRET },
      filterHits: filterDiscoveryHits,
      log,
    });
    const partial = await provider.search('bakeries in Dallas', fetchImpl, DALLAS);
    assert.deepEqual(
      partial?.map((hit) => hit.title),
      ['Empire Baking Company', 'Village Baking Co']
    );
    mode = 'down';
    assert.equal(await provider.search('bakeries in Dallas', fetchImpl, DALLAS), null);
    const fetchThrows: typeof fetch = async () => {
      throw new Error(`connect failed https://serpapi.com/search.json?api_key=${SECRET}`);
    };
    assert.equal(await provider.search('bakeries in Dallas', fetchThrows, DALLAS), null);
    assert.equal(lines.some((line) => line.includes(SECRET)), false);
  });

  it('saves filtered SerpApi places through discovery and still reports the live source as openserp', async () => {
    const db = new DatabaseSync(':memory:');
    const now = new Date('2026-10-25T12:00:00.000Z');
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requested.push(url.toString());
      assert.equal(url.hostname, 'serpapi.com');
      const engine = url.searchParams.get('engine');
      const body = engine === 'google_local' ? FIXTURE.google_local : FIXTURE.google;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const found = await discoverActivities(db, {
      query: 'bakeries',
      location: 'Dallas',
      now,
      fetchImpl,
      allowMuse: false,
      searchEnv: { SEARCH_PROVIDER: 'serpapi', SERPAPI_API_KEY: SECRET },
    });
    assert.equal(found.source, 'openserp');
    assert.equal(found.isLive, true);
    assert.deepEqual(
      found.activities.map((activity) => activity.name),
      ['Empire Baking Company', 'Village Baking Co', 'Corner Bakery Dallas']
    );
    assert.equal(requested.length, 2);
    assert.equal(requested.some((url) => url.includes(SECRET) && url.includes('api_key=')), true);
    db.close();
  });
});
