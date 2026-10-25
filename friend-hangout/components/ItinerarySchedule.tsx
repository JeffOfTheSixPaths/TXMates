"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, MapPin, Check, ThumbsUp, ThumbsDown, Heart } from "lucide-react";
import type { Activity, Friend, HangoutPreferences, ItineraryItem, ItemVoteReaction } from "@/types";
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
  itemVotes?: Record<string, Record<string, ItemVoteReaction>>;
  downvotedIds?: Set<string>;
  downvotedNames?: Set<string>;
  activeVoterId?: string;
  onSelectActiveVoter?: (friendId: string) => void;
  onVoteItem?: (activity: Activity, friend: Friend, vote: ItemVoteReaction | null) => void;
}

export function ItinerarySchedule({
  items,
  friends,
  preferences,
  locked,
  editsReady,
  onReorder,
  onSwap,
  itemVotes = {},
  downvotedIds,
  downvotedNames,
  activeVoterId,
  onSelectActiveVoter,
  onVoteItem,
}: ItineraryScheduleProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const latestRef = useRef(items);
  const dragRef = useRef<{ index: number; start: number; moved: boolean } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [reorderNote, setReorderNote] = useState<string | null>(null);
  const canEdit = editsReady && !locked;

  const currentVoter = friends.find((f) => f.id === activeVoterId) || friends[0];

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
        Drag a handle to reorder stops. Arrow buttons move a stop up or down. Vote on individual stops with thumbs up, heart, or thumbs down. Disliked stops are saved to your account and shown less often.
      </p>

      {/* Voter selector bar */}
      {friends.length > 0 && currentVoter && (
        <div className="mb-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-ink">Voting as</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {friends.map((friend) => {
                  const isActive = currentVoter.id === friend.id;
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => onSelectActiveVoter?.(friend.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold ${
                        isActive
                          ? "bg-ink text-paper"
                          : "border border-seam bg-paper text-ink hover:bg-sheet"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${friend.avatarColor}`} />
                      {friend.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="max-w-xs text-sm text-ink-soft">
              A dislike is saved and that place shows up less.
            </p>
          </div>
        </div>
      )}

      <ol ref={listRef} className="mt-4 border-t border-seam" aria-describedby="itinerary-help">
        {items.map((item, index) => {
          const slot = parseSlotLabel(item.timeSlot);
          const coverage = slot ? coverageCount(friends, slot.start, slot.end) : null;
          const dragging = draggingIndex === index;

          const stopVotes = itemVotes[item.activity.id] || {};
          const activeVote = currentVoter ? stopVotes[currentVoter.id] || null : null;

          const downvoters = friends.filter((f) => stopVotes[f.id] === "down");
          const isDownvotedGlobally = Boolean(
            downvotedIds?.has(item.activity.id) ||
              (item.activity.name && downvotedNames?.has(item.activity.name.toLowerCase().trim()))
          );
          const hasDownvotes = downvoters.length > 0 || isDownvotedGlobally;

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
                    className="grid h-11 w-11 cursor-grab place-items-center text-ink touch-none active:cursor-grabbing disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-100"
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
                    className="grid h-11 w-11 place-items-center text-ink disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-100"
                    aria-label={`Move ${item.activity.name} up`}
                    disabled={!canEdit || index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center text-ink disabled:cursor-not-allowed disabled:text-ink-soft disabled:opacity-100"
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
                  <div className="mt-2 w-full text-left">
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

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setSwapIndex(index)}
                        className="mt-2 inline-flex items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-ink-soft"
                      >
                        Swap this stop
                      </button>
                    )}

                    {hasDownvotes && (
                      <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-tomato">
                        <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                        Disliked by {downvoters.map((d) => d.name.split(" ")[0]).join(", ") || "a mate"}. Saved, so it shows up less.
                      </p>
                    )}
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-ink">Vote on this stop</summary>
                      <div className="mt-2">

                      {/* Active voter voting controls */}
                      {currentVoter && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${currentVoter.avatarColor}`}
                            >
                              {currentVoter.name.charAt(0)}
                            </span>
                            <span className="text-sm font-medium text-ink">
                              {currentVoter.name}:
                            </span>
                          </div>

                          <div
                            className="flex items-center gap-1.5"
                            role="group"
                            aria-label={`Vote on ${item.activity.name} as ${currentVoter.name}`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onVoteItem?.(
                                  item.activity,
                                  currentVoter,
                                  activeVote === "up" ? null : "up"
                                )
                              }
                              aria-pressed={activeVote === "up"}
                              aria-label={`Vote in for ${item.activity.name}`}
                              title="I'm in for this stop"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold ${
                                activeVote === "up"
                                  ? "bg-ink text-paper"
                                  : "border border-seam bg-paper text-ink hover:bg-sheet"
                              }`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                              In
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onVoteItem?.(
                                  item.activity,
                                  currentVoter,
                                  activeVote === "love" ? null : "love"
                                )
                              }
                              aria-pressed={activeVote === "love"}
                              aria-label={`Love ${item.activity.name}`}
                              title="Love this stop!"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold ${
                                activeVote === "love"
                                  ? "bg-tomato text-white"
                                  : "border border-seam bg-paper text-ink hover:bg-sheet"
                              }`}
                            >
                              <Heart className="h-3.5 w-3.5" aria-hidden />
                              Love
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                onVoteItem?.(
                                  item.activity,
                                  currentVoter,
                                  activeVote === "down" ? null : "down"
                                )
                              }
                              aria-pressed={activeVote === "down"}
                              aria-label={`Dislike ${item.activity.name} (show less in future)`}
                              title="Dislike this place. It is saved and shown less often."
                              className={`inline-flex min-h-11 items-center gap-1 px-2.5 text-sm font-semibold ${
                                activeVote === "down"
                                  ? "bg-tomato text-white"
                                  : "bg-paper text-ink hover:text-tomato"
                              }`}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                              Dislike
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Squad breakdown if any votes exist */}
                      {Object.keys(stopVotes).length > 0 && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-seam/60 pt-2">
                          <span className="text-xs text-ink-soft">Squad votes:</span>
                          {friends.map((friend) => {
                            const vote = stopVotes[friend.id];
                            if (!vote) return null;
                            return (
                              <button
                                key={friend.id}
                                type="button"
                                onClick={() => onSelectActiveVoter?.(friend.id)}
                                title={`Click to switch voter to ${friend.name}`}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border ${
                                  vote === "down"
                                    ? "border-tomato/40 bg-tomato/10 text-tomato font-semibold"
                                    : vote === "love"
                                      ? "border-sun/60 bg-sun-soft text-ink font-semibold"
                                      : "border-seam bg-sheet text-ink"
                                }`}
                              >
                                <span>{friend.name.split(" ")[0]}:</span>
                                {vote === "love" ? "Love" : vote === "up" ? "In" : "Dislike"}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      </div>
                    </details>
                  </div>
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
          downvotedIds={downvotedIds}
          downvotedNames={downvotedNames}
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
