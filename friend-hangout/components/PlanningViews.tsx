"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  Check,
  Download,
  Heart,
  Lock,
  ThumbsUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import { HangoutPlan, PlanningViewType, HangoutPreferences, ItineraryItem, Activity } from "@/types";
import { formatAge } from "@/lib/activityFormat";
import { buildItinerary } from "@/lib/planner";
import { editItinerary, spendSummary } from "@/lib/itineraryEdit";
import { downloadItineraryPng, formatPosterDate } from "@/lib/itineraryPoster";
import { parseItinerarySnapshot } from "@/lib/itineraryLock";
import { ItinerarySchedule } from "@/components/ItinerarySchedule";

interface PlanningViewsProps {
  currentPlan: HangoutPlan;
  activeView: PlanningViewType;
  onSelectView: (view: PlanningViewType) => void;
  preferences: HangoutPreferences;
  musePending?: boolean;
  scheduleRevision?: number;
}

const VIEWS: {
  id: PlanningViewType;
  label: string;
  detail: string;
  icon: typeof Award;
}[] = [
  {
    id: "overall",
    label: "Best overall",
    detail: "Balance of taste, money, and getting there.",
    icon: Award,
  },
  {
    id: "cheapest",
    label: "Cheapest",
    detail: "Lowest cost that still fits the window.",
    icon: TrendingDown,
  },
  {
    id: "interests",
    label: "Best match",
    detail: "Leans into the interests you turned on.",
    icon: Zap,
  },
];

