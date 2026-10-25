'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, Compass, Star } from 'lucide-react';
import {
  Activity,
  HangoutPreferences,
  PlanningViewType,
  Friend,
  SquadPricePointResponse,
} from '@/types';
import { INITIAL_FRIENDS } from '@/lib/mockData';
import { generatePlan, buildItinerary, calculateAvailabilityOverlap, compareCandidateDates } from '@/lib/planner';
import { Header } from '@/components/Header';
import { HangoutForm } from '@/components/HangoutForm';
import { OrganizerAccount } from '@/components/OrganizerAccount';
import { PlanningViews } from '@/components/PlanningViews';
import { ActivityDiscovery } from '@/components/ActivityDiscovery';
import { buildRunnerHours, OverlapRunner } from '@/components/OverlapRunner';
import type { NessieBudgetResponse } from '@/lib/nessieBudget';

function formatHangoutDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const DEFAULT_PREFERENCES: HangoutPreferences = {
  id: 'txmates-demo',
  groupName: 'Austin Weekend Crew',
  friendCount: 4,
  location: 'Austin, TX',
  date: '2026-10-26',
  selectedDates: ['2026-10-26', '2026-10-27', '2026-10-31'],
  timePreference: 'afternoon',
  maxBudgetPerPerson: 50,
  selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
  friends: INITIAL_FRIENDS,
};

interface HangoutWorkspaceProps {
  hangoutId?: string;
}

