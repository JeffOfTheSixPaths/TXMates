import { searchTokens } from './catalogSearch';
import { resolveTimeoutMs } from './serviceTimeouts';

export type ActivityPolicy = {
  cacheTtlMs: number;
  eventTtlDays: number;
  placeStaleDays: number;
  placeRecheckDays: number;
  recheckLimit: number;
  museCacheTtlMs: number;
};

const HOUR_MS = 3_600_000;

export function activityPolicy(env: NodeJS.ProcessEnv = process.env): ActivityPolicy {
  const cacheHours = resolveTimeoutMs(env.ACTIVITY_CACHE_TTL_HOURS, 8, 1, 24);
  const eventTtlDays = resolveTimeoutMs(env.ACTIVITY_EVENT_TTL_DAYS, 30, 1, 365);
  const placeStaleDays = resolveTimeoutMs(env.ACTIVITY_PLACE_STALE_DAYS, 60, 1, 365);
  let placeRecheckDays = resolveTimeoutMs(env.ACTIVITY_PLACE_RECHECK_DAYS, 30, 1, 365);
  if (placeRecheckDays >= placeStaleDays) {
    placeRecheckDays = Math.max(1, placeStaleDays - 1);
  }
  const museCacheHours = resolveTimeoutMs(env.MUSE_CACHE_TTL_HOURS, 12, 1, 168);
  return {
    cacheTtlMs: cacheHours * HOUR_MS,
    eventTtlDays,
    placeStaleDays,
    placeRecheckDays,
    recheckLimit: resolveTimeoutMs(env.ACTIVITY_RECHECK_LIMIT, 8, 1, 50),
    museCacheTtlMs: museCacheHours * HOUR_MS,
  };
}

export function isQueryFresh(refreshedAt: string | null, now: Date, ttlMs: number): boolean {
  if (!refreshedAt) return false;
  const then = Date.parse(refreshedAt);
  if (!Number.isFinite(then)) return false;
  return now.getTime() - then < ttlMs;
}

export function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

type CityRecord = { id: string; names: string[]; metro?: string };

