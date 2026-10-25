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
  const raw = ['enrich-v1', ...ids.slice().sort()].join('\n');
  return createHash('sha256').update(raw).digest('hex');
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

function parseJson(content: string): unknown {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
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