export function PlanningViews({
  currentPlan,
  activeView,
  onSelectView,
  preferences,
  musePending = false,
  scheduleRevision = 0,
}: PlanningViewsProps) {
  const friends = preferences.friends;
  const groupName = preferences.groupName;
  const [votes, setVotes] = useState<Record<string, "up" | "love" | null>>({
    "f-1": "up",
    "f-2": "love",
    "f-3": "up",
  });
  const [isLocked, setIsLocked] = useState(false);
  const [override, setOverride] = useState<ItineraryItem[] | null>(null);
  const [itineraryLocked, setItineraryLocked] = useState(false);
  const [editsReady, setEditsReady] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [seenView, setSeenView] = useState(activeView);
  const [seenRevision, setSeenRevision] = useState(scheduleRevision);

  if (seenView !== activeView || seenRevision !== scheduleRevision) {
    setSeenView(activeView);
    setSeenRevision(scheduleRevision);
    if (!itineraryLocked) setOverride(null);
  }

  const items = useMemo(() => {
    if (itineraryLocked && override) return override;
    if (override) return buildItinerary(override.map((item) => item.activity), preferences);
    return currentPlan.itinerary;
  }, [itineraryLocked, override, preferences, currentPlan.itinerary]);

  const spend = spendSummary(
    items,
    friends.length || preferences.friendCount,
    preferences.maxBudgetPerPerson
  );
  const sameStops =
    items.length === currentPlan.itinerary.length &&
    items.every((item, index) => item.activity.id === currentPlan.itinerary[index]?.activity.id);

  useEffect(() => {
    let cancelled = false;
    const id = preferences.id || "txmates-demo";
    fetch(`/api/hangouts?id=${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { itineraryLock?: { locked?: boolean; snapshot?: unknown } } | null) => {
        if (cancelled || !data?.itineraryLock?.locked) return;
        const snapshot = parseItinerarySnapshot(data.itineraryLock.snapshot);
        if (!snapshot) return;
        setOverride(snapshot);
        setItineraryLocked(true);
        setCanDownload(true);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setEditsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [preferences.id]);

  async function persistItinerary(nextLocked: boolean, snapshot: ItineraryItem[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/hangouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: preferences.id || "txmates-demo",
          locked: nextLocked,
          itinerary: snapshot,
        }),
      });
      if (!res.ok) throw new Error("save");
    } catch {
      if (nextLocked) {
        setItineraryLocked(false);
        setScheduleNotice("The image downloaded, but the lock did not save. Try locking again.");
      } else {
        setItineraryLocked(true);
        setScheduleNotice("Unlock did not save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleReorder(from: number, to: number) {
    setOverride((current) => {
      const base = current ?? items;
      const state = { items: base, locked: itineraryLocked };
      const next = editItinerary(state, { type: "reorder", from, to }, preferences);
      if (next === state || next.items === base) return current;
      return next.items;
    });
  }

  function handleSwap(index: number, activity: Activity) {
    const state = { items, locked: itineraryLocked };
    const next = editItinerary(state, { type: "swap", index, activity }, preferences);
    if (next === state || next.items === items) return;
    setOverride(next.items);
    const stop = next.items[index];
    setScheduleNotice(
      stop
        ? `${activity.name} replaces stop ${index + 1}. That stop is now ${stop.timeSlot}.`
        : `${activity.name} is on the itinerary.`
    );
  }

  function posterInput(snapshot: ItineraryItem[]) {
    const totals = spendSummary(snapshot, friends.length || preferences.friendCount, preferences.maxBudgetPerPerson);
    return {
      groupName: preferences.groupName,
      dateLabel: formatPosterDate(preferences.date),
      location: preferences.location,
      items: snapshot,
      friends,
      totalPerPerson: totals.totalCostPerPerson,
      totalGroup: totals.totalGroupCost,
    };
  }

  function handleLock() {
    if (itineraryLocked || saving || !editsReady) return;
    const next = editItinerary({ items, locked: false }, { type: "lock" }, preferences);
    let downloaded = false;
    try {
      downloadItineraryPng(posterInput(next.items));
      downloaded = true;
    } catch {
      downloaded = false;
    }
    setOverride(next.items);
    setItineraryLocked(true);
    setCanDownload(true);
    setScheduleNotice(
      downloaded
        ? "Itinerary locked. The image should be in your downloads."
        : "Itinerary locked. The image did not download. Use Download image."
    );
    void persistItinerary(true, next.items);
  }

  function handleUnlock() {
    if (!itineraryLocked || saving) return;
    const next = editItinerary({ items, locked: true }, { type: "unlock" }, preferences);
    setItineraryLocked(false);
    setOverride(next.items);
    setScheduleNotice("Itinerary unlocked. You can reorder and swap again.");
    void persistItinerary(false, next.items);
  }

  function handleDownload() {
    try {
      downloadItineraryPng(posterInput(items));
      setScheduleNotice("Image downloaded.");
    } catch {
      setScheduleNotice("The image did not download. Try again.");
    }
  }

  const handleVote = (friendId: string, type: "up" | "love") => {
    setVotes((prev) => {
      const current = prev[friendId];
      if (current === type) {
        const next = { ...prev };
        delete next[friendId];
        return next;
      }
      return { ...prev, [friendId]: type };
    });
  };

  const voteCount = Object.keys(votes).length;
  const totalFriends = friends.length || 4;
  const consensusPercentage = Math.round((voteCount / totalFriends) * 100);
  const budget = currentPlan.nessieFinancialInsight;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">The plan</h2>
        <p className="mt-1 max-w-prose text-base text-ink-soft">
          Three ways to spend the same window for {groupName}. The schedule stays put; the stops change.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-px bg-seam sm:grid-cols-3" role="tablist">
          {VIEWS.map((view) => {
            const selected = activeView === view.id;
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onSelectView(view.id)}
                className={`px-4 py-3 text-left ${
                  selected ? "bg-sun text-ink" : "bg-sheet text-ink"
                }`}
              >
                <span className="flex items-center gap-2 text-base font-semibold">
                  <Icon className="h-4 w-4" aria-hidden />
                  {view.label}
                </span>
                <span className="mt-1 block text-sm text-ink-soft">{view.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-busy={musePending}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold text-ink">{currentPlan.title}</h2>
          <p className="text-sm text-ink-soft" role="status">
            {musePending
              ? "Muse is writing. A live call can take about 25 seconds."
              : currentPlan.isLiveAiGenerated
                ? currentPlan.museFromCache
                  ? `Saved Muse plan${currentPlan.museCachedAt ? `, ${formatAge(currentPlan.museCachedAt) || "earlier"}` : ""}`
                  : `Muse Spark live, ${currentPlan.aiModelUsed || "muse-spark-1.3"}`
                : "Muse Spark simulated"}
          </p>
        </div>
        {musePending && (
          <p role="status" className="mt-4 border border-seam bg-sheet px-4 py-3 text-base text-ink">
            Muse is writing this plan. A live call can take about 25 seconds. This plan stays on screen until it answers.
          </p>
        )}
        {currentPlan.museLimited && !musePending && (
          <p role="status" className="mt-4 border border-seam bg-sheet px-4 py-3 text-base text-ink">
            Muse daily limit reached. Showing the built-in picks.
          </p>
        )}
        <p className="mt-2 max-w-prose text-base text-ink-soft">{currentPlan.subtitle}</p>
        <p className="mt-4 max-w-prose text-base text-ink">{currentPlan.aiRationale}</p>
        {(currentPlan.aiIcebreaker || currentPlan.aiCoordinationTip) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {currentPlan.aiIcebreaker && (
              <p className="max-w-prose text-base text-ink">
                <span className="font-semibold">Icebreaker. </span>
                {currentPlan.aiIcebreaker}
              </p>
            )}
            {currentPlan.aiCoordinationTip && (
              <p className="max-w-prose text-base text-ink">
                <span className="font-semibold">How to move. </span>
                {currentPlan.aiCoordinationTip}
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink">Money</h2>
        <p className="mt-1 max-w-prose text-base text-ink-soft">
          {spend.budgetStatus === "under"
            ? "Under the cap."
            : spend.budgetStatus === "on-target"
              ? "On the cap."
              : "Over the cap."}{" "}
          {budget.source === "nessie"
            ? "The cap is a Nessie read of one customer unless you changed the amount."
            : "Nessie did not answer, so this comparison is an estimate, not a bank balance."}
        </p>
        <dl className="mt-4 divide-y divide-seam border-y border-seam">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-base text-ink-soft">Each person</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              ${spend.totalCostPerPerson.toFixed(0)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-base text-ink-soft">Whole group ({friends.length})</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              ${spend.totalGroupCost.toFixed(0)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-base text-ink-soft">Left under the cap, each</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              ${spend.savingsPerPerson.toFixed(0)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-base text-ink-soft">Plan fit</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              {budget.financialHealthScore} of 10
            </dd>
          </div>
        </dl>
        <p className="mt-3 max-w-prose text-base text-ink">{sameStops ? budget.budgetTip : spend.summary}</p>
      </section>

      <section id="itinerary-schedule" aria-busy={!editsReady || saving}>
        <h2 className="text-2xl font-semibold text-ink">Schedule</h2>
        <p className="mt-1 max-w-prose text-base text-ink-soft">
          {itineraryLocked
            ? "This itinerary is locked for the group. Order and swaps stay put until someone unlocks it."
            : `${items.length} stops inside the shared window. Drag a handle or use the arrow buttons to reorder. Click a stop to swap it. Times include the 20 minute travel gap, and the cost follows the stops.`}
        </p>
        {itineraryLocked && (
          <p role="status" className="mt-4 flex items-center gap-2 border border-ink bg-ink px-4 py-3 text-base font-semibold text-paper">
            <Lock className="h-4 w-4" aria-hidden />
            Itinerary locked
          </p>
        )}
        {scheduleNotice && (
          <p role="status" className="mt-4 border border-seam bg-sheet px-4 py-3 text-base text-ink">
            {scheduleNotice}
          </p>
        )}
        <ItinerarySchedule
          items={items}
          friends={friends}
          preferences={preferences}
          locked={itineraryLocked}
          editsReady={editsReady}
          onReorder={handleReorder}
          onSwap={handleSwap}
        />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={itineraryLocked ? handleUnlock : handleLock}
            disabled={!editsReady || saving}
            aria-pressed={itineraryLocked}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-4 text-base font-semibold text-paper disabled:opacity-70"
          >
            <Lock className="h-4 w-4" aria-hidden />
            {itineraryLocked ? "Unlock itinerary" : "Lock itinerary"}
          </button>
          {(itineraryLocked || canDownload) && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-seam bg-sheet px-4 text-base font-semibold text-ink"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download image
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold text-ink">Votes</h2>
          <p className="text-sm tabular-nums text-ink-soft">
            {voteCount} of {totalFriends} ({consensusPercentage}%)
          </p>
        </div>
        <div className="mt-3 h-2 bg-seam" aria-hidden>
          <div className="h-full bg-sun" style={{ width: `${consensusPercentage}%` }} />
        </div>
        <ul className="mt-2 border-t border-seam">
          {friends.map((friend) => {
            const vote = votes[friend.id];
            return (
              <li key={friend.id} className="flex items-center justify-between gap-3 border-b border-seam py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center text-sm font-semibold ${friend.avatarColor}`}
                  >
                    {friend.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-ink">{friend.name}</p>
                    <p className="text-sm text-ink-soft">
                      {vote === "love" ? "Loves it" : vote === "up" ? "In" : "No vote yet"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleVote(friend.id, "up")}
                    aria-pressed={vote === "up"}
                    aria-label={`${friend.name} is in`}
                    className={`grid h-11 w-11 place-items-center ${
                      vote === "up" ? "bg-ink text-paper" : "border border-seam text-ink"
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote(friend.id, "love")}
                    aria-pressed={vote === "love"}
                    aria-label={`${friend.name} loves it`}
                    className={`grid h-11 w-11 place-items-center ${
                      vote === "love" ? "bg-tomato text-white" : "border border-seam text-ink"
                    }`}
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-prose text-base text-ink">
            {isLocked
              ? "Locked on this machine. Votes are not saved to the database."
              : `${voteCount} mates have weighed in. Locking stays on this screen until you refresh.`}
          </p>
          <button
            type="button"
            onClick={() => setIsLocked(!isLocked)}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-4 text-base font-semibold text-paper"
          >
            {isLocked ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Unlock the plan
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" aria-hidden />
                Lock the plan
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
