"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, MapPin, Check } from "lucide-react";
import type { Activity, Friend, HangoutPreferences, ItineraryItem } from "@/types";
import { formatActivityPrice, formatAge, formatEventSpan } from "@/lib/activityFormat";
import { availabilityStrong, coverageCount, parseSlotLabel } from "@/lib/availabilityHeat";
import { indexFromPointer, reorderItinerary } from "@/lib/itineraryEdit";
import { heatStyle } from "@/components/OverlapRunner";
import { SwapPicker } from "./SwapPicker";

interface ItineraryScheduleProps {
  items: ItineraryItem[];
  friends: Friend[];
  preferences: HangoutPreferences;
  locked: boolean;
  editsReady: boolean;
  onReorder: (from: number, to: number) => void;
  onSwap: (index: number, activity: Activity) => void;
}

export function ItinerarySchedule({
  items,
  friends,
  preferences,
  locked,
  editsReady,
  onReorder,
  onSwap,
}: ItineraryScheduleProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const latestRef = useRef(items);
  const dragRef = useRef<{ index: number; start: number; moved: boolean } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [reorderNote, setReorderNote] = useState<string | null>(null);
  const canEdit = editsReady && !locked;

  useEffect(() => {
    if (!dragRef.current) latestRef.current = items;
  }, [items]);

  function announce(next: ItineraryItem[], index: number) {
    const item = next[index];
    if (!item) return;
    setReorderNote(`${item.activity.name} is now stop ${index + 1}, ${item.timeSlot}.`);
  }

  function move(from: number, to: number) {
    if (!canEdit || from === to || to < 0 || to >= items.length) return;
    const next = reorderItinerary(latestRef.current, from, to, preferences);
    latestRef.current = next;
    onReorder(from, to);
    announce(next, to);
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (!canEdit || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { index, start: index, moved: false };
    latestRef.current = items;
    setDraggingIndex(index);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const list = listRef.current;
    if (!drag || !list || !canEdit) return;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-stop]")];
    const mids = rows.map((row) => {
      const box = row.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    const target = indexFromPointer(event.clientY, mids);
    if (target === drag.index) return;
    const from = drag.index;
    const next = reorderItinerary(latestRef.current, from, target, preferences);
    latestRef.current = next;
    drag.index = target;
    drag.moved = true;
    setDraggingIndex(target);
    onReorder(from, target);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingIndex(null);
    if (drag?.moved) announce(latestRef.current, drag.index);
  }

  return (
    <div>
      <p id="itinerary-help" className="sr-only">
        Drag a handle to reorder stops. Arrow buttons move a stop up or down. Activating a stop opens other places and events in this city.
      </p>
      <ol ref={listRef} className="mt-4 border-t border-seam" aria-describedby="itinerary-help">
        {items.map((item, index) => {
          const slot = parseSlotLabel(item.timeSlot);
          const coverage = slot ? coverageCount(friends, slot.start, slot.end) : null;
          const dragging = draggingIndex === index;
          return (
            <li
              key={item.activity.id}
              data-stop
              data-stop-index={index}
              className={`border-b border-seam py-4 ${dragging ? "bg-sun-soft" : ""}`}
            >
              <div className="flex gap-3">
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className="grid h-11 w-11 cursor-grab place-items-center border border-seam text-ink touch-none active:cursor-grabbing disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-100"
                    aria-label={`Drag to reorder ${item.activity.name}`}
                    disabled={!canEdit}
                    onPointerDown={(event) => onPointerDown(event, index)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        move(index, index - 1);
                      } else if (event.key === "ArrowDown") {
                        event.preventDefault();
                        move(index, index + 1);
                      }
                    }}
                  >
                    <GripVertical className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center border border-seam text-ink disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-100"
                    aria-label={`Move ${item.activity.name} up`}
                    disabled={!canEdit || index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center border border-seam text-ink disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-100"
                    aria-label={`Move ${item.activity.name} down`}
                    disabled={!canEdit || index === items.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tabular-nums text-ink">{item.timeSlot}</p>
                  <p className="mt-1 text-sm text-ink-soft">Stop {index + 1}</p>
                  {coverage && (
                    <p
                      className="avail-heat mt-1 inline-block border px-1.5 py-0.5 text-sm font-semibold"
                      data-strong={availabilityStrong(coverage.count, coverage.total) ? "true" : "false"}
                      style={heatStyle(coverage.count, coverage.total)}
                    >
                      {coverage.word} · {coverage.count}/{coverage.total} free
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-2 w-full text-left"
                    aria-disabled={!canEdit}
                    tabIndex={canEdit ? 0 : -1}
                    onClick={() => {
                      if (!canEdit) return;
                      setSwapIndex(index);
                    }}
                  >
                    <h3 className="text-xl font-semibold text-ink">{item.activity.name}</h3>
                    {(item.activity.kind || item.activity.resultFreshness) && (
                      <p className="mt-1 text-sm text-ink">
                        {item.activity.resultFreshness === "live"
                          ? "Live"
                          : item.activity.resultFreshness === "saved"
                            ? `Saved, last seen ${formatAge(item.activity.lastSeen) || "earlier"}`
                            : item.activity.resultFreshness === "catalog"
                              ? "Austin calendar"
                              : "Demo"}
                        {item.activity.kind === "event"
                          ? ` · Event${formatEventSpan(item.activity.startDate, item.activity.endDate) ? `, ${formatEventSpan(item.activity.startDate, item.activity.endDate)}` : ", date not listed"}`
                          : item.activity.kind === "place"
                            ? " · Place"
                            : ""}
                      </p>
                    )}
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        {item.activity.location} ({item.activity.neighborhood})
                      </span>
                    </p>
                    <p className="mt-2 max-w-prose text-base text-ink">{item.activity.description}</p>
                    <p className="mt-2 text-sm tabular-nums text-ink">
                      {formatActivityPrice(item.activity, "person")} · {item.activity.durationMinutes} min · {item.activity.categoryLabel}
                    </p>
                    {item.activity.highlights.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
                        {item.activity.highlights.map((highlight) => (
                          <li key={highlight} className="inline-flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.activity.whyThisFits && (
                      <p className="mt-2 text-base text-ink">
                        <span className="font-semibold">Why this fits. </span>
                        {item.activity.whyThisFits}
                      </p>
                    )}
                    {item.activity.museEnriched && <p className="mt-1 text-sm font-semibold text-ink">Muse</p>}
                    <p className="mt-2 text-sm text-ink-soft">
                      {item.notes}{" "}
                      {coverage
                        ? `${coverage.word}, ${coverage.count} of ${coverage.total} free for this stop.`
                        : `${item.availableFriendsCount} friends free for this stop.`}
                    </p>
                    {canEdit && <p className="mt-2 text-sm font-semibold text-ink">Swap this stop</p>}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p role="status" className="sr-only">
        {reorderNote}
      </p>
      {swapIndex !== null && canEdit && (
        <SwapPicker
          preferences={preferences}
          itinerary={items}
          index={swapIndex}
          onClose={() => setSwapIndex(null)}
          onPick={(activity) => {
            onSwap(swapIndex, activity);
            setSwapIndex(null);
          }}
        />
      )}
    </div>
  );
}