export function HangoutWorkspace({ hangoutId = 'txmates-demo' }: HangoutWorkspaceProps) {
  const [preferences, setPreferences] = useState<HangoutPreferences>(() => ({
    ...DEFAULT_PREFERENCES,
    id: hangoutId,
  }));
  const [activeView, setActiveView] = useState<PlanningViewType>('overall');
  const [isGenerating, setIsGenerating] = useState(false);
  const [musePending, setMusePending] = useState(true);
  const [shortlist, setShortlist] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<'planner' | 'discovery'>('planner');
  const [plannerStep, setPlannerStep] = useState<'who' | 'when' | 'budget'>('who');
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);
  const [nessie, setNessie] = useState<NessieBudgetResponse | null>(null);
  const [, setNessieLoading] = useState(true);
  const [nessieCustomerId] = useState('');
  const [nessieAccountId] = useState('');
  const [squadAdvisory, setSquadAdvisory] = useState<SquadPricePointResponse | null>(null);
  const [squadAdvisoryLoading, setSquadAdvisoryLoading] = useState(true);
  const [, setScheduleRevision] = useState(0);
  const [downvotedIds, setDownvotedIds] = useState<Set<string>>(new Set());
  const [downvotedNames, setDownvotedNames] = useState<Set<string>>(new Set());
  const budgetTouched = useRef(false);
  const [liveAiData, setLiveAiData] = useState<
    Record<
      PlanningViewType,
      {
        aiRationale: string;
        aiIcebreaker?: string;
        aiCoordinationTip?: string;
        budgetExplanation?: string;
        budgetTips?: string[];
        isLive: boolean;
        model: string;
        cached?: boolean;
        cachedAt?: string;
        activities?: Activity[];
        limited?: boolean;
        filled?: boolean;
      } | null
    >
  >({
    overall: null,
    cheapest: null,
    interests: null,
  });

  const friendCount = preferences.friends.length;

  // Load hangout details from database on mount or when hangoutId changes
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/hangouts?id=${hangoutId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.hangout) {
          setPreferences((prev) => ({
            ...prev,
            ...data.hangout,
            id: hangoutId,
          }));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [hangoutId]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set('friendCount', String(friendCount));
    if (nessieCustomerId) params.set('customerId', nessieCustomerId);
    if (nessieAccountId) params.set('accountId', nessieAccountId);

    fetch(`/api/nessie/budget?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: NessieBudgetResponse | null) => {
        if (cancelled || !data?.estimate) return;
        setNessie(data);
        if (data.estimate.source === 'nessie' && !budgetTouched.current) {
          setPreferences((prev) =>
            prev.maxBudgetPerPerson === data.estimate.suggestedPerPerson
              ? prev
              : { ...prev, maxBudgetPerPerson: data.estimate.suggestedPerPerson }
          );
        }
      })
      .catch(() => {
        if (!cancelled) setNessie(null);
      })
      .finally(() => {
        if (!cancelled) setNessieLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [friendCount, nessieCustomerId, nessieAccountId]);

  // Fetch squad price point recommendations from Nessie & Meta Muse Spark
  useEffect(() => {
    let cancelled = false;

    fetch('/api/nessie/price-point', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friends: preferences.friends }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SquadPricePointResponse | null) => {
        if (cancelled || !data) return;
        setSquadAdvisory(data);
      })
      .catch(() => {
        if (!cancelled) setSquadAdvisory(null);
      })
      .finally(() => {
        if (!cancelled) setSquadAdvisoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [preferences.friends]);

  // Sync to SQL on preference changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/api/hangouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...preferences, id: hangoutId }),
      }).catch((err) => console.error('Error auto-saving hangout to SQL:', err));
    }, 600);

    return () => clearTimeout(timer);
  }, [preferences, hangoutId]);

  // Load saved item votes for the group's members so recommendations avoid downvoted places
  useEffect(() => {
    let cancelled = false;
    const userIds = preferences.friends.map((f) => f.id).join(',');
    const customerIds = preferences.friends
      .map((f) => f.nessieCustomerId)
      .filter(Boolean)
      .join(',');

    fetch(
      `/api/votes/item?userIds=${encodeURIComponent(userIds)}&customerIds=${encodeURIComponent(customerIds)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: { downvotedActivityIds?: string[]; downvotedActivityNames?: string[] } | null) => {
          if (cancelled || !data) return;
          if (Array.isArray(data.downvotedActivityIds)) {
            setDownvotedIds(new Set(data.downvotedActivityIds));
          }
          if (Array.isArray(data.downvotedActivityNames)) {
            setDownvotedNames(new Set(data.downvotedActivityNames));
          }
        }
      )
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [preferences.friends]);

  // Poll for When2Meet submissions from friends
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/hangouts?id=${hangoutId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hangout && data.hangout.friends) {
            let hasChange = false;
            let updatedFriendName = '';

            const currentMap = new Map(preferences.friends.map((f) => [f.id, f]));
            data.hangout.friends.forEach((remoteFriend: Friend) => {
              const local = currentMap.get(remoteFriend.id);
              if (local) {
                const remoteSlot = remoteFriend.availabilitySlots[0];
                const localSlot = local.availabilitySlots[0];
                if (
                  remoteFriend.status === 'submitted' &&
                  local.status !== 'submitted'
                ) {
                  hasChange = true;
                  updatedFriendName = remoteFriend.name;
                } else if (
                  remoteSlot &&
                  localSlot &&
                  (remoteSlot.startTime !== localSlot.startTime ||
                    remoteSlot.endTime !== localSlot.endTime)
                ) {
                  hasChange = true;
                  updatedFriendName = remoteFriend.name;
                }
              }
            });

            if (hasChange) {
              setPreferences((prev) => ({
                ...prev,
                friends: data.hangout.friends,
              }));
              setLastSyncNotice(
                `${updatedFriendName || 'A friend'} updated their hours. The overlap moved with them.`
              );
              setTimeout(() => setLastSyncNotice(null), 6000);
            }
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3500);

    return () => clearInterval(pollInterval);
  }, [hangoutId, preferences.friends]);

  // Fetch live Meta Muse Spark AI synthesis
  const fetchLiveMusePlan = async (
    view: PlanningViewType,
    isCancelled = () => false,
    overrideDownvotes?: { downvotedIds?: Set<string>; downvotedNames?: Set<string> }
  ) => {
    try {
      const activeDownvotedIds = overrideDownvotes?.downvotedIds || downvotedIds;
      const activeDownvotedNames = overrideDownvotes?.downvotedNames || downvotedNames;
      const basePlan = generatePlan(preferences, view, nessie?.estimate, {
        downvotedIds: activeDownvotedIds,
        downvotedNames: activeDownvotedNames,
      });
      const res = await fetch('/api/muse/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          viewType: view,
          activities: basePlan.activities,
          nessie: nessie?.estimate || null,
          downvotedActivityIds: Array.from(activeDownvotedIds),
          downvotedActivityNames: Array.from(activeDownvotedNames),
        }),
      });

      if (res.ok && !isCancelled()) {
        const data = await res.json();
        if (data.isLive || data.limited || data.filled) {
          const budgetTips = Array.isArray(data.budgetTips)
            ? data.budgetTips.filter((tip: unknown): tip is string => typeof tip === 'string' && tip.trim().length > 0)
            : undefined;
          setLiveAiData((prev) => ({
            ...prev,
            [view]: {
              aiRationale: data.aiRationale || '',
              aiIcebreaker: data.aiIcebreaker,
              aiCoordinationTip: data.aiCoordinationTip,
              budgetExplanation: typeof data.budgetExplanation === 'string' ? data.budgetExplanation : undefined,
              budgetTips,
              isLive: Boolean(data.isLive),
              model: data.model || 'muse-spark-1.3',
              cached: Boolean(data.cached),
              cachedAt: typeof data.cachedAt === 'string' ? data.cachedAt : undefined,
              activities: Array.isArray(data.activities) ? data.activities : undefined,
              limited: Boolean(data.limited),
              filled: Boolean(data.filled),
            },
          }));
        }
      }
    } catch {
      // Deterministic fallback remains active
    } finally {
      if (!isCancelled()) setMusePending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchLiveMusePlan('overall', () => cancelled);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute current plan deterministically, augmented with live Meta Muse Spark AI synthesis
  const currentPlan = useMemo(() => {
    const base = generatePlan(preferences, activeView, nessie?.estimate, {
      downvotedIds,
      downvotedNames,
    });
    const live = liveAiData[activeView];
    if (live && (live.isLive || live.limited || live.filled)) {
      const liveActivities = live.activities?.length ? live.activities : base.activities;
      const isDownvoted = (act: Activity) =>
        downvotedIds.has(act.id) ||
        (act.name && downvotedNames.has(act.name.toLowerCase().trim()));

      const hasDownvoted = liveActivities.some(isDownvoted);
      const activities = hasDownvoted ? base.activities : liveActivities;

      const totalCostPerPerson = activities.reduce((sum, activity) => sum + activity.estimatedCostPerPerson, 0);
      const count = preferences.friends.length || preferences.friendCount || 1;
      const museMoney = [live.budgetExplanation, ...(live.budgetTips || [])].filter(Boolean).join(' ');
      return {
        ...base,
        activities,
        itinerary: activities.length ? buildItinerary(activities, preferences) : base.itinerary,
        totalCostPerPerson,
        totalGroupCost: totalCostPerPerson * count,
        aiRationale: live.aiRationale || base.aiRationale,
        isLiveAiGenerated: Boolean(live.isLive),
        aiModelUsed: live.model,
        aiIcebreaker: live.aiIcebreaker,
        aiCoordinationTip: live.aiCoordinationTip,
        museFromCache: live.cached,
        museCachedAt: live.cachedAt,
        museLimited: Boolean(live.limited),
        nessieFinancialInsight: museMoney
          ? { ...base.nessieFinancialInsight, budgetTip: museMoney }
          : base.nessieFinancialInsight,
      };
    }
    return base;
  }, [preferences, activeView, liveAiData, nessie, downvotedIds, downvotedNames]);

  const handleGenerate = () => {
    setIsGenerating(true);
    setMusePending(true);
    setLiveAiData({ overall: null, cheapest: null, interests: null });
    fetchLiveMusePlan(activeView).finally(() => {
      setIsGenerating(false);
      const el = document.getElementById('planning-views-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const handleToggleShortlist = (activity: Activity) => {
    setShortlist((prev) => {
      const exists = prev.some((a) => a.id === activity.id);
      if (exists) {
        return prev.filter((a) => a.id !== activity.id);
      } else {
        return [...prev, activity];
      }
    });
  };

  const handleClearShortlist = () => {
    setShortlist([]);
  };

  const handleApplyShortlist = () => {
    if (shortlist.length === 0) return;
    const customCategories = Array.from(new Set(shortlist.map((a) => a.category)));
    setPreferences((prev) => ({
      ...prev,
      selectedInterests: customCategories,
    }));
    setActiveTab('planner');
    const el = document.getElementById('planning-views-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleReset = () => {
    setPreferences({
      ...DEFAULT_PREFERENCES,
      id: hangoutId,
    });
    setActiveView('overall');
    setShortlist([]);
    setScheduleRevision((rev) => rev + 1);
  };

  const handleApplySquadPricePoint = (target: number) => {
    budgetTouched.current = true;
    setPreferences((prev) => ({
      ...prev,
      maxBudgetPerPerson: target,
      friends: prev.friends.map((f) => ({
        ...f,
        budgetPreference: target,
      })),
    }));
  };

  const candidateDates = useMemo(() => {
    const list =
      preferences.selectedDates && preferences.selectedDates.length > 0
        ? preferences.selectedDates
        : [preferences.date];
    const uniqueList = list.includes(preferences.date) ? list : [preferences.date, ...list];
    return compareCandidateDates(preferences.friends, uniqueList);
  }, [preferences.friends, preferences.selectedDates, preferences.date]);

  const overlap = calculateAvailabilityOverlap(preferences.friends, preferences.date);
  const runnerHours = useMemo(
    () => buildRunnerHours(preferences.friends, undefined, preferences.date),
    [preferences.friends, preferences.date]
  );
  const overlapSummary = overlap.allFriendsAvailable
    ? `All ${preferences.friends.length} mates free, ${overlap.commonStart} to ${overlap.commonEnd}.`
    : `${overlap.availableFriendCount} of ${preferences.friends.length} overlap, ${overlap.commonStart} to ${overlap.commonEnd}.`;

  return (
    <div className="flex min-h-screen flex-col bg-pine text-ink">
      <Header
        friendCount={preferences.friends.length}
        location={preferences.location}
        hasPlan={true}
        onReset={handleReset}
        hangoutId={hangoutId}
        groupName={preferences.groupName}
      />

      {lastSyncNotice && (
        <p className="bg-leaf px-4 py-3 text-center text-base text-white" role="status">
          {lastSyncNotice}
        </p>
      )}

      <section>
        <div className="mx-auto max-w-6xl px-4 pb-2 pt-10 sm:px-6 sm:pt-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                {preferences.groupName}
              </h1>
              <p className="mt-3 max-w-prose text-base text-ink-soft">
                {formatHangoutDate(preferences.date)} in {preferences.location}. ${preferences.maxBudgetPerPerson} a person, {preferences.selectedInterests.length} interests.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex min-h-11 items-center justify-center bg-tomato px-4 text-base font-semibold text-white disabled:opacity-70"
              disabled={isGenerating}
              aria-busy={isGenerating}
            >
              {isGenerating ? "Refreshing the plan…" : "Refresh the plan"}
            </button>
          </div>

          {candidateDates.length > 1 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink-soft">
                Proposed Dates:
              </span>
              <div className="flex flex-wrap gap-2">
                {candidateDates.map((cd) => {
                  const isActive = cd.date === preferences.date;
                  return (
                    <button
                      type="button"
                      key={cd.date}
                      onClick={() =>
                        setPreferences((prev) => ({ ...prev, date: cd.date }))
                      }
                      className={`inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold ${
                        isActive ? "bg-sun text-ink" : "bg-sheet text-ink-soft hover:text-ink"
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5" aria-hidden />
                      <span>{cd.formattedDate}</span>
                      {cd.isBest && (
                        <span className="inline-flex items-center gap-0.5 bg-sun px-1 py-0.5 text-xs font-semibold text-ink">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          Best
                        </span>
                      )}
                      <span className="text-xs opacity-75">
                        ({cd.availableCount}/{cd.totalFriends})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <OverlapRunner hours={runnerHours} summary={overlapSummary} />

          <div className="mt-8 flex gap-6 border-b border-seam" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "planner"}
              onClick={() => setActiveTab("planner")}
              className={`inline-flex min-h-11 items-center gap-2 border-b-2 text-base font-semibold ${
                activeTab === "planner"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-soft"
              }`}
            >
              <Calendar className="h-4 w-4" aria-hidden />
              Plan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "discovery"}
              onClick={() => setActiveTab("discovery")}
              className={`inline-flex min-h-11 items-center gap-2 border-b-2 text-base font-semibold ${
                activeTab === "discovery"
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-soft"
              }`}
            >
              <Compass className="h-4 w-4" aria-hidden />
              Discover Austin ({shortlist.length} saved)
            </button>
          </div>
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {activeTab === "planner" ? (
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
              <div className="bg-sheet lg:col-span-5">
                <div role="tablist" aria-label="Plan setup" className="flex border-b border-seam">
                  {(
                    [
                      ['who', "Who's coming"],
                      ['when', 'When'],
                      ['budget', 'Budget & vibes'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={plannerStep === id}
                      onClick={() => setPlannerStep(id)}
                      className={`min-h-11 flex-1 px-2 text-sm font-semibold sm:text-base ${
                        plannerStep === id
                          ? 'border-b-2 border-ink text-ink'
                          : 'border-b-2 border-transparent text-ink-soft'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="px-5 py-6 sm:px-7 sm:py-8">
                  {plannerStep === 'who' && (
                    <OrganizerAccount
                      plain
                      hangoutId={hangoutId}
                      onNameChange={(name) => {
                        const trimmed = name.trim();
                        if (!trimmed) return;
                        setPreferences((prev) => {
                          const [organizer, ...rest] = prev.friends;
                          if (!organizer || organizer.name === trimmed) return prev;
                          return {
                            ...prev,
                            friends: [{ ...organizer, name: trimmed }, ...rest],
                          };
                        });
                      }}
                    />
                  )}
                  <HangoutForm
                    plain
                    plannerStep={plannerStep}
                    onPlannerStep={setPlannerStep}
                    preferences={preferences}
                    onChange={setPreferences}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    nessie={nessie}
                    squadAdvisory={squadAdvisory}
                    squadAdvisoryLoading={squadAdvisoryLoading}
                    onApplySquadPricePoint={handleApplySquadPricePoint}
                  />
                </div>
              </div>

              <div id="planning-views-section" className="lg:col-span-7">
                <PlanningViews
                  currentPlan={currentPlan}
                  activeView={activeView}
                  onSelectView={setActiveView}
                  preferences={preferences}
                  musePending={musePending}
                  squadAdvisory={squadAdvisory}
                  downvotedIds={downvotedIds}
                  downvotedNames={downvotedNames}
                  onVoteRecorded={({
                    downvotedIds: nextIds,
                    downvotedNames: nextNames,
                  }: {
                    downvotedIds: Set<string>;
                    downvotedNames: Set<string>;
                  }) => {
                    setDownvotedIds(nextIds);
                    setDownvotedNames(nextNames);
                    void fetchLiveMusePlan(activeView, () => false, {
                      downvotedIds: nextIds,
                      downvotedNames: nextNames,
                    });
                  }}
                />
              </div>
            </div>
          ) : (
            <ActivityDiscovery
              shortlist={shortlist}
              onToggleShortlist={handleToggleShortlist}
              onApplyShortlist={handleApplyShortlist}
              onClearShortlist={handleClearShortlist}
              maxBudget={preferences.maxBudgetPerPerson}
              location={preferences.location}
            />
          )}
        </div>
      </main>
    </div>
  );
}
