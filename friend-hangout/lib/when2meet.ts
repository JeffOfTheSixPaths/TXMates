import type { Friend, TimeSlot } from '@/types';

export const WHEN2MEET_HOURS = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
] as const;

export type HourNumber = (typeof WHEN2MEET_HOURS)[number];

export type HourAvailabilityGrid = Record<string, Record<number, boolean>>;

export interface When2MeetCell {
  date: string;
  hour: number;
  timeLabel: string;
  availableCount: number;
  totalCount: number;
  ratio: number; // 0 to 1
  availableFriends: string[];
  unavailableFriends: string[];
}

export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export function formatHourShort(hour: number): string {
  const period = hour >= 12 ? 'p' : 'a';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

function parseHourFromTimeString(timeStr: string): number {
  if (!timeStr) return 0;
  const [h] = timeStr.split(':').map(Number);
  return Number.isFinite(h) ? h : 0;
}

/**
 * Checks if an hour (e.g. 14 for 2:00-3:00 PM) overlaps with a slot [startTime, endTime].
 */
export function isHourInSlot(hour: number, startTime: string, endTime: string): boolean {
  const startHour = parseHourFromTimeString(startTime);
  const endParts = endTime.split(':').map(Number);
  const endHour = Number.isFinite(endParts[0]) ? endParts[0] : 0;
  const endMin = Number.isFinite(endParts[1]) ? endParts[1] : 0;

  // The hour spans [hour:00, hour+1:00].
  // It is covered if slot starts at or before hour and ends after hour (or endMin > 0 if ends in same hour).
  const slotEffectiveEnd = endMin > 0 ? endHour + 1 : endHour;
  return hour >= startHour && hour < slotEffectiveEnd;
}

/**
 * Convert friend availability slots into a 2D boolean grid: [date][hour] = boolean.
 */
export function slotsToHourGrid(
  slots: TimeSlot[] = [],
  dates: string[] = []
): HourAvailabilityGrid {
  const grid: HourAvailabilityGrid = {};
  for (const date of dates) {
    grid[date] = {};
    for (const hour of WHEN2MEET_HOURS) {
      grid[date][hour] = false;
    }
  }

  if (slots.length === 0) {
    return grid;
  }

  for (const slot of slots) {
    // If slot has a specific date, only mark for that date; otherwise mark across all target dates
    const targetDates = slot.date && dates.includes(slot.date) ? [slot.date] : dates;

    for (const date of targetDates) {
      if (!grid[date]) grid[date] = {};
      for (const hour of WHEN2MEET_HOURS) {
        if (isHourInSlot(hour, slot.startTime, slot.endTime)) {
          grid[date][hour] = true;
        }
      }
    }
  }

  return grid;
}

/**
 * Convert a 2D boolean grid back into a consolidated list of TimeSlots.
 * Merges consecutive available hours on the same date into a single continuous slot.
 */
export function hourGridToSlots(
  grid: HourAvailabilityGrid,
  dates: string[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let slotCounter = 1;

  for (const date of dates) {
    const dayHours = grid[date] || {};
    let blockStart: number | null = null;
    let blockEnd: number | null = null;

    for (const hour of WHEN2MEET_HOURS) {
      const isAvailable = Boolean(dayHours[hour]);

      if (isAvailable) {
        if (blockStart === null) {
          blockStart = hour;
          blockEnd = hour + 1;
        } else if (blockEnd === hour) {
          blockEnd = hour + 1;
        } else {
          // Push previous block
          const startStr = `${String(blockStart).padStart(2, '0')}:00`;
          const endStr = `${String(blockEnd).padStart(2, '0')}:00`;
          slots.push({
            id: `slot-${date}-${slotCounter++}`,
            startTime: startStr,
            endTime: endStr,
            date,
          });
          blockStart = hour;
          blockEnd = hour + 1;
        }
      } else if (blockStart !== null) {
        const startStr = `${String(blockStart).padStart(2, '0')}:00`;
        const endStr = `${String(blockEnd).padStart(2, '0')}:00`;
        slots.push({
          id: `slot-${date}-${slotCounter++}`,
          startTime: startStr,
          endTime: endStr,
          date,
        });
        blockStart = null;
        blockEnd = null;
      }
    }

    if (blockStart !== null && blockEnd !== null) {
      const startStr = `${String(blockStart).padStart(2, '0')}:00`;
      const endStr = `${String(blockEnd).padStart(2, '0')}:00`;
      slots.push({
        id: `slot-${date}-${slotCounter++}`,
        startTime: startStr,
        endTime: endStr,
        date,
      });
    }
  }

  return slots;
}

/**
 * Computes the aggregated group When2Meet matrix across all candidate dates and hours.
 */
export function computeWhen2MeetMatrix(
  dates: string[],
  friends: Friend[]
): Record<string, Record<number, When2MeetCell>> {
  const result: Record<string, Record<number, When2MeetCell>> = {};
  const totalCount = friends.length;

  for (const date of dates) {
    result[date] = {};
    for (const hour of WHEN2MEET_HOURS) {
      const availableFriends: string[] = [];
      const unavailableFriends: string[] = [];

      for (const friend of friends) {
        let isAvailable = false;
        const slots = friend.availabilitySlots && friend.availabilitySlots.length > 0
          ? friend.availabilitySlots
          : [];

        if (slots.length > 0) {
          for (const slot of slots) {
            // Match date if specified, or match if slot has no date
            if (!slot.date || slot.date === date) {
              if (isHourInSlot(hour, slot.startTime, slot.endTime)) {
                isAvailable = true;
                break;
              }
            }
          }
        }

        if (isAvailable) {
          availableFriends.push(friend.name);
        } else {
          unavailableFriends.push(friend.name);
        }
      }

      const availableCount = availableFriends.length;
      const ratio = totalCount > 0 ? availableCount / totalCount : 0;

      result[date][hour] = {
        date,
        hour,
        timeLabel: formatHourLabel(hour),
        availableCount,
        totalCount,
        ratio,
        availableFriends,
        unavailableFriends,
      };
    }
  }

  return result;
}