/** Cities we can recognize in a snippet. Metro members count as the hub city, so Plano can satisfy Dallas and Harlingen cannot. */
const CITIES: CityRecord[] = [
  { id: 'new york', names: ['new york city', 'new york', 'nyc'] },
  { id: 'los angeles', names: ['los angeles'] },
  { id: 'san antonio', names: ['san antonio', 'satx'] },
  { id: 'san francisco', names: ['san francisco'] },
  { id: 'san diego', names: ['san diego'] },
  { id: 'san marcos', names: ['san marcos'], metro: 'austin' },
  { id: 'fort worth', names: ['fort worth'], metro: 'dallas' },
  { id: 'el paso', names: ['el paso'] },
  { id: 'corpus christi', names: ['corpus christi'] },
  { id: 'college station', names: ['college station'] },
  { id: 'round rock', names: ['round rock'], metro: 'austin' },
  { id: 'cedar park', names: ['cedar park'], metro: 'austin' },
  { id: 'sugar land', names: ['sugar land'], metro: 'houston' },
  { id: 'grand prairie', names: ['grand prairie'], metro: 'dallas' },
  { id: 'new braunfels', names: ['new braunfels'], metro: 'san antonio' },
  { id: 'the woodlands', names: ['the woodlands'], metro: 'houston' },
  { id: 'port arthur', names: ['port arthur'] },
  { id: 'wichita falls', names: ['wichita falls'] },
  { id: 'harlingen', names: ['harlingen'] },
  { id: 'mcallen', names: ['mcallen'] },
  { id: 'brownsville', names: ['brownsville'] },
  { id: 'austin', names: ['austin', 'atx'] },
  { id: 'dallas', names: ['dallas', 'dfw'] },
  { id: 'houston', names: ['houston'] },
  { id: 'plano', names: ['plano'], metro: 'dallas' },
  { id: 'irving', names: ['irving'], metro: 'dallas' },
  { id: 'garland', names: ['garland'], metro: 'dallas' },
  { id: 'frisco', names: ['frisco'], metro: 'dallas' },
  { id: 'arlington', names: ['arlington'], metro: 'dallas' },
  { id: 'mckinney', names: ['mckinney'], metro: 'dallas' },
  { id: 'richardson', names: ['richardson'], metro: 'dallas' },
  { id: 'denton', names: ['denton'], metro: 'dallas' },
  { id: 'carrollton', names: ['carrollton'], metro: 'dallas' },
  { id: 'lewisville', names: ['lewisville'], metro: 'dallas' },
  { id: 'mesquite', names: ['mesquite'], metro: 'dallas' },
  { id: 'pflugerville', names: ['pflugerville'], metro: 'austin' },
  { id: 'georgetown', names: ['georgetown'], metro: 'austin' },
  { id: 'waco', names: ['waco'] },
  { id: 'killeen', names: ['killeen'] },
  { id: 'lubbock', names: ['lubbock'] },
  { id: 'amarillo', names: ['amarillo'] },
  { id: 'laredo', names: ['laredo'] },
  { id: 'beaumont', names: ['beaumont'] },
  { id: 'galveston', names: ['galveston'], metro: 'houston' },
  { id: 'abilene', names: ['abilene'] },
  { id: 'midland', names: ['midland'] },
  { id: 'odessa', names: ['odessa'] },
  { id: 'boston', names: ['boston'] },
  { id: 'chicago', names: ['chicago'] },
  { id: 'seattle', names: ['seattle'] },
  { id: 'denver', names: ['denver'] },
  { id: 'miami', names: ['miami'] },
  { id: 'atlanta', names: ['atlanta'] },
  { id: 'orlando', names: ['orlando'] },
  { id: 'phoenix', names: ['phoenix'] },
  { id: 'philadelphia', names: ['philadelphia'] },
  { id: 'detroit', names: ['detroit'] },
  { id: 'minneapolis', names: ['minneapolis'] },
  { id: 'nashville', names: ['nashville'] },
  { id: 'portland', names: ['portland'] },
  { id: 'baltimore', names: ['baltimore'] },
  { id: 'charlotte', names: ['charlotte'] },
  { id: 'columbus', names: ['columbus'] },
  { id: 'indianapolis', names: ['indianapolis'] },
  { id: 'jacksonville', names: ['jacksonville'] },
  { id: 'tampa', names: ['tampa'] },
  { id: 'sacramento', names: ['sacramento'] },
  { id: 'las vegas', names: ['las vegas'] },
  { id: 'kansas city', names: ['kansas city'] },
  { id: 'new orleans', names: ['new orleans'] },
  { id: 'salt lake city', names: ['salt lake city'] },
  { id: 'oklahoma city', names: ['oklahoma city'] },
  { id: 'memphis', names: ['memphis'] },
  { id: 'louisville', names: ['louisville'] },
  { id: 'milwaukee', names: ['milwaukee'] },
  { id: 'albuquerque', names: ['albuquerque'] },
  { id: 'tucson', names: ['tucson'] },
  { id: 'fresno', names: ['fresno'] },
  { id: 'raleigh', names: ['raleigh'] },
  { id: 'omaha', names: ['omaha'] },
  { id: 'colorado springs', names: ['colorado springs'] },
  { id: 'long beach', names: ['long beach'], metro: 'los angeles' },
  { id: 'oakland', names: ['oakland'], metro: 'san francisco' },
  { id: 'brooklyn', names: ['brooklyn'], metro: 'new york' },
  { id: 'san jose', names: ['san jose', 'sj'] },
  { id: 'washington', names: ['washington dc', 'washington', 'dc'] },
  { id: 'pittsburgh', names: ['pittsburgh'] },
  { id: 'cleveland', names: ['cleveland'] },
  { id: 'cincinnati', names: ['cincinnati'] },
  { id: 'st louis', names: ['st louis', 'saint louis', 'st. louis'] },
  { id: 'honolulu', names: ['honolulu'] },
  { id: 'buffalo', names: ['buffalo'] },
  { id: 'richmond', names: ['richmond'] },
  { id: 'virginia beach', names: ['virginia beach'] },
  { id: 'tulsa', names: ['tulsa'] },
  { id: 'mesa', names: ['mesa'], metro: 'phoenix' },
  { id: 'scottsdale', names: ['scottsdale'], metro: 'phoenix' },
  { id: 'chandler', names: ['chandler'], metro: 'phoenix' },
  { id: 'glendale', names: ['glendale'], metro: 'phoenix' },
  { id: 'tempe', names: ['tempe'], metro: 'phoenix' },
  { id: 'bakersfield', names: ['bakersfield'] },
  { id: 'anaheim', names: ['anaheim'], metro: 'los angeles' },
  { id: 'santa ana', names: ['santa ana'], metro: 'los angeles' },
  { id: 'irvine', names: ['irvine'], metro: 'los angeles' },
  { id: 'riverside', names: ['riverside'] },
  { id: 'st paul', names: ['st paul', 'saint paul', 'st. paul'], metro: 'minneapolis' },
  { id: 'st petersburg', names: ['st petersburg', 'saint petersburg', 'st. petersburg'], metro: 'tampa' },
  { id: 'jersey city', names: ['jersey city'], metro: 'new york' },
  { id: 'newark', names: ['newark'], metro: 'new york' },
  { id: 'reno', names: ['reno'] },
  { id: 'boise', names: ['boise'] },
  { id: 'madison', names: ['madison'] },
  { id: 'toronto', names: ['toronto'] },
  { id: 'vancouver', names: ['vancouver'] },
  { id: 'montreal', names: ['montreal'] },
  { id: 'london', names: ['london'] },
  { id: 'paris', names: ['paris'] },
  { id: 'tokyo', names: ['tokyo'] },
];

