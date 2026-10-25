const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatAge(iso: string | undefined | null, now = Date.now()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function formatActivityPrice(
  activity: { estimatedCostPerPerson: number; priceListed?: boolean },
  style: 'tilde' | 'person' = 'tilde'
): string {
  if (activity.priceListed === false) return 'Price not listed';
  if (activity.estimatedCostPerPerson === 0) return 'Free';
  if (style === 'person') return `$${activity.estimatedCostPerPerson} a person`;
  return `~$${activity.estimatedCostPerPerson}`;
}

export function formatEventSpan(start?: string | null, end?: string | null): string | null {
  const from = formatCivil(start);
  const to = formatCivil(end);
  if (from && to && start !== end) return `${from} – ${to}`;
  return from || to;
}

function formatCivil(iso?: string | null): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return null;
  return `${month} ${Number(match[3])}, ${match[1]}`;
}
