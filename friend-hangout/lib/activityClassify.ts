const MONTH =
  'january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sept|sep|oct|nov|dec';

const EVENT_KEYWORDS = /\b(festivals?|concerts?|fairs?|tickets?|tours?|gigs?|lineups?|carnivals?|shows?)\b/i;

const MONTH_NUMBER: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export type ActivityKind = 'event' | 'place';

export type Classification = {
  kind: ActivityKind;
  startDate: string | null;
  endDate: string | null;
  source: 'heuristic' | 'muse';
};

export function civilDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function classifyListing(input: {
  title: string;
  snippet?: string;
  now?: Date;
}): Classification {
  const now = input.now ?? new Date();
  const title = input.title || '';
  const snippet = input.snippet || '';
  const titleDates = extractDateRange(title, now);
  const snippetDates = extractDateRange(snippet, now);
  const keyword = EVENT_KEYWORDS.test(`${title} ${snippet}`);
  const titleHasDate = Boolean(titleDates.start);
  const snippetUpcoming = isUpcoming(snippetDates, now);
  const event = keyword || titleHasDate || snippetUpcoming;
  const dates = titleHasDate ? titleDates : snippetUpcoming || keyword ? snippetDates : { start: null, end: null };
  return {
    kind: event ? 'event' : 'place',
    startDate: event ? dates.start : null,
    endDate: event ? dates.end : null,
    source: 'heuristic',
  };
}

export function mergeClassification(
  heuristic: Classification,
  muse: Classification | null
): Classification {
  if (!muse) return heuristic;
  if (muse.kind === 'place') {
    return { kind: 'place', startDate: null, endDate: null, source: 'muse' };
  }
  return {
    kind: 'event',
    startDate: muse.startDate || heuristic.startDate,
    endDate: muse.endDate || heuristic.endDate || muse.startDate || heuristic.startDate,
    source: 'muse',
  };
}

export function parseMuseClassifications(content: string): Map<string, Classification> {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return new Map();
  }
  const list = Array.isArray(parsed) ? parsed : [];
  const found = new Map<string, Classification>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const record = item as { id?: unknown; kind?: unknown; startDate?: unknown; endDate?: unknown };
    const id = typeof record.id === 'string' ? record.id : '';
    if (!id || (record.kind !== 'event' && record.kind !== 'place')) continue;
    const start = isoOrNull(record.startDate);
    const end = isoOrNull(record.endDate);
    found.set(
      id,
      record.kind === 'place'
        ? { kind: 'place', startDate: null, endDate: null, source: 'muse' }
        : {
            kind: 'event',
            startDate: start,
            endDate: end || start,
            source: 'muse',
          }
    );
  }
  return found;
}

export function extractDateRange(
  text: string,
  now = new Date()
): { start: string | null; end: string | null } {
  const year = now.getFullYear();
  const dates: string[] = [];
  let working = text;

  const monthRange = new RegExp(
    `\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|—|to)\\s*(?:(${MONTH})\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?`,
    'gi'
  );
  working = working.replace(monthRange, (match, startMonth, startDay, endMonth, endDay, foundYear) => {
    const y = foundYear ? Number(foundYear) : year;
    pushDate(dates, isoDate(y, monthNumber(startMonth), Number(startDay)));
    pushDate(dates, isoDate(y, monthNumber(endMonth || startMonth), Number(endDay)));
    return ' '.repeat(match.length);
  });

  const numericRange = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g;
  working = working.replace(numericRange, (match, monthA, dayA, yearA, monthB, dayB, yearB) => {
    pushDate(dates, isoDate(Number(yearA), Number(monthA), Number(dayA)));
    pushDate(dates, isoDate(Number(yearB), Number(monthB), Number(dayB)));
    return ' '.repeat(match.length);
  });

  const isoRange = /\b(20\d{2})-(\d{2})-(\d{2})\s*(?:-|–|—|to)\s*(20\d{2})-(\d{2})-(\d{2})\b/g;
  working = working.replace(isoRange, (match, yearA, monthA, dayA, yearB, monthB, dayB) => {
    pushDate(dates, isoDate(Number(yearA), Number(monthA), Number(dayA)));
    pushDate(dates, isoDate(Number(yearB), Number(monthB), Number(dayB)));
    return ' '.repeat(match.length);
  });

  for (const match of working.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    pushDate(dates, isoDate(Number(match[1]), Number(match[2]), Number(match[3])));
  }
  for (const match of working.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) {
    pushDate(dates, isoDate(Number(match[3]), Number(match[1]), Number(match[2])));
  }
  const monthDayYear = new RegExp(
    `\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,\\s*|\\s+)(20\\d{2})\\b`,
    'gi'
  );
  const consumed = new Set<number>();
  for (const match of working.matchAll(monthDayYear)) {
    pushDate(dates, isoDate(Number(match[3]), monthNumber(match[1] || ''), Number(match[2])));
    if (match.index !== undefined) consumed.add(match.index);
  }
  const monthDay = new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi');
  for (const match of working.matchAll(monthDay)) {
    if (match.index !== undefined && consumed.has(match.index)) continue;
    pushDate(dates, isoDate(year, monthNumber(match[1] || ''), Number(match[2])));
  }

  if (dates.length === 0) return { start: null, end: null };
  const sorted = [...dates].sort();
  return { start: sorted[0] || null, end: sorted[sorted.length - 1] || null };
}

function isUpcoming(dates: { start: string | null; end: string | null }, now: Date): boolean {
  if (!dates.start) return false;
  const end = dates.end || dates.start;
  return end >= civilDate(now);
}

function pushDate(dates: string[], value: string | null) {
  if (value) dates.push(value);
}

function monthNumber(name: string): number {
  return MONTH_NUMBER[name.toLowerCase().slice(0, 3)] || 0;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}
