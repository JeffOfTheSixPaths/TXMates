'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, Compass } from 'lucide-react';
import {
  Activity,
  HangoutPreferences,
  PlanningViewType,
  Friend,
  SquadPricePointResponse,
} from '@/types';
import { INITIAL_FRIENDS } from '@/lib/mockData';
import { generatePlan, buildItinerary, calculateAvailabilityOverlap } from '@/lib/planner';
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
  groupName: 'Group Name Here',
  friendCount: 4,
  location: 'Austin, TX',
  date: '2026-10-26',
  timePreference: 'afternoon',
  maxBudgetPerPerson: 50,
  selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
  friends: INITIAL_FRIENDS,
};

export default function Home() {
  const [preferences, setPreferences] = useState<HangoutPreferences>(DEFAULT_PREFERENCES);
  const [activeView, setActiveView] = useState<PlanningViewType>('overall');
  const [isGenerating, setIsGenerating] = useState(false);
  const [musePending, setMusePending] = useState(true);
  const [shortlist, setShortlist] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<'planner' | 'discovery'>('planner');
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);
  const [nessie, setNessie] = useState<NessieBudgetResponse | null>(null);
  const [nessieLoading, setNessieLoading] = useState(true);
  const [nessieCustomerId, setNessieCustomerId] = useState('');
  const [nessieAccountId, setNessieAccountId] = useState('');
  const [squadAdvisory, setSquadAdvisory] = useState<SquadPricePointResponse | null>(null);
  const [squadAdvisoryLoading, setSquadAdvisoryLoading] = useState(true);
  const [scheduleRevision, setScheduleRevision] = useState(0);
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
        body: JSON.stringify(preferences),
      }).catch((err) => console.error('Error auto-saving hangout to SQL:', err));
    }, 600);

    return () => clearTimeout(timer);
  }, [preferences]);

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
        const res = await fetch(`/api/hangouts?id=${preferences.id || 'txmates-demo'}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hangout && data.hangout.friends) {
            // Check if any friend's time or status changed
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
  }, [preferences.id, preferences.friends]);

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

  // Initial live Meta Muse synthesis on mount. The fetch is deferred so this
  // effect does not set state while React is still committing the first render.
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
      const friendCount = preferences.friends.length || preferences.friendCount || 1;
      const museMoney = [live.budgetExplanation, ...(live.budgetTips || [])].filter(Boolean).join(' ');
      return {
        ...base,
        activities,
        itinerary: activities.length ? buildItinerary(activities, preferences) : base.itinerary,
        totalCostPerPerson,
        totalGroupCost: totalCostPerPerson * friendCount,
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

  // Handle plan regeneration with live Meta Muse Spark synthesis
  const handleGenerate = () => {
    setIsGenerating(true);
    setMusePending(true);
    setLiveAiData({ overall: null, cheapest: null, interests: null });
    fetchLiveMusePlan(activeView).finally(() => {
      setIsGenerating(false);
      // Smooth scroll to planning views
      const el = document.getElementById('planning-views-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  // Toggle activity in shortlist
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

  // Apply shortlisted activities to custom plan
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
    setPreferences(DEFAULT_PREFERENCES);
    setActiveView('overall');
    setShortlist([]);
    setScheduleRevision((revision) => revision + 1);
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

  const overlap = calculateAvailabilityOverlap(preferences.friends);
  const runnerHours = useMemo(
    () => buildRunnerHours(preferences.friends),
    [preferences.friends]
  );
  const overlapSummary = overlap.allFriendsAvailable
    ? `All ${preferences.friends.length} mates free, ${overlap.commonStart} to ${overlap.commonEnd}.`
    : `${overlap.availableFriendCount} of ${preferences.friends.length} overlap, ${overlap.commonStart} to ${overlap.commonEnd}.`;

  return (
    <div className="flex min-h-screen flex-col bg-pine text-ink">
      {/* Top Header */}
      <Header
        friendCount={preferences.friends.length}
        location={preferences.location}
        hasPlan={true}
        onReset={handleReset}
      />

      {lastSyncNotice && (
        <p className="bg-leaf px-4 py-3 text-center text-base text-white" role="status">
          {lastSyncNotice}
        </p>
      )}

      <section className="border-b border-seam">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                {preferences.groupName}
              </h1>
              <p className="mt-2 max-w-prose text-base text-ink-soft">
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

          <OverlapRunner hours={runnerHours} summary={overlapSummary} />

          <div className="mt-6 flex gap-6 border-b border-seam" role="tablist">
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
              Discover
              {shortlist.length > 0 && (
                <span className="bg-sun px-1.5 text-sm font-semibold text-ink tabular-nums">
                  {shortlist.length} saved
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {activeTab === "planner" ? (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <OrganizerAccount
                  hangoutId={preferences.id || 'txmates-demo'}
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
                <div className="mt-6">
                <HangoutForm
                  preferences={preferences}
                  onChange={(next) => {
                    if (next.maxBudgetPerPerson !== preferences.maxBudgetPerPerson) {
                      budgetTouched.current = true;
                    }
                    if (next.friends.length !== preferences.friends.length) {
                      setNessieLoading(true);
                    }
                    setPreferences(next);
                  }}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  nessie={nessie}
                  nessieLoading={nessieLoading}
                  onSelectCustomer={(customerId) => {
                    budgetTouched.current = false;
                    setNessieLoading(true);
                    setNessieAccountId('');
                    setNessieCustomerId(customerId);
                  }}
                  onSelectAccount={(accountId) => {
                    budgetTouched.current = false;
                    setNessieLoading(true);
                    setNessieAccountId(accountId);
                  }}
                  squadAdvisory={squadAdvisory}
                  squadAdvisoryLoading={squadAdvisoryLoading}
                  onApplySquadPricePoint={handleApplySquadPricePoint}
                />
                </div>
              </div>
            </div>
            <div id="planning-views-section" className="lg:col-span-7">
              <PlanningViews
                currentPlan={currentPlan}
                activeView={activeView}
                onSelectView={(newView) => {
                  setActiveView(newView);
                  if (!liveAiData[newView]) {
                    setMusePending(true);
                    void fetchLiveMusePlan(newView);
                  }
                }}
                preferences={preferences}
                musePending={musePending}
                scheduleRevision={scheduleRevision}
                squadAdvisory={squadAdvisory}
                downvotedIds={downvotedIds}
                downvotedNames={downvotedNames}
                onVoteRecorded={(data) => {
                  setDownvotedIds(data.downvotedIds);
                  setDownvotedNames(data.downvotedNames);
                }}
              />
            </div>
          </div>
        ) : (
          <ActivityDiscovery
            shortlist={shortlist}
            onToggleShortlist={handleToggleShortlist}
            onClearShortlist={handleClearShortlist}
            onApplyShortlist={handleApplyShortlist}
            maxBudget={preferences.maxBudgetPerPerson}
            location={preferences.location}
            onLocationChange={(loc) => setPreferences((prev) => ({ ...prev, location: loc }))}
          />
        )}
      </main>

      <footer className="mt-16 border-t border-seam px-4 py-8 text-sm text-ink-soft sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-ink">TXMates</p>
          <p>Muse copy, Nessie budget, and OpenSerp prices stay labeled when they are simulated.</p>
        </div>
      </footer>
    </div>
  );
}
