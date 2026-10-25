import type { ActivityCategory } from '@/types';

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  food: 'Food & BBQ',
  music: 'Live Music',
  outdoors: 'Outdoors & Springs',
  gaming: 'Gaming & Arcades',
  sports: 'Sports & Active',
  nightlife: 'Nightlife & Drinks',
  arts: 'Arts & Culture',
  chill: 'Cafe & Social Chill',
};

/**
 * Specific phrases first. Gaming is before food so an escape-room title is not
 * filed as tacos. Food-specific words are before "bar", and coffee is before
 * generic "food", so the place itself wins over a nearby keyword.
 */
const RULES: Array<{ category: ActivityCategory; pattern: RegExp }> = [
  {
    category: 'gaming',
    pattern:
      /\b(escape rooms?|escape games?|puzzle rooms?|puzzles?|trivia|bowling|axe throwing|axe throw|hatchet|arcades?|pinball|mini[- ]?golf|board games?|games?)\b/i,
  },
  {
    category: 'food',
    pattern: /\b(bbq|barbecue|barbeque|brisket|tacos?|smokehouses?|tex-mex|puffy tacos?)\b/i,
  },
  {
    category: 'chill',
    pattern: /\b(cafes?|coffee|coffeehouse|baker(?:y|ies)|donuts?|roasters?|panaderia)\b/i,
  },
  {
    category: 'arts',
    pattern: /\b(museums?|galleries|gallery|sculpture|theatre|theater|ballet|opera|chapel)\b/i,
  },
  {
    category: 'nightlife',
    pattern:
      /\b(beer gardens?|brewer(?:y|ies)|cocktails?|nightlife|speakeas(?:y|ies)|ice houses?|taverns?|pubs?|dancehalls?|rooftops?|bars?)\b/i,
  },
  {
    category: 'outdoors',
    pattern:
      /\b(parks?|springs|greenbelts?|hiking|hikes?|trails?|kayaks?|kayaking|tea gardens?|botanical|lakes?|zoos?|river walk|state parks?)\b/i,
  },
  {
    category: 'sports',
    pattern:
      /\b(bouldering|rock climbing|climbing gyms?|stadiums?|topgolf|karting|soccer|football|baseball|basketball|golf|sports?)\b/i,
  },
  {
    category: 'music',
    pattern: /\b(live music|concerts?|honky[- ]?tonks?|jazz|symphony|music halls?|music venues?)\b/i,
  },
  {
    category: 'food',
    pattern: /\b(restaurants?|pizzerias?|pizza|food|eats?)\b/i,
  },
];

export function matchActivityCategory(text: string): { category: ActivityCategory; label: string } | null {
  const source = text || '';
  for (const rule of RULES) {
    if (rule.pattern.test(source)) {
      return { category: rule.category, label: CATEGORY_LABELS[rule.category] };
    }
  }
  return null;
}

/** Blank browse, or the generic OpenSERP phrase. Those are not a topic. */
export function isGenericDiscoveryQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return true;
  return normalized.includes('best things to do with friends venues activities');
}

/**
 * Category comes from the listing, not from the interest chip.
 * A title that names a place type wins. A topic query ("escape rooms") wins
 * over the snippet, so a Yelp "tacos" aside cannot refile the hit as food.
 */
export function inferActivityCategory(input: {
  title?: string;
  snippet?: string;
  query?: string;
}): { category: ActivityCategory; label: string } {
  const fromTitle = matchActivityCategory(input.title || '');
  if (fromTitle) return fromTitle;
  const query = (input.query || '').trim();
  if (query && !isGenericDiscoveryQuery(query)) {
    const fromQuery = matchActivityCategory(query);
    if (fromQuery) return fromQuery;
  }
  const fromSnippet = matchActivityCategory(input.snippet || '');
  if (fromSnippet) return fromSnippet;
  return { category: 'chill', label: CATEGORY_LABELS.chill };
}

const GENERAL_BROWSE =
  /^(austin|houston|dallas|san antonio)(?:,?\s*tx)?(?:\s+(food|music|outdoors|gaming|sports|nightlife|arts|chill|all))?$/i;

/** City-wide browse, as opposed to a one-off topic search such as "tacos in Houston". */
export function isGeneralPlanQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return true;
  if (isGenericDiscoveryQuery(normalized)) return true;
  return GENERAL_BROWSE.test(normalized);
}
