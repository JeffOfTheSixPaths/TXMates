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
} from 'lucide-react';
import { ActivityCategory, Friend, HangoutPreferences } from '@/types';
import { ACTIVITY_CATEGORIES, INITIAL_FRIENDS } from '@/lib/mockData';
import { availabilityStrong, coverageCount } from '@/lib/availabilityHeat';
import { buildRunnerHours, heatStyle, OverlapRunner } from '@/components/OverlapRunner';
import { CATEGORY_ICONS } from '@/components/categoryIcons';

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
  const [startTime, setStartTime] = useState<string>('14:30');
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

  // Fetch hangout from SQLite API and initialize friend values
  useEffect(() => {
    async function loadHangout() {
      try {
        const res = await fetch(`/api/hangouts?id=${hangoutId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hangout) {
            setHangout(data.hangout);
            const targetFriend =
              data.hangout.friends.find((f: Friend) => f.id === (targetMateId || 'f-2')) ||
              data.hangout.friends[0];
            if (targetFriend) {
              setFriendName(targetFriend.name);
              if (targetFriend.availabilitySlots.length > 0) {
                setStartTime(targetFriend.availabilitySlots[0].startTime);
                setEndTime(targetFriend.availabilitySlots[0].endTime);
              }
              if (targetFriend.budgetPreference) {
                setBudgetPref(targetFriend.budgetPreference);
              }
            }
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load hangout from API:', err);
      }

      // Fallback default
      setHangout({
        id: hangoutId,
        groupName: 'The goobers',
        friendCount: 4,
        location: 'Austin, TX',
        date: '2026-10-26',
        timePreference: 'afternoon',
        maxBudgetPerPerson: 50,
        selectedInterests: ['food', 'music', 'outdoors', 'gaming'],
        friends: INITIAL_FRIENDS,
      });
    }

    loadHangout();
  }, [hangoutId, targetMateId]);

  const handleSelectFriend = (f: Friend) => {
    setSelectedFriendId(f.id);
    setFriendName(f.name);
    if (f.availabilitySlots.length > 0) {
      setStartTime(f.availabilitySlots[0].startTime);
      setEndTime(f.availabilitySlots[0].endTime);
    }
    if (f.budgetPreference) {
      setBudgetPref(f.budgetPreference);
    }
    if (f.topInterests && f.topInterests.length > 0) {
      setSelectedInterests(f.topInterests);
    }
  };

  const runnerHours = useMemo(
    () =>
      buildRunnerHours(hangout?.friends || INITIAL_FRIENDS, {
        friendId: selectedFriendId,
        startTime,
        endTime,
      }),
    [hangout, selectedFriendId, startTime, endTime]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await fetch(`/api/hangouts/${hangoutId}/avail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendId: selectedFriendId,
          friendName: friendName || 'Friend',
          startTime,
          endTime,
          budgetPreference: budgetPref,
          topInterests: selectedInterests,
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

  const applyPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  };

  const toggleInterest = (catId: ActivityCategory) => {
    setSelectedInterests((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  return (
    <div className="min-h-screen bg-pine px-4 py-8 text-ink sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 border border-seam bg-sheet px-3 text-base font-semibold text-ink"
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

        <header className="border border-seam bg-cola px-5 py-6 text-paper sm:px-7">
          <p className="text-sm text-paper-dim">TXMates availability</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {hangout?.groupName || "The goobers"}
          </h1>
          <p className="mt-2 max-w-prose text-base text-paper-dim">
            Mark the hours you are free. The same scale the organizer sees fills in as you change the window.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden />
              {hangout?.location || "Austin, TX"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden />
              {hangout?.date || "2026-10-26"}
            </span>
            <span>{hangout?.friends.length || 4} mates</span>
            <span className="tabular-nums">~${hangout?.maxBudgetPerPerson || 50} a person</span>
          </p>
        </header>

        <div className="border border-t-0 border-seam bg-sheet px-5 py-6 sm:px-7">
          {submitted ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-leaf" aria-hidden />
              <h2 className="mt-3 text-2xl font-semibold text-ink">Hours saved</h2>
              <p className="mx-auto mt-2 max-w-prose text-base text-ink-soft">
                Thanks {friendName}. {startTime} to {endTime} is stored for {hangout?.groupName || "the group"}.
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
            <form onSubmit={handleSubmit} className="space-y-8">
              <fieldset>
                <legend className="text-lg font-semibold text-ink">Who are you?</legend>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {hangout?.friends.map((f) => {
                    const isSelected = f.id === selectedFriendId;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => handleSelectFriend(f)}
                        className={`flex min-h-11 items-center gap-2 border px-2 text-left ${
                          isSelected ? "border-ink bg-sun text-ink" : "border-seam bg-pine text-ink"
                        }`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center text-sm font-semibold ${f.avatarColor}`}>
                          {f.name.charAt(0)}
                        </span>
                        <span className="truncate text-sm font-semibold">{f.name}</span>
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

              <fieldset className="border-t border-seam pt-6">
                <legend className="text-lg font-semibold text-ink">
                  When are you free? {hangout?.date || "Selected day"}
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["12:00", "17:00", "Afternoon", "12–5"],
                    ["14:30", "20:30", "Late afternoon", "2:30–8:30"],
                    ["17:00", "22:00", "Evening", "5–10"],
                    ["11:00", "22:00", "All day", "11–10"],
                  ].map(([start, end, label, sub]) => {
                    const friends = hangout?.friends || INITIAL_FRIENDS;
                    const coverage = coverageCount(friends, start, end, {
                      friendId: selectedFriendId,
                      startTime,
                      endTime,
                    });
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
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-base font-semibold text-ink">
                    Free starting at
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="mt-1 w-full border border-seam bg-pine px-3 py-2.5 text-base font-semibold text-ink"
                    />
                  </label>
                  <label className="text-base font-semibold text-ink">
                    Free until
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="mt-1 w-full border border-seam bg-pine px-3 py-2.5 text-base font-semibold text-ink"
                    />
                  </label>
                </div>
              </fieldset>

              <div className="border-t border-seam pt-6">
                <h2 className="text-lg font-semibold text-ink">Group overlap</h2>
                <OverlapRunner
                  hours={runnerHours}
                  summary="Full green means every mate, including the hours you just picked, is free. A lighter green means only some are. An empty cell means nobody is."
                />
              </div>

              <fieldset className="border-t border-seam pt-6">
                <legend className="text-lg font-semibold text-ink">Budget and interests</legend>
                <p className="mt-1 text-base text-ink-soft">
                  Used to shape the Austin itinerary. This slider is your comfort level, not a second bank read.
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
                        className={`inline-flex min-h-11 items-center gap-2 border px-3 text-base font-semibold ${
                          isSelected ? "border-ink bg-sun text-ink" : "border-seam bg-pine text-ink"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex min-h-11 w-full items-center justify-center gap-2 bg-tomato px-6 text-base font-semibold text-white disabled:bg-seam disabled:text-ink-soft"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {isSubmitting ? "Saving hours…" : `Submit ${startTime} to ${endTime}`}
              </button>
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
        <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] p-8 text-sm font-semibold text-slate-500">
          Loading When2Meet availability...
        </div>
      }
    >
      <AvailabilityPageContent {...props} />
    </React.Suspense>
  );
}
