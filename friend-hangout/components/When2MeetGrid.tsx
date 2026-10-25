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
import { availabilityStrong } from "@/lib/availabilityHeat";
import { heatStyle } from "@/components/OverlapRunner";

interface When2MeetGridProps {
  dates: string[];
  friends: Friend[];
  currentUserId?: string;
  userSlots?: TimeSlot[];
  editable?: boolean;
  onSlotsChange?: (slots: TimeSlot[]) => void;
  title?: string;
  resetToken?: number;
}

export function When2MeetGrid({
  dates,
  friends,
  userSlots = [],
  editable = false,
  onSlotsChange,
  title = "Group Availability Heatmap (When2Meet)",
  resetToken = 0,
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
  const [appliedToken, setAppliedToken] = useState(resetToken);
  if (resetToken !== appliedToken) {
    setAppliedToken(resetToken);
    setDraftGrid(null);
  }

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

  if (dates.length === 0) {
    return (
      <div className="border border-seam bg-sheet p-5 text-center text-ink-soft">
        No dates selected. Select candidate dates above to view availability.
      </div>
    );
  }

  return (
    <div className="bg-pine p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <Users className="h-5 w-5 text-ink" />
            {title}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">Hover a slot to see who is free.</p>
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-sun/40 px-3 py-2 text-sm text-ink">
          <span>Drag across hours to paint when you are free.</span>
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
            className="bg-sheet px-2 py-1 text-xs font-semibold text-ink hover:bg-pine"
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
                <div className="text-xs font-normal text-ink-soft">{date}</div>
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
                          className={`avail-heat flex h-8 cursor-pointer select-none items-center justify-center border text-sm ${
                            isPersonalAvailable ? "font-semibold" : "text-ink-soft"
                          }`}
                          data-strong={isPersonalAvailable ? "true" : "false"}
                          style={heatStyle(isPersonalAvailable ? 1 : 0, 1)}
                          title={`${date} ${label}: ${isPersonalAvailable ? "Available" : "Unavailable"}`}
                        >
                          {isPersonalAvailable ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span className="text-xs">-</span>
                          )}
                        </div>
                      );
                    }

                    const total = cell?.totalCount || friends.length || 1;
                    const count = cell?.availableCount || 0;
                    return (
                      <div
                        key={`${date}-${hour}`}
                        onMouseEnter={() => handleCellMouseEnter(date, hour)}
                        className="avail-heat flex h-8 cursor-pointer select-none items-center justify-center border text-sm"
                        data-strong={availabilityStrong(count, total) ? "true" : "false"}
                        style={heatStyle(count, total)}
                        title={`${date} ${label} (${count}/${total} free)`}
                      >
                        {cell && cell.availableCount > 0 ? (
                          <span>
                            {cell.availableCount}/{cell.totalCount}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-soft">0</span>
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <div className="flex items-center gap-1.5">
            <span>Free</span>
            <span className="avail-heat inline-block h-3.5 w-5 border" style={heatStyle(0, 4)} />
            <span className="avail-heat inline-block h-3.5 w-5 border" style={heatStyle(1, 4)} />
            <span className="avail-heat inline-block h-3.5 w-5 border" style={heatStyle(2, 4)} />
            <span className="avail-heat inline-block h-3.5 w-5 border" style={heatStyle(3, 4)} />
            <span className="avail-heat inline-block h-3.5 w-5 border" data-strong="true" style={heatStyle(4, 4)} />
            <span>Everyone</span>
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
                      className="inline-flex items-center gap-1 bg-leaf/15 px-2 py-0.5 text-xs font-semibold text-leaf"
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
                      className="inline-flex items-center gap-1 bg-tomato/15 px-2 py-0.5 text-xs font-medium text-tomato"
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