export const CITY_NAMES = CITIES.flatMap((city) => city.names.map((name) => ({ name, id: city.id }))).sort(
  (left, right) => right.name.length - left.name.length
);

const SHORT_CITY_ALIASES = new Set(['atx', 'dfw', 'nyc', 'satx', 'dc', 'sj', 'la']);

const CITY_TOKENS = new Set(
  CITIES.flatMap((city) =>
    city.names.flatMap((name) =>
      name.split(' ').filter((part) => part.length >= 4 || SHORT_CITY_ALIASES.has(part))
    )
  )
);

const BLOCKED_HOST_SUFFIXES = [
  'live.com',
  'live.net',
  'outlook.com',
  'office.com',
  'office365.com',
  'microsoft.com',
  'microsoftonline.com',
  'msn.com',
  'bing.com',
  'windows.com',
  'skype.com',
  'livescore.com',
  'flashscore.com',
  'sofascore.com',
  '365scores.com',
  'whoscored.com',
  'scoreboard.com',
];

const WEAK_QUERY_TOKENS = new Set([
  'live',
  'best',
  'top',
  'near',
  'around',
  'things',
  'thing',
  'group',
  'fun',
  'good',
  'local',
  'places',
  'place',
  'spots',
  'spot',
  'guide',
  'cheap',
  'free',
  'friends',
  'friend',
  'activities',
  'activity',
  'ideas',
  'idea',
  'open',
  'night',
  'day',
  'with',
  'from',
  'hangout',
  'hangouts',
  'plan',
  'plans',
  'venues',
  'venue',
  'area',
  'areas',
  'city',
  'cities',
  'event',
  'events',
]);

const JUNK_TITLE = /\b(sign[\s-]?in|log[\s-]?in|microsoft account|outlook\.com|live\.com|forgot (your )?password|live ?scores?|livescores?|scoreboard|match centre|match center)\b/i;

const BLOCKED_PATH = /\/(login|signin|sign-in|signup|sign-up|oauth|auth|account|accounts)(\/|$)/i;

export type DiscoveryHitCheck = {
  title: string;
  snippet?: string;
  url: string;
  location: string;
  query?: string;
  /** Saved rows already exist. Purge them for junk hosts and the wrong city, not for a weak query overlap. */
  requireQueryMatch?: boolean;
};

