import { openSerpBaseUrl, openSerpEngineOrder, openSerpTimeoutMs } from './serviceTimeouts';

export type SearchHit = {
  title?: string;
  url?: string;
  snippet?: string;
  domain?: string;
  engine?: string;
};

export type SearchProviderName = 'openserp' | 'serpapi';

export type SearchProviderDecision = {
  provider: SearchProviderName;
  fellBackFromMissingKey: boolean;
};

export type SearchProviderEnv = {
  SEARCH_PROVIDER?: string;
  SERPAPI_API_KEY?: string;
  OPENSERP_URL?: string;
  OPENSERP_TIMEOUT_MS?: string;
  OPENSERP_ENGINES?: string;
};

type SearchProviderEnvSource = SearchProviderEnv | NodeJS.ProcessEnv;

function searchProviderEnv(env?: SearchProviderEnvSource): SearchProviderEnv {
  const source = env ?? process.env;
  return {
    SEARCH_PROVIDER: source.SEARCH_PROVIDER,
    SERPAPI_API_KEY: source.SERPAPI_API_KEY,
    OPENSERP_URL: source.OPENSERP_URL,
    OPENSERP_TIMEOUT_MS: source.OPENSERP_TIMEOUT_MS,
    OPENSERP_ENGINES: source.OPENSERP_ENGINES,
  };
}

export type SearchContext = {
  location: string;
  query: string;
  requireQueryMatch?: boolean;
};

export type SearchHitFilter = (hits: SearchHit[], engine: string, context: SearchContext) => SearchHit[];

export type SearchLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export type ActivitySearchProvider = {
  readonly name: SearchProviderName;
  search(searchText: string, fetchImpl: typeof fetch, context: SearchContext): Promise<SearchHit[] | null>;
};

const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';

const MISSING_KEY_WARNING = 'SEARCH_PROVIDER=serpapi but SERPAPI_API_KEY is missing; using OpenSERP.';

const defaultLogger: SearchLogger = {
  info(message) {
    console.info(message);
  },
  warn(message) {
    console.warn(message);
  },
};

/** Unset, blank, and any value other than serpapi stay on OpenSERP. */
export function resolveSearchProvider(env?: SearchProviderEnvSource): SearchProviderDecision {
  const resolved = searchProviderEnv(env);
  const requested = resolved.SEARCH_PROVIDER?.trim().toLowerCase() ?? '';
  if (requested !== 'serpapi') {
    return { provider: 'openserp', fellBackFromMissingKey: false };
  }
  if (!resolved.SERPAPI_API_KEY?.trim()) {
    return { provider: 'openserp', fellBackFromMissingKey: true };
  }
  return { provider: 'serpapi', fellBackFromMissingKey: false };
}

export function createActivitySearchProvider(options: {
  env?: SearchProviderEnvSource;
  filterHits: SearchHitFilter;
  log?: SearchLogger;
}): ActivitySearchProvider {
  const env = searchProviderEnv(options.env);
  const decision = resolveSearchProvider(env);
  const log = options.log ?? defaultLogger;
  if (decision.provider === 'serpapi') {
    const apiKey = env.SERPAPI_API_KEY?.trim() ?? '';
    return {
      name: 'serpapi',
      search(searchText, fetchImpl, context) {
        log.info('Activity search provider=serpapi');
        return searchSerpApi(searchText, apiKey, fetchImpl, context, options.filterHits, env);
      },
    };
  }
  return {
    name: 'openserp',
    search(searchText, fetchImpl, context) {
      if (decision.fellBackFromMissingKey) log.warn(MISSING_KEY_WARNING);
      log.info('Activity search provider=openserp');
      return searchOpenSerp(searchText, fetchImpl, context, options.filterHits, env);
    },
  };
}

/**
 * Maps a SerpApi `engine=google` or `engine=google_local` payload into the OpenSERP hit shape.
 * Organic web results and local places are both included. Ads and SerpApi's own search links are not.
 */
export function mapSerpApiResults(payload: unknown, engine: 'google' | 'google_local' = 'google'): SearchHit[] {
  if (!isRecord(payload)) return [];
  const hits: SearchHit[] = [];
  if (engine === 'google' && Array.isArray(payload.organic_results)) {
    for (const item of payload.organic_results) {
      const hit = mapOrganicResult(item);
      if (hit) hits.push(hit);
    }
  }
  for (const place of localPlaces(payload.local_results)) {
    const hit = mapLocalPlace(place);
    if (hit) hits.push(hit);
  }
  return dedupeSearchHits(hits);
}

