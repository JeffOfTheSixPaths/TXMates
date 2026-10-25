export function parseInviteInput(raw: string): { id: string; mate?: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, 'https://txmates.local');
    const match = url.pathname.match(/\/avail\/([\w-]{1,80})(?:\/)?$/);
    if (match) {
      const mate = url.searchParams.get('mate')?.trim();
      return mate ? { id: match[1], mate } : { id: match[1] };
    }
  } catch {
    // Fall through to a bare hangout id.
  }

  if (/^[\w-]{1,80}$/.test(trimmed)) return { id: trimmed };
  return null;
}