export function canonicalCity(location: string): string | null {
  const mentioned = citiesMentioned(location);
  if (mentioned[0]) return mentioned[0];
  const cleaned = location.replace(/\(.*?\)/g, '').split(',')[0]?.trim().toLowerCase();
  return cleaned && cleaned.length >= 2 ? cleaned : null;
}

export function cityMetro(cityId: string): string {
  return CITIES.find((city) => city.id === cityId)?.metro || cityId;
}

export function citiesMentioned(text: string): string[] {
  let remaining = text.toLowerCase();
  const found: string[] = [];
  for (const entry of CITY_NAMES) {
    const pattern = new RegExp(`\\b${escapeRegex(entry.name)}\\b`, 'g');
    if (!pattern.test(remaining)) continue;
    found.push(entry.id);
    remaining = remaining.replace(pattern, ' ');
  }
  return [...new Set(found)];
}

/** True when the text names some other city and never names the requested one. */
export function namesOtherCity(evidence: string, requestedLocation: string): boolean {
  const requested = canonicalCity(requestedLocation);
  if (!requested) return false;
  const requestedClean = requestedLocation.replace(/\(.*?\)/g, '').split(',')[0]?.trim().toLowerCase();
  const evidenceLower = evidence.toLowerCase();
  if (requestedClean && evidenceLower.includes(requestedClean)) return false;
  const mentioned = [...citiesMentioned(evidence), ...hostCityIds(evidence)];
  if (mentioned.length === 0) return false;
  const requestedKey = cityMetro(requested);
  if (mentioned.some((id) => cityMetro(id) === requestedKey)) return false;
  return mentioned.some((id) => cityMetro(id) !== requestedKey);
}

export function blockedDiscoveryUrl(rawUrl: string): boolean {
  const url = parseHttpUrl(rawUrl);
  if (!url) return true;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return true;
  if (/^(login|signin|sign-in|account|accounts|auth|oauth)\./.test(host)) return true;
  if (host.includes('livescore') || host.includes('flashscore') || host.includes('sofascore')) return true;
  if (BLOCKED_PATH.test(url.pathname)) return true;
  return false;
}

export function discoveryQueryMatches(query: string, title: string, snippet = ''): boolean {
  const tokens = searchTokens(query).filter((token) => !WEAK_QUERY_TOKENS.has(token) && !CITY_TOKENS.has(token));
  if (tokens.length === 0) return true;
  const words = `${title} ${snippet}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stemToken);
  return tokens.some((token) => {
    const stemmed = stemToken(token);
    return words.some(
      (word) => word === stemmed || (stemmed.length >= 4 && (word.startsWith(stemmed) || stemmed.startsWith(word)))
    );
  });
}

/** Reason to drop a hit before it is saved, or null when it can be stored. */
export function discoveryHitRejection(input: DiscoveryHitCheck): string | null {
  const title = input.title?.trim() || '';
  if (!title) return 'empty-title';
  if (blockedDiscoveryUrl(input.url)) return 'blocked-url';
  if (JUNK_TITLE.test(title)) return 'junk-title';
  const evidence = `${title} ${input.snippet || ''} ${input.url}`;
  if (namesOtherCity(evidence, input.location)) return 'other-city';
  if (input.requireQueryMatch !== false && input.query && !discoveryQueryMatches(input.query, title, input.snippet || '')) {
    return 'off-query';
  }
  return null;
}

function hostCityIds(evidence: string): string[] {
  const match = evidence.match(/https?:\/\/[^\s)]+/i);
  if (!match) return [];
  let hostname = '';
  try {
    hostname = new URL(match[0]).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return [];
  }
  const labels = hostname.split(/[.\-]/);
  const found: string[] = [];
  for (const label of labels) {
    for (const entry of CITY_NAMES) {
      const compact = entry.name.replace(/\s+/g, '');
      if (compact.length < 6) continue;
      if (label === compact || label.startsWith(compact)) found.push(entry.id);
    }
  }
  return found;
}

function parseHttpUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function stemToken(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith('es') && lower.length > 4) return lower.slice(0, -2);
  if (lower.endsWith('s') && lower.length > 3) return lower.slice(0, -1);
  return lower;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