async function searchOpenSerp(
  searchText: string,
  fetchImpl: typeof fetch,
  context: SearchContext,
  filterHits: SearchHitFilter,
  env: SearchProviderEnv
): Promise<SearchHit[] | null> {
  const engines = openSerpEngineOrder(env.OPENSERP_ENGINES);
  const timeoutMs = openSerpTimeoutMs(env.OPENSERP_TIMEOUT_MS);
  const base = openSerpBaseUrl(env.OPENSERP_URL);
  let sawResponse = false;
  for (const engine of engines) {
    const hits = await fetchOpenSerpEngine(engine, searchText, fetchImpl, base, timeoutMs);
    if (!hits) continue;
    sawResponse = true;
    const accepted = filterHits(hits, engine, context);
    if (accepted.length > 0) return accepted;
  }
  return sawResponse ? [] : null;
}

async function fetchOpenSerpEngine(
  engine: string,
  searchText: string,
  fetchImpl: typeof fetch,
  base: string,
  timeoutMs: number
): Promise<SearchHit[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${base}/mega/search?engines=${encodeURIComponent(engine)}&text=${encodeURIComponent(searchText)}&limit=12`;
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { results?: SearchHit[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchSerpApi(
  searchText: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  context: SearchContext,
  filterHits: SearchHitFilter,
  env: SearchProviderEnv
): Promise<SearchHit[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), openSerpTimeoutMs(env.OPENSERP_TIMEOUT_MS));
  try {
    const [web, local] = await Promise.all([
      fetchSerpApiEngine('google', searchText, apiKey, fetchImpl, controller.signal),
      fetchSerpApiEngine('google_local', searchText, apiKey, fetchImpl, controller.signal),
    ]);
    if (!web.ok && !local.ok) return null;
    const mapped = dedupeSearchHits([
      ...(web.ok ? mapSerpApiResults(web.payload, 'google') : []),
      ...(local.ok ? mapSerpApiResults(local.payload, 'google_local') : []),
    ]);
    return filterHits(mapped, 'serpapi', context);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSerpApiEngine(
  engine: 'google' | 'google_local',
  searchText: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal
): Promise<{ ok: true; payload: unknown } | { ok: false }> {
  try {
    const params = new URLSearchParams({
      engine,
      q: searchText,
      api_key: apiKey,
      num: '12',
    });
    // The key is only the api_key query param. Do not log this URL or the caught error; both can contain it.
    const response = await fetchImpl(`${SERPAPI_ENDPOINT}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false };
    return { ok: true, payload: await response.json() };
  } catch {
    return { ok: false };
  }
}

function mapOrganicResult(item: unknown): SearchHit | null {
  if (!isRecord(item)) return null;
  const title = asString(item.title);
  const url = usableResultUrl(asString(item.link));
  if (!title || !url) return null;
  return {
    title,
    url,
    snippet: asString(item.snippet),
    domain: domainFromUrl(url),
    engine: 'google',
  };
}

function mapLocalPlace(item: unknown): SearchHit | null {
  if (!isRecord(item)) return null;
  const title = asString(item.title);
  const links = isRecord(item.links) ? item.links : undefined;
  const url = usableResultUrl(asString(links?.website) || asString(item.website) || asString(item.link));
  if (!title || !url) return null;
  const snippet = [asString(item.description), asString(item.type), asString(item.address)].filter(Boolean).join(' · ');
  return {
    title,
    url,
    snippet,
    domain: domainFromUrl(url),
    engine: 'google_local',
  };
}

function localPlaces(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.places)) return value.places;
  return [];
}

function usableResultUrl(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'serpapi.com' || host.endsWith('.serpapi.com')) return null;
  if (raw.includes('google.com/search')) return null;
  return raw;
}

function domainFromUrl(raw: string): string | undefined {
  try {
    return new URL(raw).hostname.replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}

function dedupeSearchHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const unique: SearchHit[] = [];
  for (const hit of hits) {
    const key = hit.url ? urlKey(hit.url) : '';
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    unique.push(hit);
  }
  return unique;
}

function urlKey(raw: string): string {
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/$/, '') || '/';
    return `${url.protocol}//${url.hostname.toLowerCase()}${path}${url.search}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
