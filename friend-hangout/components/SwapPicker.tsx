"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import type { Activity, ActivityCategory, HangoutPreferences, ItineraryItem } from "@/types";
import { civilDate } from "@/lib/activityClassify";
import { formatAge, formatEventSpan } from "@/lib/activityFormat";
import { filterSwapCandidates } from "@/lib/itineraryEdit";
import { MOCK_ACTIVITIES, ACTIVITY_CATEGORIES } from "@/lib/mockData";
import { CATEGORY_ICONS } from "./categoryIcons";
import { EmptyState } from "./EmptyState";

interface SwapPickerProps {
  preferences: HangoutPreferences;
  itinerary: ItineraryItem[];
  index: number;
  onPick: (activity: Activity) => void;
  onClose: () => void;
}

export function SwapPicker({ preferences, itinerary, index, onPick, onClose }: SwapPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [pool, setPool] = useState<Activity[]>([]);
  const [source, setSource] = useState<"openserp" | "saved" | "fallback" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("location", preferences.location || "Austin, TX");
    fetch(`/api/discovery?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("discovery"))))
      .then((data: { activities?: Activity[]; source?: string; notice?: string }) => {
        if (cancelled) return;
        const activities = Array.isArray(data.activities) ? data.activities : [];
        if (activities.length === 0) {
          setPool(MOCK_ACTIVITIES);
          setSource("fallback");
          setNotice("Curated catalog. Nothing saved came back for this city.");
          return;
        }
        setPool(activities);
        setSource(data.source === "saved" || data.source === "openserp" ? data.source : "fallback");
        setNotice(typeof data.notice === "string" ? data.notice : null);
      })
      .catch(() => {
        if (cancelled) return;
        setPool(MOCK_ACTIVITIES);
        setSource("fallback");
        setNotice("Curated catalog. Saved spots did not load, so this list is the Austin demo set.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preferences.location]);

  const current = itinerary[index]?.activity;
  const filtered = useMemo(
    () =>
      filterSwapCandidates({
        pool,
        itinerary,
        index,
        preferences,
        today: civilDate(new Date()),
        query,
        category,
      }),
    [pool, itinerary, index, preferences, query, category]
  );

  const hiddenBits = [
    filtered.hidden.expired ? `${filtered.hidden.expired} already ended or miss this date` : "",
    filtered.hidden.budget ? `${filtered.hidden.budget} past the $${preferences.maxBudgetPerPerson} cap` : "",
    filtered.hidden.availability ? `${filtered.hidden.availability} outside the free window` : "",
  ].filter(Boolean);

  const dialog = (
    <dialog ref={dialogRef} className="itinerary-dialog" aria-labelledby="swap-title">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-seam px-4 py-4">
          <div>
            <h2 id="swap-title" className="text-2xl font-semibold text-ink">
              Swap {current?.name || "this stop"}
            </h2>
            <p className="mt-1 max-w-prose text-base text-ink-soft">
              Other events and places in {preferences.location}. Expired listings stay off the list, and a swap has to fit the ${preferences.maxBudgetPerPerson} cap and the hours people are free.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center border border-seam text-ink"
            aria-label="Close swap list"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-seam px-4 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Brisket, arcade, lake, jazz"
              aria-label="Search events and places"
              autoFocus
              className="w-full border border-seam bg-sheet py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-ink-soft"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`min-h-11 px-3 text-base font-semibold ${category === "all" ? "bg-ink text-paper" : "border border-seam bg-sheet text-ink"}`}
            >
              All
            </button>
            {ACTIVITY_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id];
              const selected = category === cat.id;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`inline-flex min-h-11 items-center gap-2 px-3 text-base font-semibold ${selected ? "bg-ink text-paper" : "border border-seam bg-sheet text-ink"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p role="status" className="border border-seam bg-sheet px-4 py-3 text-base text-ink">
              Checking saved spots in {preferences.location}.
            </p>
          ) : (
            <>
              <p
                role="status"
                className={`px-4 py-3 text-base ${source === "fallback" ? "bg-sun text-ink" : "border border-seam bg-sheet text-ink"}`}
              >
                {source === "fallback"
                  ? notice || "Curated catalog. Saved spots were not available for this search."
                  : source === "openserp"
                    ? notice || "Live spots saved for this city, with Muse notes when a listing has them."
                    : notice || "Saved spots for this city, including Muse notes and event dates when a listing has them."}
              </p>
              {hiddenBits.length > 0 && (
                <p className="mt-3 text-sm text-ink-soft">Hidden: {hiddenBits.join(", ")}.</p>
              )}
              {filtered.activities.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="Nothing to swap in"
                    message="Try another category or a shorter search. Ended events and swaps that miss the budget or the free window stay hidden."
                    onReset={() => {
                      setQuery("");
                      setCategory("all");
                    }}
                    actionText="Clear search and category"
                  />
                </div>
              ) : (
                <ul className="mt-4 border-t border-seam">
                  {filtered.activities.map((activity) => {
                    const when = formatEventSpan(activity.startDate, activity.endDate);
                    return (
                      <li key={activity.id} className="border-b border-seam">
                        <button
                          type="button"
                          onClick={() => onPick(activity)}
                          className="w-full px-1 py-3 text-left"
                        >
                          <span className="text-sm font-semibold text-ink">{activity.categoryLabel}</span>
                          <span className="mt-1 block text-xl font-semibold text-ink">{activity.name}</span>
                          <span className="mt-1 block text-sm text-ink">
                            {activity.kind === "event"
                              ? `Event${when ? `, ${when}` : ", date not listed"}`
                              : activity.kind === "place"
                                ? "Place"
                                : "Spot"}
                            {activity.resultFreshness === "saved"
                              ? ` · Saved, last seen ${formatAge(activity.lastSeen) || "earlier"}`
                              : activity.resultFreshness === "live"
                                ? " · Live"
                                : activity.isLiveResult
                                  ? " · Live"
                                  : " · Demo"}
                            {activity.museEnriched ? " · Muse" : ""}
                          </span>
                          <span className="mt-1 block text-sm text-ink-soft">
                            {activity.venue || activity.neighborhood}
                            {activity.address ? ` · ${activity.address}` : activity.location ? ` · ${activity.location}` : ""}
                            {" · "}
                            {activity.estimatedCostPerPerson === 0 ? "Free" : `$${activity.estimatedCostPerPerson} a person`}
                            {" · "}
                            {activity.durationMinutes} min
                          </span>
                          {activity.whyThisFits && (
                            <span className="mt-2 block text-base text-ink">
                              <span className="font-semibold">Why this fits. </span>
                              {activity.whyThisFits}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );

  return createPortal(dialog, document.body);
}
