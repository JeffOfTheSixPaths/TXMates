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
  UserPlus,
  UserCheck,
  Sparkles,
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

const AVATAR_COLORS = [
  { id: 'teal', class: 'bg-teal-600 text-white', ring: 'ring-teal-600', dot: 'bg-teal-600' },
  { id: 'sky', class: 'bg-sky-600 text-white', ring: 'ring-sky-600', dot: 'bg-sky-600' },
  { id: 'amber', class: 'bg-amber-600 text-white', ring: 'ring-amber-600', dot: 'bg-amber-600' },
  { id: 'emerald', class: 'bg-emerald-600 text-white', ring: 'ring-emerald-600', dot: 'bg-emerald-600' },
  { id: 'purple', class: 'bg-purple-600 text-white', ring: 'ring-purple-600', dot: 'bg-purple-600' },
  { id: 'rose', class: 'bg-rose-600 text-white', ring: 'ring-rose-600', dot: 'bg-rose-600' },
  { id: 'indigo', class: 'bg-indigo-600 text-white', ring: 'ring-indigo-600', dot: 'bg-indigo-600' },
  { id: 'orange', class: 'bg-orange-600 text-white', ring: 'ring-orange-600', dot: 'bg-orange-600' },
];

function AvailabilityPageContent({ params, searchParams }: AvailPageProps) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);

  const hangoutId = resolvedParams.id || 'txmates-demo';
  const targetMateId = resolvedSearchParams.mate;

  const [hangout, setHangout] = useState<HangoutPreferences | null>(null);
  
  // Identity: anyone with the link can add their name as a new friend or pick an existing profile
  const [identityMode, setIdentityMode] = useState<'new' | 'existing'>(
    targetMateId ? 'existing' : 'new'
  );
  const [newFriendName, setNewFriendName] = useState<string>('');
  const [avatarColor, setAvatarColor] = useState<string>('bg-teal-600 text-white');
  const [selectedFriendId, setSelectedFriendId] = useState<string>(targetMateId || '');
  const [existingFriendName, setExistingFriendName] = useState<string>('');

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
  const [submittedName, setSubmittedName] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch hangout from SQLite/JSON API and initialize friend values
  useEffect(() => {
    async function loadHangout() {
      try {
        const res = await fetch(`/api/hangouts?id=${hangoutId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hangout) {
            setHangout(data.hangout);
            if (targetMateId) {
              const targetFriend = data.hangout.friends.find((f: Friend) => f.id === targetMateId);
              if (targetFriend) {
                setSelectedFriendId(targetFriend.id);
                setExistingFriendName(targetFriend.name);
                setIdentityMode('existing');
                if (targetFriend.availabilitySlots.length > 0) {
                  setStartTime(targetFriend.availabilitySlots[0].startTime);
                  setEndTime(targetFriend.availabilitySlots[0].endTime);
                }
                if (targetFriend.budgetPreference) {
                  setBudgetPref(targetFriend.budgetPreference);
                }
                if (targetFriend.topInterests && targetFriend.topInterests.length > 0) {
                  setSelectedInterests(targetFriend.topInterests);
                }
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

  const handleSelectExistingFriend = (f: Friend) => {
    setIdentityMode('existing');
    setSelectedFriendId(f.id);
    setExistingFriendName(f.name);
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

  const handleSwitchToNewMate = () => {
    setIdentityMode('new');
    setSelectedFriendId('');
  };

  // Calculate heatmap availability for each hour from existing friends + this user's current times
  const hourlyAvailability = useMemo(() => {
    const list = hangout?.friends || INITIAL_FRIENDS;
    const isNew = identityMode === 'new';

    return HOURS.map(({ h24, label }) => {
      const availableFriends: { name: string; avatarColor: string }[] = [];

      list.forEach((fr) => {
        // If user is editing an existing profile
        if (!isNew && fr.id === selectedFriendId) {
          const [sH] = startTime.split(':').map(Number);
          const [eH] = endTime.split(':').map(Number);
          if (h24 >= sH && h24 < eH) {
            availableFriends.push({ name: existingFriendName || fr.name, avatarColor: fr.avatarColor });
          }
        } else {
          const slot = fr.availabilitySlots[0];
          if (slot) {
            const [sH] = slot.startTime.split(':').map(Number);
            const [eH] = slot.endTime.split(':').map(Number);
            if (h24 >= sH && h24 < eH) {
              availableFriends.push({ name: fr.name, avatarColor: fr.avatarColor });
            }
          }
        }
      });

      // If user is adding a new friend, include them in the heatmap preview!
      if (isNew) {
        const [sH] = startTime.split(':').map(Number);
        const [eH] = endTime.split(':').map(Number);
        if (h24 >= sH && h24 < eH) {
          availableFriends.push({
            name: newFriendName.trim() || 'You (New)',
            avatarColor: avatarColor,
          });
        }
      }

      const totalParticipants = isNew ? list.length + 1 : list.length;

      return {
        h24,
        label,
        count: availableFriends.length,
        total: totalParticipants,
        friends: availableFriends,
      };
    });
  }, [hangout, identityMode, selectedFriendId, existingFriendName, newFriendName, avatarColor, startTime, endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const isNew = identityMode === 'new';
    const effectiveFriendId = isNew ? `f-${Date.now().toString(36)}` : selectedFriendId;
    const effectiveName = isNew
      ? newFriendName.trim() || 'New Mate'
      : existingFriendName.trim() || 'Friend';
    const effectiveAvatarColor = isNew
      ? avatarColor
      : hangout?.friends.find((f) => f.id === selectedFriendId)?.avatarColor || 'bg-teal-600 text-white';

    try {
      const res = await fetch(`/api/hangouts/${hangoutId}/avail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendId: effectiveFriendId,
          friendName: effectiveName,
          avatarColor: effectiveAvatarColor,
          startTime,
          endTime,
          budgetPreference: budgetPref,
          topInterests: selectedInterests,
        }),
      });

      if (res.ok) {
        // Update local hangout state so heatmap immediately updates
        setHangout((prev) => {
          if (!prev) return prev;
          const existing = prev.friends.find((f) => f.id === effectiveFriendId);
          let updatedFriends: Friend[];
          if (existing) {
            updatedFriends = prev.friends.map((f) =>
              f.id === effectiveFriendId
                ? {
                    ...f,
                    name: effectiveName,
                    avatarColor: effectiveAvatarColor,
                    availabilitySlots: [{ id: `slot-${effectiveFriendId}`, startTime, endTime }],
                    budgetPreference: budgetPref,
                    topInterests: selectedInterests,
                    status: 'submitted',
                  }
                : f
            );
          } else {
            updatedFriends = [
              ...prev.friends,
              {
                id: effectiveFriendId,
                name: effectiveName,
                avatarColor: effectiveAvatarColor,
                availabilitySlots: [{ id: `slot-${effectiveFriendId}`, startTime, endTime }],
                budgetPreference: budgetPref,
                topInterests: selectedInterests,
                status: 'submitted',
              },
            ];
          }
          return {
            ...prev,
            friends: updatedFriends,
            friendCount: updatedFriends.length,
          };
        });

        setSubmittedName(effectiveName);
        setSelectedFriendId(effectiveFriendId);
        setExistingFriendName(effectiveName);
        setIdentityMode('existing');
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Error submitting availability:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const cleanUrl = `${window.location.origin}/avail/${hangoutId}`;
      navigator.clipboard.writeText(cleanUrl);
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
            {copiedLink ? 'Link Copied!' : 'Share When2Meet Link'}
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
                Open When2Meet Link
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              {hangout?.groupName || 'The goobers'} Hangout
            </h1>

            <p className="mt-1 text-xs text-teal-100 sm:text-sm">
              Your friend is organizing an Austin meetup! Anyone with this link can add their name and mark available hours to lock in the plan.
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
                  Thanks <strong>{submittedName}</strong>! Your free time ({startTime} to {endTime}) and ${budgetPref} budget comfort have been saved and synced with <strong>{hangout?.groupName}</strong>.
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
                    Edit My Availability
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Who are you? Anyone with the link can add their name */}
                <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-4 shadow-2xs">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                        Step 1: Who is Filling This Out?
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Add your name to join this hangout, or pick your name if already listed.
                      </p>
                    </div>

                    {/* Mode Toggle Buttons */}
                    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={handleSwitchToNewMate}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                          identityMode === 'new'
                            ? 'bg-teal-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <UserPlus className="h-3 w-3" />
                        + Add My Name
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hangout?.friends && hangout.friends.length > 0) {
                            handleSelectExistingFriend(hangout.friends[0]);
                          } else {
                            setIdentityMode('existing');
                          }
                        }}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                          identityMode === 'existing'
                            ? 'bg-teal-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <UserCheck className="h-3 w-3" />
                        Existing Mates ({hangout?.friends.length || 0})
                      </button>
                    </div>
                  </div>

                  {/* Mode: Adding a New Name */}
                  {identityMode === 'new' ? (
                    <div className="mt-3 rounded-xl border border-teal-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-black shadow-xs ring-2 ring-teal-500/30 ${avatarColor}`}
                        >
                          {newFriendName.trim() ? newFriendName.trim().charAt(0).toUpperCase() : '+'}
                        </div>
                        <div className="flex-1">
                          <label htmlFor="new-friend-name-input" className="block text-[11px] font-bold uppercase text-slate-600">
                            Your Name / Nickname <span className="text-rose-500">*</span>
                          </label>
                          <input
                            id="new-friend-name-input"
                            type="text"
                            value={newFriendName}
                            onChange={(e) => setNewFriendName(e.target.value)}
                            placeholder="e.g. Maya, Chris, Jordan"
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            required
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Avatar Color Picker */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600">
                          Choose Avatar Color:
                        </span>
                        <div className="flex items-center gap-1.5">
                          {AVATAR_COLORS.map((col) => {
                            const isSelected = avatarColor === col.class;
                            return (
                              <button
                                type="button"
                                key={col.id}
                                onClick={() => setAvatarColor(col.class)}
                                className={`h-6 w-6 rounded-full ${col.dot} transition flex items-center justify-center ${
                                  isSelected ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'
                                }`}
                                title={col.id}
                              >
                                {isSelected && <span className="text-[10px] text-white font-bold">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Mode: Existing Friends List */
                    <div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {/* Option to Add New Friend from the grid */}
                        <button
                          type="button"
                          onClick={handleSwitchToNewMate}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-teal-500 bg-teal-50/50 p-2.5 text-left text-teal-800 hover:bg-teal-50 transition"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                            +
                          </div>
                          <span className="truncate text-xs font-bold">+ Add New Name</span>
                        </button>

                        {hangout?.friends.map((f) => {
                          const isSelected = f.id === selectedFriendId;
                          return (
                            <button
                              type="button"
                              key={f.id}
                              onClick={() => handleSelectExistingFriend(f)}
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

                      {/* Display name field for existing friend */}
                      <div className="mt-3">
                        <label htmlFor="existing-friend-display-name" className="text-[11px] text-slate-500 font-medium">Display Name:</label>
                        <input
                          id="existing-friend-display-name"
                          type="text"
                          value={existingFriendName}
                          onChange={(e) => setExistingFriendName(e.target.value)}
                          placeholder="Your name"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-teal-600"
                        />
                      </div>
                    </div>
                  )}
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

                  {/* Explicit Time Inputs */}
                  <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="avail-start-time" className="mb-1 block text-[11px] font-bold text-teal-950 uppercase">
                          Free Starting At:
                        </label>
                        <input
                          id="avail-start-time"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-2xs focus:border-teal-600 focus:outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="avail-end-time" className="mb-1 block text-[11px] font-bold text-teal-950 uppercase">
                          Free Until:
                        </label>
                        <input
                          id="avail-end-time"
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

                {/* Step 4: Budget & Interest Preferences - Max budget is an editable number */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-800">
                    Step 4: Your Budget & Activity Preferences
                  </h3>
                  <p className="mb-3 text-[11px] text-slate-500">
                    Helps Meta Muse Spark and Nessie tailor the final Austin itinerary to you.
                  </p>

                  {/* Editable Number Input for Max Budget Comfort */}
                  <div className="mb-5 rounded-xl border border-slate-200 bg-[#FAF7F2]/40 p-3.5">
                    <label
                      htmlFor="budget-comfort-input"
                      className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-teal-600" />
                        Your Max Budget Comfort
                      </span>
                      <span className="text-[11px] font-normal normal-case text-slate-500">
                        Editable per-person amount
                      </span>
                    </label>

                    <div className="relative mt-1">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <span className="text-sm font-bold text-slate-400">$</span>
                      </div>
                      <input
                        id="budget-comfort-input"
                        type="number"
                        min="0"
                        max="1000"
                        step="5"
                        value={budgetPref === 0 ? '' : budgetPref}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBudgetPref(val === '' ? 0 : Math.max(0, Number(val)));
                        }}
                        placeholder="50"
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-8 pr-20 text-base font-black text-slate-900 shadow-2xs focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        required
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                        <span className="text-xs font-semibold text-slate-400">/ person</span>
                      </div>
                    </div>

                    {/* Quick Budget Suggestion Chips */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-slate-400 mr-1">Quick presets:</span>
                      {[20, 35, 50, 75, 100].map((amt) => (
                        <button
                          type="button"
                          key={amt}
                          onClick={() => setBudgetPref(amt)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                            budgetPref === amt
                              ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-2xs font-bold ring-1 ring-teal-500/30'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
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
                                ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-2xs font-bold'
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
                    disabled={isSubmitting || (identityMode === 'new' && !newFriendName.trim())}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 py-3.5 px-6 text-sm font-bold text-white shadow-md hover:bg-teal-900 hover:shadow-lg transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    {isSubmitting
                      ? 'Saving Your Availability...'
                      : identityMode === 'new'
                      ? `Add "${newFriendName.trim() || 'My Name'}" & Save Availability`
                      : `Update Availability for ${existingFriendName || 'Friend'}`}
                  </button>
                  {identityMode === 'new' && !newFriendName.trim() && (
                    <p className="mt-1.5 text-center text-[11px] text-slate-400 font-medium">
                      Please enter your name in Step 1 to join the hangout.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AvailabilityPage({ params, searchParams }: AvailPageProps) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-8 text-slate-500 font-semibold text-sm">
          Loading hangout availability...
        </div>
      }
    >
      <AvailabilityPageContent params={params} searchParams={searchParams} />
    </React.Suspense>
  );
}
