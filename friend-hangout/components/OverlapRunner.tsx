import type { Friend } from "@/types";

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
    <figure className="mt-5">
      <figcaption className="text-base text-ink">{summary}</figcaption>
      <div className="mt-3 overflow-x-auto">
        <div
          className="grid min-w-[42rem] grid-cols-12 border-l border-seam"
          role="list"
          aria-label="Hours from 11 AM to 10 PM"
        >
          {hours.map((cell) => {
            const ratio = cell.total > 0 ? cell.count / cell.total : 0;
            const tone =
              ratio === 1
                ? "bg-sun text-ink"
                : ratio > 0
                  ? "bg-sun-soft text-ink"
                  : "bg-sheet text-ink-soft";
            const who =
              cell.names.length > 0 ? cell.names.join(", ") : "nobody yet";
            return (
              <div
                key={cell.h24}
                role="listitem"
                title={`${cell.count} of ${cell.total} free. ${who}`}
                className={`runner-cell flex h-16 flex-col items-center justify-center border-y border-r border-seam ${tone}`}
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
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 border border-seam bg-sheet" />
          None free
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 border border-seam bg-sun-soft" />
          Some free
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 border border-seam bg-sun" />
          Everyone free
        </span>
      </div>
    </figure>
  );
}
