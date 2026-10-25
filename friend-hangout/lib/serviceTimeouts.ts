export const DEFAULT_OPENSERP_TIMEOUT_MS = 15_000;
export const MAX_OPENSERP_TIMEOUT_MS = 30_000;
export const DEFAULT_MUSE_TIMEOUT_MS = 25_000;
export const MAX_MUSE_TIMEOUT_MS = 60_000;
export const DEFAULT_OPENSERP_ENGINES = 'duckduckgo,bing';

const ENGINE_NAME = /^[a-z0-9_-]+$/i;

export function resolveTimeoutMs(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(Math.round(parsed), max);
}

export function openSerpTimeoutMs(raw = process.env.OPENSERP_TIMEOUT_MS): number {
  return resolveTimeoutMs(raw, DEFAULT_OPENSERP_TIMEOUT_MS, 1000, MAX_OPENSERP_TIMEOUT_MS);
}

export function openSerpBaseUrl(raw = process.env.OPENSERP_URL): string {
  return (raw || 'http://127.0.0.1:7000').replace(/\/$/, '');
}

export function museTimeoutMs(raw = process.env.MUSE_TIMEOUT_MS): number {
  return resolveTimeoutMs(raw, DEFAULT_MUSE_TIMEOUT_MS, 1000, MAX_MUSE_TIMEOUT_MS);
}

export function openSerpEngines(raw = process.env.OPENSERP_ENGINES): string {
  const source = raw?.trim() ? raw : DEFAULT_OPENSERP_ENGINES;
  const engines = source
    .split(',')
    .map((engine) => engine.trim())
    .filter((engine) => ENGINE_NAME.test(engine));
  return engines.length > 0 ? engines.join(',') : DEFAULT_OPENSERP_ENGINES;
}

/** DuckDuckGo first, then Bing, whenever both are enabled. Other engines keep their listed order. */
export function openSerpEngineOrder(raw = process.env.OPENSERP_ENGINES): string[] {
  const listed = openSerpEngines(raw).split(',');
  if (listed.includes('duckduckgo') && listed.includes('bing')) {
    const rest = listed.filter((engine) => engine !== 'duckduckgo' && engine !== 'bing');
    return ['duckduckgo', 'bing', ...rest];
  }
  return listed;
}
