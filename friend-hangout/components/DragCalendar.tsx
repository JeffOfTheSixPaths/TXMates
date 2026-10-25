"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from "lucide-react";
import { getDateRange } from "@/lib/planner";

interface DragCalendarProps {
  selectedDates: string[];
  activeDate: string;
  onDatesChange: (dates: string[]) => void;
  onActiveDateSelect?: (date: string) => void;
  minDate?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DragCalendar({
  selectedDates,
  activeDate,
  onDatesChange,
  onActiveDateSelect,
  minDate,
}: DragCalendarProps) {
  // If user navigates months, overrideView takes precedence over activeDate month
  const [overrideView, setOverrideView] = useState<{ viewYear: number; viewMonth: number } | null>(null);

  const { viewYear, viewMonth } = useMemo(() => {
    if (overrideView) return overrideView;
    const parts = activeDate ? activeDate.split("-").map(Number) : [];
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { viewYear: parts[0], viewMonth: parts[1] - 1 };
    }
    return { viewYear: 2026, viewMonth: 9 };
  }, [overrideView, activeDate]);

  const [dragStartIso, setDragStartIso] = useState<string | null>(null);
  const [dragHoverIso, setDragHoverIso] = useState<string | null>(null);
  const isDraggingRef = useRef(false);

  const commitDragSelection = useCallback(
    (startIso: string, endIso: string) => {
      const range = getDateRange(startIso, endIso);
      if (range.length === 0) return;

      const allAlreadySelected = range.every((d) => selectedDates.includes(d));
      let newDates: string[];

      if (allAlreadySelected) {
        newDates = selectedDates.filter((d) => !range.includes(d));
        if (newDates.length === 0) {
          newDates = [startIso];
        }
      } else {
        const merged = new Set([...selectedDates, ...range]);
        newDates = Array.from(merged).sort();
      }

      onDatesChange(newDates);

      if (!newDates.includes(activeDate) && newDates.length > 0 && onActiveDateSelect) {
        onActiveDateSelect(newDates[0]);
      }
    },
    [selectedDates, activeDate, onDatesChange, onActiveDateSelect]
  );

  // Global mouseup to finish drag even if mouse released outside calendar grid
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current && dragStartIso && dragHoverIso) {
        commitDragSelection(dragStartIso, dragHoverIso);
      }
      isDraggingRef.current = false;
      setDragStartIso(null);
      setDragHoverIso(null);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [dragStartIso, dragHoverIso, commitDragSelection]);

  const handleDayMouseDown = (iso: string) => {
    isDraggingRef.current = true;
    setDragStartIso(iso);
    setDragHoverIso(iso);
  };

  const handleDayMouseEnter = (iso: string) => {
    if (isDraggingRef.current) {
      setDragHoverIso(iso);
    }
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setOverrideView({ viewYear: viewYear - 1, viewMonth: 11 });
    } else {
      setOverrideView({ viewYear, viewMonth: viewMonth - 1 });
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setOverrideView({ viewYear: viewYear + 1, viewMonth: 0 });
    } else {
      setOverrideView({ viewYear, viewMonth: viewMonth + 1 });
    }
  };

  // Compute calendar days for the current view
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Preview range during active drag
  const dragRange =
    dragStartIso && dragHoverIso
      ? getDateRange(dragStartIso, dragHoverIso)
      : [];

  return (
    <div className="select-none bg-pine p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-ink" aria-hidden />
          <h3 className="text-base font-bold text-ink">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          <span className="ml-2 rounded-full bg-pine px-2 py-0.5 text-xs font-semibold text-ink-soft">
            {selectedDates.length} {selectedDates.length === 1 ? "date" : "dates"} selected
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="rounded p-1.5 text-ink-soft hover:bg-pine hover:text-ink focus:outline-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="rounded p-1.5 text-ink-soft hover:bg-pine hover:text-ink focus:outline-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-ink-soft">Click or drag across days.</p>

      {/* Weekday headers */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-soft">
        {WEEKDAY_NAMES.map((name) => (
          <div key={name} className="py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10 w-full" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const monthStr = String(viewMonth + 1).padStart(2, "0");
          const dayStr = String(day).padStart(2, "0");
          const iso = `${viewYear}-${monthStr}-${dayStr}`;

          const isSelected = selectedDates.includes(iso);
          const isActivePlan = activeDate === iso;
          const isInDragPreview = dragRange.includes(iso);
          const isPast = minDate ? iso < minDate : false;

          let cellClass =
            "relative flex h-10 w-full cursor-pointer flex-col items-center justify-center rounded text-sm transition-colors border ";

          if (isPast) {
            cellClass += "border-transparent text-ink-soft/40 cursor-not-allowed";
          } else if (isInDragPreview) {
            cellClass += "border-sun bg-sun/30 font-bold text-ink";
          } else if (isActivePlan) {
            cellClass += "border-ink bg-sun font-bold text-ink ring-2 ring-ink";
          } else if (isSelected) {
            cellClass += "border-sun/60 bg-sun/20 font-semibold text-ink";
          } else {
            cellClass += "border-transparent bg-pine/50 text-ink hover:bg-pine hover:border-seam";
          }

          return (
            <div
              key={iso}
              onMouseDown={() => !isPast && handleDayMouseDown(iso)}
              onMouseEnter={() => !isPast && handleDayMouseEnter(iso)}
              onClick={() => {
                if (!isPast && !dragStartIso) {
                  commitDragSelection(iso, iso);
                }
              }}
              className={cellClass}
              title={`${iso}${isActivePlan ? " (Active Plan Date)" : isSelected ? " (Selected)" : ""}`}
            >
              <span className="text-xs leading-none">{day}</span>
              {isActivePlan && (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-ink" />
              )}
              {isSelected && !isActivePlan && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-ink-soft" />
              )}
            </div>
          );
        })}
      </div>

      {/* Selected dates pills & quick switcher */}
      {selectedDates.length > 0 && (
        <div className="mt-4 border-t border-seam pt-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Selected Dates:
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {selectedDates.map((date) => {
              const isActive = date === activeDate;
              return (
                <div
                  key={date}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
                    isActive
                      ? "border border-ink bg-sun font-bold text-ink"
                      : "border border-seam bg-sheet text-ink hover:bg-pine"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onActiveDateSelect?.(date)}
                    className="flex items-center gap-1"
                    title={isActive ? "Current active plan date" : "Switch active plan to this date"}
                  >
                    {isActive && <Check className="h-3 w-3 text-ink" />}
                    <span>{date}</span>
                  </button>
                  {selectedDates.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const filtered = selectedDates.filter((d) => d !== date);
                        onDatesChange(filtered);
                        if (isActive && filtered.length > 0 && onActiveDateSelect) {
                          onActiveDateSelect(filtered[0]);
                        }
                      }}
                      className="ml-1 text-ink-soft hover:text-tomato focus:outline-none"
                      aria-label={`Remove date ${date}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
