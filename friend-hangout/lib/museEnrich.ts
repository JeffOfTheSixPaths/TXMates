import { createHash } from 'node:crypto';
import type { ActivityCategory } from '@/types';

const CATEGORIES = new Set(['food', 'music', 'outdoors', 'gaming', 'sports', 'nightlife', 'arts', 'chill']);

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food & BBQ',
  music: 'Live Music',
  outdoors: 'Outdoors & Springs',
  gaming: 'Gaming & Arcades',
  sports: 'Sports & Active',
  nightlife: 'Nightlife & Drinks',
  arts: 'Arts & Culture',
  chill: 'Cafe & Social Chill',
};

export const ENRICH_BATCH = 6;
/** New Muse enrichments a single plan request may start. Already-enriched rows are reused and do not count. */
export const PLAN_ENRICH_LIMIT = 6;
/** Reasoning tokens count against this budget. 1600 was spent entirely on reasoning and cut the JSON off. */
export const ENRICH_MAX_TOKENS = 8192;
/** Muse Spark rejects "none". "low" keeps a short reasoning pass so the JSON still fits. */
export const ENRICH_REASONING_EFFORT = 'low' as const;

export type MuseEnrichment = {
  id: string;
  kind: 'event' | 'place';
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  address: string | null;
  estimatedCostPerPerson: number | null;
  category: ActivityCategory | null;
  categoryLabel: string | null;
  tags: string[];
};

export function enrichmentCacheKey(ids: string[]): string {
  const raw = ['enrich-v2', ...ids.slice().sort()].join('\n');
  return createHash('sha256').update(raw).digest('hex');
}

export function enrichmentContentCacheable(content: string): boolean {
  const cleaned = stripFences(content);
  if (!cleaned.endsWith(']')) return false;
  return parseMuseEnrichments(cleaned).size > 0;
}

export function parseMuseEnrichments(content: string): Map<string, MuseEnrichment> {
  const parsed = parseJson(content);
  const list = Array.isArray(parsed) ? parsed : [];
  const found = new Map<string, MuseEnrichment>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    if (!id || (record.kind !== 'event' && record.kind !== 'place')) continue;
    const category = typeof record.category === 'string' && CATEGORIES.has(record.category)
      ? (record.category as ActivityCategory)
      : null;
    const start = record.kind === 'event' ? isoOrNull(record.startDate) : null;
    const end = record.kind === 'event' ? isoOrNull(record.endDate) || start : null;
    found.set(id, {
      id,
      kind: record.kind,
      startDate: start,
      endDate: end,
      venue: shortText(record.venue),
      address: shortText(record.address),
      estimatedCostPerPerson: costOrNull(record.estimatedCostPerPerson),
      category,
      categoryLabel: category ? CATEGORY_LABELS[category] : null,
      tags: tagsOrEmpty(record.tags),
    });
  }
  return found;
}

export function categoryLabelFor(category: string): string | null {
  return CATEGORY_LABELS[category] || null;
}

function stripFences(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function parseJson(content: string): unknown {
  const cleaned = stripFences(content);
  const direct = tryParse(cleaned);
  if (direct !== undefined) return direct;
  const start = cleaned.indexOf('[');
  if (start >= 0) {
    const arrayText = cleaned.slice(start);
    const closed = tryParse(arrayText);
    if (closed !== undefined) return closed;
    const objects = extractJsonObjects(arrayText);
    if (objects.length > 0) return objects;
  }
  return null;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractJsonObjects(text: string): unknown[] {
  const found: unknown[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') continue;
    const end = matchingBrace(text, index);
    if (end < 0) break;
    const parsed = tryParse(text.slice(index, end + 1));
    if (parsed !== undefined) found.push(parsed);
    index = end;
  }
  return found;
}

function matchingBrace(text: string, open: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return value;
}

function shortText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.slice(0, 160);
}

function costOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0 || number > 500) return null;
  return Math.round(number);
}

function tagsOrEmpty(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const text = item.replace(/\s+/g, ' ').trim();
    if (!text || text.length > 40 || tags.includes(text)) continue;
    tags.push(text);
    if (tags.length >= 6) break;
  }
  return tags;
}
