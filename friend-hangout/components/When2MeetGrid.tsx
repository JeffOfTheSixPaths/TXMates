"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Users, Clock, Check, X } from "lucide-react";
import type { Friend, TimeSlot } from "@/types";
import {
  WHEN2MEET_HOURS,
  formatHourLabel,
  formatHourShort,
  computeWhen2MeetMatrix,
  slotsToHourGrid,
  hourGridToSlots,
  When2MeetCell,
} from "@/lib/when2meet";
import { formatFriendlyDate } from "@/lib/planner";

interface When2MeetGridProps {
  dates: string[];
  friends: Friend[];
  currentUserId?: string;
  userSlots?: TimeSlot[];
  editable?: boolean;
  onSlotsChange?: (slots: TimeSlot[]) => void;
  title?: string;
}

export function When2MeetGrid({
  dates,
  friends,
  userSlots = [],
  editable = false,
  onSlotsChange,
  title = "Group Availability Heatmap (When2Meet)",
}: When2MeetGridProps) {
  // Compute group matrix
  const matrix = useMemo(() => {
    return computeWhen2MeetMatrix(dates, friends);
  }, [dates, friends]);

  // Hovered / selected cell inspector
  const [inspectedCell, setInspectedCell] = useState<When2MeetCell | null>(null);

  // Tab switch between "Group Heatmap" and "My Availability" if editable
  const [viewMode, setViewMode] = useState<"group" | "personal">(
    editable ? "personal" : "group"
  );

  // Editable personal grid - uses draft state while editing, falls back to derived userSlots grid
  const [draftGrid, setDraftGrid] = useState<Record<string, Record<number, boolean>> | null>(null);

  const personalGrid = useMemo(() => {
    return draftGrid ?? slotsToHourGrid(userSlots, dates);
  }, [draftGrid, userSlots, dates]);

  // Drag-to-paint state for personal grid
  const isPaintingRef = useRef(false);
  const paintModeRef = useRef<boolean>(true); // true = mark available, false = mark unavailable

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPaintingRef.current) {
        isPaintingRef.current = false;
        if (onSlotsChange && draftGrid) {
          const newSlots = hourGridToSlots(draftGrid, dates);
          onSlotsChange(newSlots);
        }
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [draftGrid, dates, onSlotsChange]);

  const handleCellMouseDown = (date: string, hour: number) => {
    if (!editable || viewMode !== "personal") return;
    isPaintingRef.current = true;
    const currentVal = Boolean(personalGrid[date]?.[hour]);
    const targetVal = !currentVal;
    paintModeRef.current = targetVal;

    const nextGrid = {
      ...personalGrid,
      [date]: {
        ...(personalGrid[date] || {}),
        [hour]: targetVal,
      },
    };
    setDraftGrid(nextGrid);
  };

  const handleCellMouseEnter = (date: string, hour: number) => {
    // If painting personal availability
    if (isPaintingRef.current && editable && viewMode === "personal") {
      const targetVal = paintModeRef.current;
      const nextGrid = {
        ...personalGrid,
        [date]: {
          ...(personalGrid[date] || {}),
          [hour]: targetVal,
        },
      };
      setDraftGrid(nextGrid);
      return;
    }

    // Set inspection cell for group view
    const cell = matrix[date]?.[hour];
    if (cell) {
      setInspectedCell(cell);
    }
  };

  // Color generator for heatmap cells
  const getCellBgClass = (cell?: When2MeetCell) => {
    if (!cell || cell.totalCount === 0 || cell.availableCount === 0) {
      return "bg-pine/30 text-ink-soft hover:border-seam";
    }
    const ratio = cell.ratio;
    if (ratio === 1) {
      return "bg-emerald-600 text-white font-bold hover:bg-emerald-500";
    } else if (ratio >= 0.75) {
      return "bg-emerald-500 text-white font-semibold hover:bg-emerald-400";
    } else if (ratio >= 0.5) {
      return "bg-emerald-400 text-ink font-semibold hover:bg-emerald-300";
    } else if (ratio >= 0.25) {
      return "bg-emerald-200 text-ink hover:bg-emerald-100";
    } else {
      return "bg-emerald-100 text-ink hover:bg-emerald-50";
    }
  };

  if (dates.length === 0) {
    return (
      <div className="border border-seam bg-sheet p-5 text-center text-ink-soft">
        No dates selected. Select candidate dates above to view availability.
      </div>
    );
  }

  return (
    <div className="border border-seam bg-sheet p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-seam pb-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
            <Users className="h-5 w-5 text-ink" />
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Hover over time slots to see which friends are free. Darker green indicates higher friend overlap.
          </p>
        </div>

        {editable && (
          <div className="inline-flex rounded border border-seam bg-pine p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("personal")}
              className={`rounded px-3 py-1 transition-colors ${
                viewMode === "personal"
                  ? "bg-sun text-ink shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              My Availability
            </button>
            <button
              type="button"
              onClick={() => setViewMode("group")}
              className={`rounded px-3 py-1 transition-colors ${
                viewMode === "group"
                  ? "bg-sun text-ink shadow-sm"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              Group Heatmap
            </button>
          </div>
        )}
      </div>

      {editable && viewMode === "personal" && (
        <div className="mt-3 rounded border border-sun/50 bg-sun/15 p-2.5 text-xs text-ink flex items-center justify-between">
          <span>
            <strong>Drag-to-paint mode:</strong> Click and drag across time blocks to toggle your availability.
          </span>
          <button
            type="button"
            onClick={() => {
              const allAvailable: Record<string, Record<number, boolean>> = {};
              for (const d of dates) {
                allAvailable[d] = {};
                for (const h of WHEN2MEET_HOURS) {
                  allAvailable[d][h] = true;
                }
              }
              setDraftGrid(allAvailable);
              onSlotsChange?.(hourGridToSlots(allAvailable, dates));
            }}
            className="rounded border border-ink/30 bg-sheet px-2 py-0.5 text-[11px] font-semibold text-ink hover:bg-pine"
          >
            Mark All Free
          </button>
        </div>
      )}

      {/* Grid Table */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Header row with candidate dates */}
          <div
            className="grid gap-1 border-b border-seam pb-2 text-center text-xs font-bold text-ink"
            style={{
              gridTemplateColumns: `70px repeat(${dates.length}, minmax(80px, 1fr))`,
            }}
          >
            <div className="py-1 text-left text-ink-soft font-semibold">Time</div>
            {dates.map((date) => (
              <div key={date} className="rounded bg-pine/60 py-1.5 px-1">
                <div>{formatFriendlyDate(date)}</div>
                <div className="text-[10px] font-normal text-ink-soft">{date}</div>
              </div>
            ))}
          </div>

          {/* Time row grid */}
          <div className="mt-1 divide-y divide-seam/30">
            {WHEN2MEET_HOURS.map((hour) => {
              const label = formatHourLabel(hour);
              const shortLabel = formatHourShort(hour);

              return (
                <div
                  key={hour}
                  className="grid items-center gap-1 py-0.5"
                  style={{
                    gridTemplateColumns: `70px repeat(${dates.length}, minmax(80px, 1fr))`,
                  }}
                >
                  {/* Time label column */}
                  <div className="text-xs font-semibold text-ink-soft" title={label}>
                    {shortLabel}
                  </div>

                  {/* Date slot columns */}
                  {dates.map((date) => {
                    const cell = matrix[date]?.[hour];
                    const isPersonalAvailable = Boolean(personalGrid[date]?.[hour]);

                    if (editable && viewMode === "personal") {
                      return (
                        <div
                          key={`${date}-${hour}`}
                          onMouseDown={() => handleCellMouseDown(date, hour)}
                          onMouseEnter={() => handleCellMouseEnter(date, hour)}
                          className={`flex h-8 cursor-pointer select-none items-center justify-center rounded border text-xs transition-colors ${
                            isPersonalAvailable
                              ? "border-emerald-600 bg-emerald-500 font-bold text-white shadow-sm"
                              : "border-seam/50 bg-pine/30 text-ink-soft/60 hover:bg-pine"
                          }`}
                          title={`${date} ${label}: ${isPersonalAvailable ? "Available" : "Unavailable"}`}
                        >
                          {isPersonalAvailable ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-[10px]">-</span>
                          )}
                        </div>
                      );
                    }

                    // Group heatmap cell
                    const bgClass = getCellBgClass(cell);
                    return (
                      <div
                        key={`${date}-${hour}`}
                        onMouseEnter={() => handleCellMouseEnter(date, hour)}
                        className={`flex h-8 cursor-pointer select-none items-center justify-center rounded border border-transparent text-xs transition-colors ${bgClass}`}
                        title={`${date} ${label} (${cell?.availableCount || 0}/${cell?.totalCount || friends.length} free)`}
                      >
                        {cell && cell.availableCount > 0 ? (
                          <span>
                            {cell.availableCount}/{cell.totalCount}
                          </span>
                        ) : (
                          <span className="text-[10px] text-ink-soft/40">0</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Heatmap Legend */}
      {viewMode === "group" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-seam pt-3 text-xs text-ink-soft">
          <div className="flex items-center gap-1.5">
            <span>Availability:</span>
            <span className="inline-block h-3.5 w-5 rounded border border-seam/50 bg-pine/30" />
            <span>0</span>
            <span className="inline-block h-3.5 w-5 rounded bg-emerald-100" />
            <span className="inline-block h-3.5 w-5 rounded bg-emerald-300" />
            <span className="inline-block h-3.5 w-5 rounded bg-emerald-500" />
            <span className="inline-block h-3.5 w-5 rounded bg-emerald-600" />
            <span>All free</span>
          </div>

          <div className="text-right">
            Total mates: <strong className="text-ink">{friends.length}</strong>
          </div>
        </div>
      )}

      {/* Cell Inspector details popover / footer */}
      {inspectedCell && (
        <div className="mt-4 rounded border border-seam bg-pine/60 p-3 text-xs">
          <div className="flex items-center justify-between border-b border-seam/50 pb-2">
            <span className="inline-flex items-center gap-1 font-bold text-ink">
              <Clock className="h-3.5 w-3.5" />
              {formatFriendlyDate(inspectedCell.date)} · {inspectedCell.timeLabel}
            </span>
            <span className="font-semibold text-emerald-800">
              {inspectedCell.availableCount} of {inspectedCell.totalCount} friends free
            </span>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className="font-semibold text-leaf">Available ({inspectedCell.availableFriends.length}):</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {inspectedCell.availableFriends.length > 0 ? (
                  inspectedCell.availableFriends.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded bg-leaf/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-900"
                    >
                      <Check className="h-3 w-3 text-leaf" />
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-ink-soft italic">None</span>
                )}
              </div>
            </div>

            <div>
              <span className="font-semibold text-tomato">Unavailable ({inspectedCell.unavailableFriends.length}):</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {inspectedCell.unavailableFriends.length > 0 ? (
                  inspectedCell.unavailableFriends.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded bg-tomato/15 px-2 py-0.5 text-[11px] font-medium text-tomato"
                    >
                      <X className="h-3 w-3" />
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-ink-soft italic">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
