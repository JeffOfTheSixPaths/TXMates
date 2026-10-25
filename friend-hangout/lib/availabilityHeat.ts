import type { Friend } from '@/types';

export type AvailabilityWord = 'None' | 'Some' | 'All';

export function availabilityRatio(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0;
  return Math.min(1, count / total);
}

export function availabilityWord(count: number, total: number): AvailabilityWord {
  const ratio = availabilityRatio(count, total);
  if (ratio <= 0) return 'None';
  if (ratio >= 1) return 'All';
  return 'Some';
}

/** Light text only when everyone is free and the cell is solid leaf. */
export function availabilityStrong(count: number, total: number): boolean {
  return availabilityRatio(count, total) >= 1;
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);
  if (a0 === null || a1 === null || b0 === null || b1 === null) return false;
  if (a1 <= a0 || b1 <= b0) return false;
  return a0 < b1 && b0 < a1;
}

export function coverageCount(
  friends: Friend[],
  start: string,
  end: string,
  draft?: { friendId: string; startTime: string; endTime: string }
): { count: number; total: number; ratio: number; word: AvailabilityWord } {
  const names = friends.filter((friend) => {
    const slot =
      draft && friend.id === draft.friendId
        ? { startTime: draft.startTime, endTime: draft.endTime }
        : friend.availabilitySlots[0];
    return slot ? rangesOverlap(slot.startTime, slot.endTime, start, end) : false;
  });
  const count = names.length;
  const total = friends.length;
  return { count, total, ratio: availabilityRatio(count, total), word: availabilityWord(count, total) };
}

export function parseClockLabel(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (hour > 12 || minute > 59) return null;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseSlotLabel(slot: string): { start: string; end: string } | null {
  const parts = slot.split(/\s+[–-]\s+/);
  if (parts.length !== 2) return null;
  const start = parseClockLabel(parts[0] || '');
  const end = parseClockLabel(parts[1] || '');
  if (!start || !end) return null;
  return { start, end };
}
