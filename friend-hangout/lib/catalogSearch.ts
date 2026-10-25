export type CatalogFields = {
  name: string;
  description: string;
  tags: string[];
  category: string;
  categoryLabel?: string;
  neighborhood?: string;
  highlights?: string[];
};

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'on']);

export type CatalogSearchResult<T> = {
  activities: T[];
  relaxed: boolean;
};

export function searchTokens(query: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const raw of query.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOP_WORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    tokens.push(raw);
  }
  return tokens;
}

export function searchCatalog<T extends CatalogFields>(
  activities: T[],
  query: string
): CatalogSearchResult<T> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return { activities, relaxed: false };

  const ranked = activities
    .map((activity, index) => ({ activity, index, score: scoreActivity(activity, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (ranked.length === 0) return { activities, relaxed: true };
  return { activities: ranked.map((entry) => entry.activity), relaxed: false };
}

function scoreActivity(activity: CatalogFields, tokens: string[]): number {
  const text = [
    activity.name,
    activity.description,
    activity.category,
    activity.categoryLabel || '',
    activity.neighborhood || '',
    ...activity.tags,
    ...(activity.highlights || []),
  ]
    .join(' ')
    .toLowerCase();
  const words = text.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) {
      score += 2;
      continue;
    }
    if (words.some((word) => word.startsWith(token) || (token.startsWith(word) && word.length >= 3))) {
      score += 1;
    }
  }
  return score;
}
