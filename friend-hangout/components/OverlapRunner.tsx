import type { CSSProperties } from "react";
import type { Friend } from "@/types";
import { availabilityRatio, availabilityStrong, availabilityWord } from "@/lib/availabilityHeat";

export type RunnerHour = {
  h24: number;
  label: string;
  count: number;
  total: number;
  names: string[];
};

const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function covers(startTime: string, endTime: string, h24: number) {
  const startH = Number(startTime.split(":")[0]);
  const endH = Number(endTime.split(":")[0]);
  if (Number.isNaN(startH) || Number.isNaN(endH)) return false;
  return h24 >= startH && h24 < endH;
}

export function buildRunnerHours(
  friends: Friend[],
  draft?: { friendId: string; startTime: string; endTime: string }
): RunnerHour[] {
  return HOURS.map((h24) => {
    const names = friends
      .filter((friend) => {
        if (draft && friend.id === draft.friendId) {
          return covers(draft.startTime, draft.endTime, h24);
        }
        const slot = friend.availabilitySlots[0];
        return slot ? covers(slot.startTime, slot.endTime, h24) : false;
      })
      .map((friend) => friend.name);
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const suffix = h24 >= 12 ? "p" : "a";
    return {
      h24,
      label: `${h12}${suffix}`,
      count: names.length,
      total: friends.length,
      names,
    };
  });
}

export function OverlapRunner({
  hours,
  summary,
}: {
  hours: RunnerHour[];
  summary: string;
}) {
  return (
    <figure className="avail-board mt-5">
      <figcaption className="text-base">{summary}</figcaption>
      <div className="mt-3 overflow-x-auto">
        <div
          className="grid min-w-[42rem] grid-cols-12 border-l border-[var(--avail-line)]"
          role="list"
          aria-label="Hours from 11 AM to 10 PM. Green deepens as more mates are free."
        >
          {hours.map((cell) => {
            const word = availabilityWord(cell.count, cell.total);
            const who = cell.names.length > 0 ? cell.names.join(", ") : "nobody yet";
            return (
              <div
                key={cell.h24}
                role="listitem"
                title={`${word}. ${cell.count} of ${cell.total} free. ${who}`}
                aria-label={`${cell.label}, ${word}, ${cell.count} of ${cell.total} free. ${who}`}
                className="runner-cell avail-heat flex h-16 flex-col items-center justify-center border-y border-r"
                data-strong={availabilityStrong(cell.count, cell.total) ? "true" : "false"}
                style={heatStyle(cell.count, cell.total)}
              >
                <span className="text-sm font-semibold tabular-nums">{cell.label}</span>
                <span className="text-sm tabular-nums">
                  {cell.count}/{cell.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-4 text-sm">
        <li className="inline-flex items-center gap-2">
          <HeatSwatch count={0} total={4} />
          None free
        </li>
        <li className="inline-flex items-center gap-2">
          <HeatSwatch count={2} total={4} />
          Some free
        </li>
        <li className="inline-flex items-center gap-2">
          <HeatSwatch count={4} total={4} />
          Everyone free
        </li>
      </ul>
      <p className="mt-1 text-sm">The green gets deeper as more mates can make that hour.</p>
    </figure>
  );
}

export function heatStyle(count: number, total: number): CSSProperties {
  return { "--avail": String(availabilityRatio(count, total)) } as CSSProperties;
}

function HeatSwatch({ count, total }: { count: number; total: number }) {
  return (
    <span
      className="avail-heat inline-block h-3 w-3 border"
      data-strong={availabilityStrong(count, total) ? "true" : "false"}
      style={heatStyle(count, total)}
      aria-hidden
    />
  );
}
