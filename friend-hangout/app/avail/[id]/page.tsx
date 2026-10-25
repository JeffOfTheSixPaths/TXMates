'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Share2,
  ChevronRight,
  Star,
} from 'lucide-react';
import { ActivityCategory, Friend, HangoutPreferences, FriendCalendarSyncDetails } from '@/types';
import { ACTIVITY_CATEGORIES, INITIAL_FRIENDS } from '@/lib/mockData';
import { availabilityStrong, coverageCount } from '@/lib/availabilityHeat';
import { buildRunnerHours, heatStyle, OverlapRunner } from '@/components/OverlapRunner';
import { CATEGORY_ICONS } from '@/components/categoryIcons';
import { GoogleCalendarImporter } from '@/components/GoogleCalendarImporter';
import { When2MeetGrid } from '@/components/When2MeetGrid';
import { compareCandidateDates, formatFriendlyDate } from '@/lib/planner';

interface AvailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mate?: string }>;
}

function AvailabilityPageContent({ params, searchParams }: AvailPageProps) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);

  const hangoutId = resolvedParams.id || 'txmates-demo';
  const targetMateId = resolvedSearchParams.mate;

  const [hangout, setHangout] = useState<HangoutPreferences | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string>(targetMateId || 'f-2');
  const [friendName, setFriendName] = useState<string>('Sam M.');
  const [activeDateTab, setActiveDateTab] = useState<string>('');
  const [dateSlots, setDateSlots] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [startTime, setStartTime] = useState<string>('14:30');
  const [gridEpoch, setGridEpoch] = useState(0);
  const [endTime, setEndTime] = useState<string>('20:30');
  const [budgetPref, setBudgetPref] = useState<number>(45);
  const [selectedInterests, setSelectedInterests] = useState<ActivityCategory[]>([
    'food',
    'outdoors',
    'gaming',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [calendarSynced, setCalendarSynced] = useState<boolean>(false);
  const [calendarSyncDetails, setCalendarSyncDetails] = useState<FriendCalendarSyncDetails | undefined>(undefined);

  const candidateDatesList = useMemo(() => {
    if (!hangout) return ['2026-10-26'];
    const list =
      hangout.selectedDates && hangout.selectedDates.length > 0
        ? hangout.selectedDates
        : [hangout.date];
    return list.includes(hangout.date) ? list : [hangout.date, ...list];
  }, [hangout]);

  const activeDate = activeDateTab || hangout?.date || candidateDatesList[0] || '2026-10-26';

  const candidateSummaries = useMemo(() => {
    return compareCandidateDates(hangout?.friends || INITIAL_FRIENDS, candidateDatesList);
  }, [hangout?.friends, candidateDatesList]);

  const populateFriendSlots = (targetFriend: Friend, candidateDates: string[], currentActiveDate: string) => {
    const slotsMap: Record<string, { startTime: string; endTime: string }> = {};
    targetFriend.availabilitySlots.forEach((slot) => {
      if (slot.date) {
        slotsMap[slot.date] = { startTime: slot.startTime, endTime: slot.endTime };
      }
    });

    const defaultSlot = targetFriend.availabilitySlots[0] || { startTime: '14:30', endTime: '20:30' };
    candidateDates.forEach((d) => {
      if (!slotsMap[d]) {
        slotsMap[d] = { startTime: defaultSlot.startTime, endTime: defaultSlot.endTime };
      }
    });

    setDateSlots(slotsMap);
    const activeSlot = slotsMap[currentActiveDate] || defaultSlot;
    setStartTime(activeSlot.startTime);
    setEndTime(activeSlot.endTime);
    setGridEpoch((epoch) => epoch + 1);
  };

  // Fetch hangout from SQLite API and initialize friend values
  useEffect(() => {
    async function loadHangout() {
      try {
        const res = await fetch(`/api/hangouts?id=${hangoutId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hangout) {
            setHangout(data.hangout);
            const dates =
              data.hangout.selectedDates && data.hangout.selectedDates.length > 0
                ? data.hangout.selectedDates
                : [data.hangout.date];
            const initialDate = data.hangout.date || dates[0] || '2026-10-26';
            setActiveDateTab(initialDate);

            const targetFriend =
              data.hangout.friends.find((f: Friend) => f.id === (targetMateId || 'f-2')) ||
              data.hangout.friends[0];
            if (targetFriend) {
              setFriendName(targetFriend.name);
              populateFriendSlots(targetFriend, dates, initialDate);
              if (targetFriend.budgetPreference) {
                setBudgetPref(targetFriend.budgetPreference);
              }
              if (targetFriend.calendarSynced) {
                setCalendarSynced(true);
                setCalendarSyncDetails(targetFriend.calendarSyncDetails);
              }
            }
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load hangout from API:', err);
      }

      // Fallback default
      const defaultDates = ['2026-10-26', '2026-10-27', '2026-10-31'];
      setHangout({
        id: hangoutId,
        groupName: 'Group Name Here',
        friendCount: 4,
        location: 'Austin, TX',
        date: '2026-10-26',
        selectedDates: defaultDates,
        timePreference: 'afternoon',
        maxBudgetPerPerson: 50,
        selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
        friends: INITIAL_FRIENDS,
      });
      setActiveDateTab('2026-10-26');
      const targetFriend =
        INITIAL_FRIENDS.find((f: Friend) => f.id === (targetMateId || 'f-2')) ||
        INITIAL_FRIENDS[0];
      if (targetFriend) {
        setFriendName(targetFriend.name);
        populateFriendSlots(targetFriend, defaultDates, '2026-10-26');
      }
    }

    loadHangout();
  }, [hangoutId, targetMateId]);

  const handleSelectFriend = (f: Friend) => {
    setSelectedFriendId(f.id);
    setFriendName(f.name);
    populateFriendSlots(f, candidateDatesList, activeDate);
    if (f.budgetPreference) {
      setBudgetPref(f.budgetPreference);
    }
    if (f.topInterests && f.topInterests.length > 0) {
      setSelectedInterests(f.topInterests);
    }
    setCalendarSynced(Boolean(f.calendarSynced));
    setCalendarSyncDetails(f.calendarSyncDetails);
  };

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setDateSlots((prev) => ({
      ...prev,
      [activeDate]: { startTime: newStart, endTime: prev[activeDate]?.endTime || endTime },
    }));
  };

  const handleEndTimeChange = (newEnd: string) => {
    setEndTime(newEnd);
    setDateSlots((prev) => ({
      ...prev,
      [activeDate]: { startTime: prev[activeDate]?.startTime || startTime, endTime: newEnd },
    }));
  };

  const applyPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
    setDateSlots((prev) => ({
      ...prev,
      [activeDate]: { startTime: start, endTime: end },
    }));
    setGridEpoch((epoch) => epoch + 1);
  };

  const handleSwitchDateTab = (newDate: string) => {
    const currentMap = {
      ...dateSlots,
      [activeDate]: { startTime, endTime },
    };
    setDateSlots(currentMap);
    setActiveDateTab(newDate);

    const targetSlot = currentMap[newDate] || { startTime, endTime };
    setStartTime(targetSlot.startTime);
    setEndTime(targetSlot.endTime);
    setGridEpoch((epoch) => epoch + 1);
  };

  const handleApplyToAllDates = () => {
    const updated: Record<string, { startTime: string; endTime: string }> = {};
    candidateDatesList.forEach((d) => {
      updated[d] = { startTime, endTime };
    });
    setDateSlots(updated);
  };

  const runnerHours = useMemo(
    () =>
      buildRunnerHours(
        hangout?.friends || INITIAL_FRIENDS,
        {
          friendId: selectedFriendId,
          startTime,
          endTime,
          date: activeDate,
        },
        activeDate
      ),
    [hangout, selectedFriendId, startTime, endTime, activeDate]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const mergedDateSlots = {
      ...dateSlots,
      [activeDate]: { startTime, endTime },
    };

    const slotsToSubmit = candidateDatesList.map((d) => ({
      date: d,
      startTime: mergedDateSlots[d]?.startTime || startTime,
      endTime: mergedDateSlots[d]?.endTime || endTime,
    }));

    try {
      await fetch(`/api/hangouts/${hangoutId}/avail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendId: selectedFriendId,
          friendName: friendName || 'Friend',
          startTime,
          endTime,
          date: activeDate,
          slots: slotsToSubmit,
          budgetPreference: budgetPref,
          topInterests: selectedInterests,
          calendarSynced,
          calendarSyncDetails,
        }),
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting availability:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const toggleInterest = (catId: ActivityCategory) => {
    setSelectedInterests((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  return (
    <div className="min-h-screen bg-pine px-4 py-8 text-ink sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={hangoutId === "txmates-demo" ? "/" : `/h/${hangoutId}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to the plan
          </Link>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex min-h-11 items-center gap-1.5 bg-sun px-3 text-base font-semibold text-ink"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            {copiedLink ? "Link copied" : "Copy When2Meet link"}
          </button>
        </div>

        <header className="bg-cola px-5 py-7 text-paper sm:px-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {hangout?.groupName || "Group Name Here"}
          </h1>
          <p className="mt-3 max-w-prose text-base text-paper-dim">
            Mark the hours you are free.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden />
              {hangout?.location || "Austin, TX"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden />
              {candidateDatesList.length > 1
                ? `${candidateDatesList.length} dates proposed`
                : formatFriendlyDate(activeDate)}
            </span>
            <span>{hangout?.friends.length || 4} mates</span>
            <span className="tabular-nums">~${hangout?.maxBudgetPerPerson || 50} a person</span>
          </p>
        </header>

        <div className="bg-sheet px-5 py-8 sm:px-8">
          {submitted ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-leaf" aria-hidden />
              <h2 className="mt-3 text-2xl font-semibold text-ink">Hours saved</h2>
              <p className="mx-auto mt-2 max-w-prose text-base text-ink-soft">
                Thanks {friendName}. Your availability for {candidateDatesList.length > 1 ? `${candidateDatesList.length} proposed dates` : formatFriendlyDate(activeDate)} is stored for {hangout?.groupName || "the group"}.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center gap-1.5 bg-tomato px-4 text-base font-semibold text-white"
                >
                  See the group plan
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="inline-flex min-h-11 items-center border border-seam px-4 text-base font-semibold text-ink"
                >
                  Edit my times
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10 max-sm:pb-24">
              <fieldset>
                <legend className="text-xl font-semibold text-ink">Who are you?</legend>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {hangout?.friends.map((f) => {
                    const isSelected = f.id === selectedFriendId;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => handleSelectFriend(f)}
                        className={`flex min-h-11 items-center gap-2 px-2 text-left ${
                          isSelected ? "bg-sun text-ink" : "bg-pine text-ink"
                        }`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center text-sm font-semibold ${f.avatarColor}`}>
                          {f.name.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <span className="truncate block text-sm font-semibold">{f.name}</span>
                          {f.calendarSynced && (
                            <span className="block text-xs font-semibold text-leaf">Calendar</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 block text-base text-ink">
                  Display name
                  <input
                    type="text"
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1 w-full border border-seam bg-pine px-3 py-2.5 text-base text-ink"
                  />
                </label>
              </fieldset>

              <fieldset className="pt-2">
                <legend className="text-xl font-semibold text-ink">
                  When are you free? {formatFriendlyDate(activeDate)}
                </legend>
                <p className="mt-1 text-sm text-ink-soft">
                  Pick a preset or paint the hours. The green cells are what you submit.
                </p>

                {candidateDatesList.length > 1 && (
                  <div className="mt-4 bg-pine p-3">
                    <p className="text-sm font-semibold text-ink">
                      Dates ({candidateDatesList.length})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {candidateSummaries.map((cd) => {
                        const isTabActive = cd.date === activeDate;
                        const hasCustomSlot = Boolean(dateSlots[cd.date]);
                        return (
                          <button
                            type="button"
                            key={cd.date}
                            onClick={() => handleSwitchDateTab(cd.date)}
                            className={`inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold ${
                              isTabActive ? "bg-sun text-ink" : "bg-sheet text-ink"
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5" aria-hidden />
                            <span>{cd.formattedDate}</span>
                            {cd.isBest && (
                              <span className="inline-flex items-center gap-0.5 bg-ink px-1 py-0.5 text-xs font-semibold text-paper">
                                <Star className="h-2.5 w-2.5 fill-current text-sun" />
                                Best
                              </span>
                            )}
                            {hasCustomSlot && (
                              <span className="text-xs font-semibold text-leaf">Saved</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-seam/50 pt-2 text-xs">
                      <span className="text-ink-soft">
                        Editing hours for: <strong className="text-ink">{formatFriendlyDate(activeDate)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyToAllDates}
                        className="font-semibold text-leaf underline hover:text-ink"
                      >
                        Apply {startTime}–{endTime} to all {candidateDatesList.length} dates
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <GoogleCalendarImporter
                    friend={
                      hangout?.friends.find((f) => f.id === selectedFriendId) || {
                        id: selectedFriendId,
                        name: friendName,
                        avatarColor: 'bg-teal-600 text-white',
                        availabilitySlots: [{ id: 'slot-curr', startTime, endTime, date: activeDate }],
                        topInterests: selectedInterests,
                        calendarSynced,
                        calendarSyncDetails,
                      }
                    }
                    date={activeDate}
                    timePreference={hangout?.timePreference || 'afternoon'}
                    onSyncComplete={(newStart, newEnd, syncDetails) => {
                      handleStartTimeChange(newStart);
                      handleEndTimeChange(newEnd);
                      setCalendarSynced(true);
                      setCalendarSyncDetails(syncDetails);
                      setGridEpoch((epoch) => epoch + 1);
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["12:00", "17:00", "Afternoon", "12–5"],
                    ["14:30", "20:30", "Late afternoon", "2:30–8:30"],
                    ["17:00", "22:00", "Evening", "5–10"],
                    ["11:00", "22:00", "All day", "11–10"],
                  ].map(([start, end, label, sub]) => {
                    const friends = hangout?.friends || INITIAL_FRIENDS;
                    const coverage = coverageCount(
                      friends,
                      start,
                      end,
                      {
                        friendId: selectedFriendId,
                        startTime,
                        endTime,
                      },
                      activeDate
                    );
                    const selected = startTime === start && endTime === end;
                    return (
                      <button
                        type="button"
                        key={label}
                        onClick={() => applyPreset(start, end)}
                        aria-pressed={selected}
                        data-strong={availabilityStrong(coverage.count, coverage.total) ? "true" : "false"}
                        style={heatStyle(coverage.count, coverage.total)}
                        className={`avail-heat border px-2 py-3 text-center ${selected ? "outline outline-2 outline-offset-2 outline-ink" : ""}`}
                      >
                        <span className="block text-base font-semibold">{label}</span>
                        <span className="text-sm">{sub}</span>
                        <span className="mt-1 block text-sm font-semibold">
                          {coverage.word} · {coverage.count}/{coverage.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="pt-2">
                <When2MeetGrid
                  dates={candidateDatesList}
                  friends={hangout?.friends || INITIAL_FRIENDS}
                  currentUserId={selectedFriendId}
                  userSlots={[
                    {
                      id: `slot-${selectedFriendId}`,
                      startTime,
                      endTime,
                      date: activeDate,
                    },
                  ]}
                  editable={true}
                  onSlotsChange={(newSlots) => {
                    const currentActiveSlot = newSlots.find((s) => s.date === activeDate);
                    if (currentActiveSlot) {
                      setStartTime(currentActiveSlot.startTime);
                      setEndTime(currentActiveSlot.endTime);
                    }
                  }}
                  title="When2Meet"
                  resetToken={gridEpoch}
                />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-ink">Group overlap</h2>
                <OverlapRunner
                  hours={runnerHours}
                  summary={`${formatFriendlyDate(activeDate)}. Deeper green means more mates are free.`}
                />
              </div>

              <details>
                <summary className="cursor-pointer text-xl font-semibold text-ink">Budget and interests</summary>
                <p className="mt-3 text-base text-ink-soft">
                  The organizer already set a cap. Change yours only if you want to.
                </p>
                <label className="mt-4 block text-base text-ink">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">Your max comfort</span>
                    <span className="tabular-nums font-semibold">${budgetPref} a person</span>
                  </span>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="5"
                    value={budgetPref}
                    onChange={(e) => setBudgetPref(Number(e.target.value))}
                    className="mt-3 w-full"
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ACTIVITY_CATEGORIES.map((cat) => {
                    const isSelected = selectedInterests.includes(cat.id as ActivityCategory);
                    const Icon = CATEGORY_ICONS[cat.id as ActivityCategory];
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => toggleInterest(cat.id as ActivityCategory)}
                        className={`inline-flex min-h-11 items-center gap-2 px-3 text-base font-semibold ${
                          isSelected ? "bg-sun text-ink" : "bg-pine text-ink"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </details>

              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-seam bg-sheet px-4 py-3 max-sm:!mt-0 sm:static sm:inset-auto sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-11 w-full items-center justify-center gap-2 bg-tomato px-6 text-base font-semibold text-white disabled:bg-seam disabled:text-ink-soft"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {isSubmitting ? "Saving hours…" : `Submit ${startTime} to ${endTime}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


export default function AvailabilityPage(props: AvailPageProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-pine p-8 text-base font-semibold text-ink-soft">
          Loading When2Meet availability...
        </div>
      }
    >
      <AvailabilityPageContent {...props} />
    </React.Suspense>
  );
}
