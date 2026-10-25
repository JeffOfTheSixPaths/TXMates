export type ParsedInvite = { id: string; mate?: string; kind?: 'group' };

/**
 * Reads a pasted TXMates invite: an availability link (/avail/<id>?mate=<friend>),
 * a group workspace link (/h/<id>), or a bare hangout id.
 */
export function parseInviteInput(raw: string): ParsedInvite | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, 'https://txmates.local');
    const match = url.pathname.match(/\/avail\/([\w-]{1,80})(?:\/)?$/);
    if (match) {
      const mate = url.searchParams.get('mate')?.trim();
      return mate ? { id: match[1], mate } : { id: match[1] };
    }
    const group = url.pathname.match(/\/h\/([\w-]{1,80})(?:\/)?$/);
    if (group) return { id: group[1], kind: 'group' };
  } catch {
    // Fall through to a bare hangout id.
  }

  if (/^[\w-]{1,80}$/.test(trimmed)) return { id: trimmed };
  return null;
}
