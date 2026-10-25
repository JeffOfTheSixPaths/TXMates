"use client";

import React, { useState } from "react";
import {
  Award,
  Check,
  Heart,
  Lock,
  MapPin,
  ThumbsUp,
  TrendingDown,
  Zap,
} from "lucide-react";
import { HangoutPlan, PlanningViewType, Friend } from "@/types";
import { formatAge, formatEventSpan } from "@/lib/activityFormat";
import { availabilityStrong, coverageCount, parseSlotLabel } from "@/lib/availabilityHeat";
import { heatStyle } from "@/components/OverlapRunner";

interface PlanningViewsProps {
  currentPlan: HangoutPlan;
  activeView: PlanningViewType;
  onSelectView: (view: PlanningViewType) => void;
  friends: Friend[];
  groupName: string;
  musePending?: boolean;
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
  friends,
  groupName,
  musePending = false,
}: PlanningViewsProps) {
  const [votes, setVotes] = useState<Record<string, "up" | "love" | null>>({
    "f-1": "up",
    "f-2": "love",
    "f-3": "up",
  });
  const [isLocked, setIsLocked] = useState(false);

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
          {budget.budgetStatus === "under"
            ? "Under the cap."
            : budget.budgetStatus === "on-target"
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
              ${currentPlan.totalCostPerPerson.toFixed(0)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-base text-ink-soft">Whole group ({friends.length})</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              ${currentPlan.totalGroupCost.toFixed(0)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-base text-ink-soft">Left under the cap, each</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              ${budget.savingsPerPerson.toFixed(0)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-base text-ink-soft">Plan fit</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              {budget.financialHealthScore} of 10
            </dd>
          </div>
        </dl>
        <p className="mt-3 max-w-prose text-base text-ink">{budget.budgetTip}</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-ink">Schedule</h2>
        <p className="mt-1 text-base text-ink-soft">
          {currentPlan.itinerary.length} stops inside the shared window.
        </p>
        <ol className="mt-4 border-t border-seam">
          {currentPlan.itinerary.map((item, idx) => {
            const slot = parseSlotLabel(item.timeSlot);
            const coverage = slot ? coverageCount(friends, slot.start, slot.end) : null;
            return (
            <li key={item.activity.id} className="grid gap-3 border-b border-seam py-5 sm:grid-cols-[7.5rem_1fr]">
              <div>
                <p className="text-sm font-semibold tabular-nums text-ink">{item.timeSlot}</p>
                <p className="mt-1 text-sm text-ink-soft">Stop {idx + 1}</p>
                {coverage && (
                  <p
                    className="avail-heat mt-1 inline-block border px-1.5 py-0.5 text-sm font-semibold"
                    data-strong={availabilityStrong(coverage.count, coverage.total) ? "true" : "false"}
                    style={heatStyle(coverage.count, coverage.total)}
                  >
                    {coverage.word} · {coverage.count}/{coverage.total} free
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-ink">{item.activity.name}</h3>
                {(item.activity.kind || item.activity.resultFreshness) && (
                  <p className="mt-1 text-sm text-ink">
                    {item.activity.resultFreshness === "live"
                      ? "Live"
                      : item.activity.resultFreshness === "saved"
                        ? `Saved, last seen ${formatAge(item.activity.lastSeen) || "earlier"}`
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
                  ${item.activity.estimatedCostPerPerson} a person · {item.activity.durationMinutes} min · {item.activity.categoryLabel}
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
                  {item.activity.highlights.map((highlight) => (
                    <li key={highlight} className="inline-flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      {highlight}
                    </li>
                  ))}
                </ul>
                {item.activity.whyThisFits && (
                  <p className="mt-2 text-base text-ink">
                    <span className="font-semibold">Why this fits. </span>
                    {item.activity.whyThisFits}
                  </p>
                )}
                {item.activity.museEnriched && (
                  <p className="mt-1 text-sm font-semibold text-ink">Muse</p>
                )}
                <p className="mt-2 text-sm text-ink-soft">
                  {item.notes} {coverage ? `${coverage.word}, ${coverage.count} of ${coverage.total} free for this stop.` : `${item.availableFriendsCount} friends free for this stop.`}
                </p>
              </div>
            </li>
            );
          })}
        </ol>
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
