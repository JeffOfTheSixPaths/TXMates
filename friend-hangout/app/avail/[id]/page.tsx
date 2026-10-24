'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  DollarSign,
  Users,
  CheckCircle2,
  ArrowLeft,
  Share2,
  ChevronRight,
} from 'lucide-react';
import { ActivityCategory, Friend, HangoutPreferences } from '@/types';
import { ACTIVITY_CATEGORIES, INITIAL_FRIENDS } from '@/lib/mockData';

interface AvailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mate?: string }>;
}

const HOURS = [
  { h24: 11, label: '11 AM' },
  { h24: 12, label: '12 PM' },
  { h24: 13, label: '1 PM' },
  { h24: 14, label: '2 PM' },
  { h24: 15, label: '3 PM' },
  { h24: 16, label: '4 PM' },
  { h24: 17, label: '5 PM' },
  { h24: 18, label: '6 PM' },
  { h24: 19, label: '7 PM' },
  { h24: 20, label: '8 PM' },
  { h24: 21, label: '9 PM' },
  { h24: 22, label: '10 PM' },
];

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

  // Calculate heatmap availability for each hour from existing friends
  const hourlyAvailability = useMemo(() => {
    const list = hangout?.friends || INITIAL_FRIENDS;
    return HOURS.map(({ h24, label }) => {
      const availableFriends: Friend[] = [];

      list.forEach((fr) => {
        // If it's the current user, evaluate their current picked times
        if (fr.id === selectedFriendId) {
          const [sH] = startTime.split(':').map(Number);
          const [eH] = endTime.split(':').map(Number);
          if (h24 >= sH && h24 < eH) {
            availableFriends.push(fr);
          }
        } else {
          const slot = fr.availabilitySlots[0];
          if (slot) {
            const [sH] = slot.startTime.split(':').map(Number);
            const [eH] = slot.endTime.split(':').map(Number);
            if (h24 >= sH && h24 < eH) {
              availableFriends.push(fr);
            }
          }
        }
      });

      return {
        h24,
        label,
        count: availableFriends.length,
        total: list.length,
        friends: availableFriends,
      };
    });
  }, [hangout, selectedFriendId, startTime, endTime]);

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
    <div className="min-h-screen bg-[#FAF7F2] text-[#0F172A] py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Navigation Bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E2D8] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Hangout Dashboard
          </Link>

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 shadow-2xs hover:bg-teal-100 transition"
          >
            <Share2 className="h-3.5 w-3.5" />
            {copiedLink ? 'Link Copied!' : 'Copy When2Meet Link'}
          </button>
        </div>

        {/* Hangout Summary Card */}
        <div className="overflow-hidden rounded-2xl border border-[#E8E2D8] bg-white shadow-sm">
          <div className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 p-6 text-white sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-sm font-bold text-amber-300 ring-1 ring-amber-300/30">
                  ★
                </span>
                <span className="rounded-full bg-teal-400/20 px-2.5 py-0.5 text-xs font-semibold text-teal-200 backdrop-blur-xs">
                  TXMates Availability Sync
                </span>
              </div>
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-mono font-medium text-slate-200">
                When2Meet Mode
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              {hangout?.groupName || 'The goobers'} Hangout
            </h1>

            <p className="mt-1 text-xs text-teal-100 sm:text-sm">
              Your friend is organizing an Austin meetup! Mark the hours you are free so the group can lock in an itinerary.
            </p>

            {/* Quick Metadata */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-teal-100/90">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-teal-400" />
                {hangout?.location || 'Austin, TX'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-teal-400" />
                {hangout?.date || '2026-10-26'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-teal-400" />
                {hangout?.friends.length || 4} Mates Planning
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-teal-400" />
                ~${hangout?.maxBudgetPerPerson || 50}/person Target
              </span>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 sm:p-7">
            {submitted ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-lg font-bold text-emerald-950">
                  Availability Saved to TXMates!
                </h2>
                <p className="mt-1 text-xs text-emerald-800">
                  Thanks {friendName}! Your free time ({startTime} to {endTime}) has been saved in the SQL database and synced with {hangout?.groupName}.
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-900 transition"
                  >
                    View Group Hangout Dashboard
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Edit My Times
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Who are you? */}
                <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/50 p-4">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Step 1: Select or Confirm Your Name
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {hangout?.friends.map((f) => {
                      const isSelected = f.id === selectedFriendId;
                      return (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => handleSelectFriend(f)}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                            isSelected
                              ? 'border-teal-600 bg-teal-50 text-teal-950 ring-2 ring-teal-500/20 shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${f.avatarColor}`}
                          >
                            {f.name.charAt(0)}
                          </div>
                          <span className="truncate text-xs font-bold">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3">
                    <span className="text-[11px] text-slate-500 font-medium">Display Name:</span>
                    <input
                      type="text"
                      value={friendName}
                      onChange={(e) => setFriendName(e.target.value)}
                      placeholder="Your name"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-teal-600"
                    />
                  </div>
                </div>

                {/* Step 2: Time Slots / Presets */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Step 2: When Are You Free? ({hangout?.date || 'Selected Day'})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Pick your available time window or tap a quick preset.
                      </p>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      type="button"
                      onClick={() => applyPreset('12:00', '17:00')}
                      className="rounded-lg border border-slate-200 bg-[#FAF7F2] p-2 text-center text-xs font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900 transition"
                    >
                      <div className="font-bold">Afternoon</div>
                      <div className="text-[10px] text-slate-500">12 PM – 5 PM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('14:30', '20:30')}
                      className="rounded-lg border border-slate-200 bg-[#FAF7F2] p-2 text-center text-xs font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900 transition"
                    >
                      <div className="font-bold">Late Afternoons</div>
                      <div className="text-[10px] text-slate-500">2:30 PM – 8:30 PM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('17:00', '22:00')}
                      className="rounded-lg border border-slate-200 bg-[#FAF7F2] p-2 text-center text-xs font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900 transition"
                    >
                      <div className="font-bold">Evening & Night</div>
                      <div className="text-[10px] text-slate-500">5 PM – 10 PM</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('11:00', '22:00')}
                      className="rounded-lg border border-slate-200 bg-[#FAF7F2] p-2 text-center text-xs font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900 transition"
                    >
                      <div className="font-bold">All Day Free</div>
                      <div className="text-[10px] text-slate-500">11 AM – 10 PM</div>
                    </button>
                  </div>

                  {/* Explicit Time Inputs with NO OVERFLOW */}
                  <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-teal-950 uppercase">
                          Free Starting At:
                        </label>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-2xs focus:border-teal-600 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-teal-950 uppercase">
                          Free Until:
                        </label>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-2xs focus:border-teal-600 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3: When2Meet Group Heatmap */}
                <div className="rounded-xl border border-[#E8E2D8] bg-[#FAF7F2]/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Group Heatmap (When2Meet Overlap)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Darker green indicates more friends available during that hour.
                      </p>
                    </div>

                    <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      Live Overlap
                    </span>
                  </div>

                  {/* Heatmap Blocks */}
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
                    {hourlyAvailability.map(({ label, count, total }) => {
                      const ratio = total > 0 ? count / total : 0;
                      let bgClass = 'bg-slate-100 text-slate-400 border-slate-200';
                      if (ratio === 1) bgClass = 'bg-emerald-600 text-white border-emerald-700 font-bold';
                      else if (ratio >= 0.75) bgClass = 'bg-emerald-500 text-white border-emerald-600 font-bold';
                      else if (ratio >= 0.5) bgClass = 'bg-emerald-200 text-emerald-950 border-emerald-300';
                      else if (ratio > 0) bgClass = 'bg-emerald-100 text-emerald-900 border-emerald-200';

                      return (
                        <div
                          key={label}
                          title={`${count} of ${total} friends available at ${label}`}
                          className={`flex flex-col items-center justify-center rounded-lg border py-2 px-1 text-center text-xs transition ${bgClass}`}
                        >
                          <span className="text-[10px] opacity-80">{label}</span>
                          <span className="text-xs font-black">
                            {count}/{total}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2.5 flex items-center justify-end gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-slate-100 border border-slate-200" />
                      0 free
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200 border border-emerald-300" />
                      Some free
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600 border border-emerald-700" />
                      All free!
                    </span>
                  </div>
                </div>

                {/* Step 4: Budget & Interest Preferences */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-800">
                    Step 4: Your Budget & Activity Preferences
                  </h3>
                  <p className="mb-3 text-[11px] text-slate-500">
                    Helps Meta Muse Spark and Nessie tailor the final Austin itinerary to you.
                  </p>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Your Max Budget Comfort:
                      </span>
                      <span className="font-black text-teal-900">${budgetPref} / person</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="120"
                      step="5"
                      value={budgetPref}
                      onChange={(e) => setBudgetPref(Number(e.target.value))}
                      className="mt-2 h-2 w-full accent-teal-600"
                    />
                  </div>

                  <div>
                    <span className="mb-2 block text-[11px] font-bold uppercase text-slate-600">
                      Top Austin Vibes You Like:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ACTIVITY_CATEGORIES.map((cat) => {
                        const isSelected = selectedInterests.includes(
                          cat.id as ActivityCategory
                        );
                        return (
                          <button
                            type="button"
                            key={cat.id}
                            onClick={() => toggleInterest(cat.id as ActivityCategory)}
                            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                              isSelected
                                ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span>{cat.emoji}</span>
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 py-3.5 px-6 text-sm font-bold text-white shadow-md hover:bg-teal-900 hover:shadow-lg transition active:scale-[0.99] disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    <span>
                      {isSubmitting
                        ? 'Saving Availability...'
                        : `Submit My Times (${startTime} to ${endTime})`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
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
