"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import {
  HangoutPlan,
  PlanningViewType,
  HangoutPreferences,
  ItineraryItem,
  Activity,
  SquadPricePointResponse,
  Friend,
  ItemVoteReaction,
} from "@/types";
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
  squadAdvisory?: SquadPricePointResponse | null;
  downvotedIds?: Set<string>;
  downvotedNames?: Set<string>;
  onVoteRecorded?: (data: { downvotedIds: Set<string>; downvotedNames: Set<string> }) => void;
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
  squadAdvisory,
  downvotedIds,
  downvotedNames,
  onVoteRecorded,
}: PlanningViewsProps) {
  const friends = preferences.friends;
  const groupName = preferences.groupName;
  const [votes, setVotes] = useState<Record<string, "up" | "love" | null>>({
    "f-1": "up",
    "f-2": "love",
    "f-3": "up",
  });
  const [itemVotes, setItemVotes] = useState<Record<string, Record<string, ItemVoteReaction>>>({});
  const [activeVoterId, setActiveVoterId] = useState<string>(friends[0]?.id || "f-1");
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

  // Keep the latest callback in a ref so a new inline onVoteRecorded from the
  // parent does not re-run the votes fetch. Depending on the callback (or on
  // the friends array identity) made every parent render refetch votes and
  // re-trigger a Muse plan request in a tight loop.
  const onVoteRecordedRef = useRef(onVoteRecorded);
  useEffect(() => {
    onVoteRecordedRef.current = onVoteRecorded;
  }, [onVoteRecorded]);

  const voteUserIds = friends.map((f) => f.id).join(",");
  const voteCustomerIds = friends
    .map((f) => f.nessieCustomerId)
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    let cancelled = false;
    const userIds = voteUserIds;
    const customerIds = voteCustomerIds;
    fetch(
      `/api/votes/item?userIds=${encodeURIComponent(userIds)}&customerIds=${encodeURIComponent(customerIds)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            votes?: Array<{ activityId: string; userId: string; vote: ItemVoteReaction }>;
            downvotedActivityIds?: string[];
            downvotedActivityNames?: string[];
          } | null
        ) => {
          if (cancelled || !data) return;
          const map: Record<string, Record<string, ItemVoteReaction>> = {};
          if (Array.isArray(data.votes)) {
            for (const v of data.votes) {
              if (!map[v.activityId]) map[v.activityId] = {};
              map[v.activityId][v.userId] = v.vote;
            }
          }
          setItemVotes(map);
          if (Array.isArray(data.downvotedActivityIds)) {
            onVoteRecordedRef.current?.({
              downvotedIds: new Set(data.downvotedActivityIds),
              downvotedNames: new Set(data.downvotedActivityNames || []),
            });
          }
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [voteUserIds, voteCustomerIds]);

  const handleVoteItem = async (
    activity: Activity,
    friend: Friend,
    vote: ItemVoteReaction | null
  ) => {
    setItemVotes((prev) => {
      const next = { ...prev };
      const forAct = { ...(next[activity.id] || {}) };
      if (!vote) {
        delete forAct[friend.id];
      } else {
        forAct[friend.id] = vote;
      }
      next[activity.id] = forAct;
      return next;
    });

    try {
      const res = await fetch("/api/votes/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: friend.id,
          customerId: friend.nessieCustomerId,
          friendName: friend.name,
          activityId: activity.id,
          activityName: activity.name,
          vote,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setScheduleNotice(data.message);
        }
        if (Array.isArray(data.downvotedActivityIds)) {
          onVoteRecorded?.({
            downvotedIds: new Set(data.downvotedActivityIds),
            downvotedNames: new Set(data.downvotedActivityNames || []),
          });
        }
      }
    } catch {
      // Silently handle error
    }
  };

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
    <div className="space-y-12">
      <div>
        <h2 className="text-3xl font-semibold text-ink">The plan</h2>
        <p className="mt-2 max-w-prose text-base text-ink-soft">
          Same window for {groupName}. The stops change; the hours do not.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 border-b border-seam" role="tablist">
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
                className={`inline-flex min-h-11 items-center gap-2 border-b-2 text-base font-semibold ${
                  selected ? "border-ink text-ink" : "border-transparent text-ink-soft"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {view.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 max-w-prose text-base text-ink-soft">
          {VIEWS.find((view) => view.id === activeView)?.detail}
        </p>
      </div>

      <section aria-busy={musePending}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-3xl font-semibold text-ink">{currentPlan.title}</h2>
          <p className="text-sm text-ink-soft" role="status">
            {musePending
              ? "Muse is writing. A live call can take about 25 seconds."
              : currentPlan.museLimited
                ? "Local fallback. Muse is not writing this plan."
                : currentPlan.isLiveAiGenerated
                  ? currentPlan.museFromCache
                    ? `Saved Muse plan${currentPlan.museCachedAt ? `, ${formatAge(currentPlan.museCachedAt) || "earlier"}` : ""}`
                    : `Muse Spark live, ${currentPlan.aiModelUsed || "muse-spark-1.3"}`
                  : "Muse Spark simulated"}
          </p>
        </div>
        {musePending && (
          <p role="status" className="mt-4 text-base text-ink">
            Muse is writing. This plan stays until it answers.
          </p>
        )}
        {currentPlan.museLimited && !musePending && (
          <div role="status" className="mt-4 border-2 border-ink bg-sun-soft px-4 py-4">
            <h3 className="text-2xl text-ink">Muse is not writing this plan</h3>
            <p className="mt-2 max-w-prose text-base text-ink">
              {currentPlan.museNotice ||
                "The daily cap is used up, or Muse is off. These stops are still real places for this city, the budget, and the open hours."}
            </p>
          </div>
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
        <h2 className="text-3xl font-semibold text-ink">Money</h2>
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

        {squadAdvisory && (
          <div className="mt-6 max-w-prose">
            <p className="text-base text-ink">
              <span className="font-semibold">
                {spend.totalCostPerPerson <= squadAdvisory.groupPricePoint
                  ? "Within the squad cap"
                  : `$${(spend.totalCostPerPerson - squadAdvisory.groupPricePoint).toFixed(0)} over the squad cap`}
                .
              </span>{" "}
              Recommended ${squadAdvisory.groupPricePoint} a person, ${squadAdvisory.groupTotalPool} for the group.{" "}
              {squadAdvisory.rationale}
            </p>
            {squadAdvisory.coordinationTip && (
              <p className="mt-2 text-base text-ink-soft">{squadAdvisory.coordinationTip}</p>
            )}
          </div>
        )}
      </section>

      <section id="itinerary-schedule" aria-busy={!editsReady || saving}>
        <h2 className="text-3xl font-semibold text-ink">Schedule</h2>
        <p className="mt-2 max-w-prose text-base text-ink-soft">
          {itineraryLocked
            ? "Locked. Order and swaps stay put until someone unlocks it."
            : `${items.length} stops. Drag to reorder, or swap a stop. Times include a 20 minute gap.`}
        </p>
        {itineraryLocked && (
          <p role="status" className="mt-4 flex items-center gap-2 border border-ink bg-ink px-4 py-3 text-base font-semibold text-paper">
            <Lock className="h-4 w-4" aria-hidden />
            Itinerary locked
          </p>
        )}
        {scheduleNotice && (
          <p role="status" className="mt-4 text-base text-ink">
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
          itemVotes={itemVotes}
          downvotedIds={downvotedIds}
          downvotedNames={downvotedNames}
          activeVoterId={activeVoterId}
          onSelectActiveVoter={setActiveVoterId}
          onVoteItem={handleVoteItem}
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
        <div className="mt-6 border-t border-seam pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base text-ink">
              <span className="font-semibold tabular-nums">
                {voteCount} of {totalFriends}
              </span>{" "}
              weighed in
              <span className="text-ink-soft"> · {consensusPercentage}%</span>
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
          <p className="mt-2 text-sm text-ink-soft">
            {isLocked
              ? "Locked on this screen until you refresh."
              : "Locking stays on this screen until you refresh."}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {friends.map((friend) => {
              const vote = votes[friend.id];
              return (
                <li key={friend.id} className="flex items-center gap-1 border border-seam px-2">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center text-xs font-semibold ${friend.avatarColor}`}>
                    {friend.name.charAt(0)}
                  </span>
                  <span className="max-w-[7rem] truncate text-sm font-semibold text-ink">
                    {friend.name.split(" ")[0]}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleVote(friend.id, "up")}
                    aria-pressed={vote === "up"}
                    aria-label={`${friend.name} is in`}
                    className={`grid h-11 w-11 place-items-center ${vote === "up" ? "bg-ink text-paper" : "text-ink"}`}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote(friend.id, "love")}
                    aria-pressed={vote === "love"}
                    aria-label={`${friend.name} loves it`}
                    className={`grid h-11 w-11 place-items-center ${vote === "love" ? "bg-tomato text-white" : "text-ink"}`}
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
