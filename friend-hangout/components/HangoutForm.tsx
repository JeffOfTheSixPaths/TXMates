'use client';

import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { ActivityCategory, Friend, HangoutPreferences } from '@/types';
import { ACTIVITY_CATEGORIES, AUSTIN_NEIGHBORHOODS } from '@/lib/mockData';
import { calculateAvailabilityOverlap } from '@/lib/planner';

interface HangoutFormProps {
  preferences: HangoutPreferences;
  onChange: (updated: HangoutPreferences) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function HangoutForm({
  preferences,
  onChange,
  onGenerate,
  isGenerating,
}: HangoutFormProps) {
  const [showAdvancedFriends, setShowAdvancedFriends] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedFriendId, setCopiedFriendId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedGeneralLink, setCopiedGeneralLink] = useState(false);

  const overlap = calculateAvailabilityOverlap(preferences.friends);
  const hangoutId = preferences.id || 'txmates-demo';

  // Toggle interest category
  const toggleInterest = (category: ActivityCategory) => {
    const exists = preferences.selectedInterests.includes(category);
    let next: ActivityCategory[];
    if (exists) {
      next = preferences.selectedInterests.filter((c) => c !== category);
    } else {
      next = [...preferences.selectedInterests, category];
    }
    onChange({ ...preferences, selectedInterests: next });
  };

  const selectAllInterests = () => {
    const all = ACTIVITY_CATEGORIES.map((c) => c.id as ActivityCategory);
    onChange({ ...preferences, selectedInterests: all });
  };

  const clearAllInterests = () => {
    onChange({ ...preferences, selectedInterests: [] });
  };

  // Add friend
  const handleAddFriend = () => {
    const colors = [
      'bg-teal-600 text-white',
      'bg-sky-600 text-white',
      'bg-amber-600 text-white',
      'bg-emerald-600 text-white',
      'bg-indigo-600 text-white',
      'bg-rose-600 text-white',
    ];
    const nextNumber = preferences.friends.length + 1;
    const newId = `f-${nextNumber}`;
    const newFriend: Friend = {
      id: newId,
      name: `Mate #${nextNumber}`,
      avatarColor: colors[nextNumber % colors.length],
      availabilitySlots: [
        {
          id: `s-${newId}`,
          startTime: '14:00',
          endTime: '21:00',
          label: '2:00 PM - 9:00 PM',
        },
      ],
      budgetPreference: preferences.maxBudgetPerPerson,
      topInterests: ['food', 'music'],
      status: 'pending',
    };

    const updatedFriends = [...preferences.friends, newFriend];
    onChange({
      ...preferences,
      friends: updatedFriends,
      friendCount: updatedFriends.length,
    });
  };

  // Remove friend
  const handleRemoveFriend = (friendId: string) => {
    if (preferences.friends.length <= 1) {
      setValidationError('You need at least 1 friend to plan a hangout!');
      return;
    }
    const updated = preferences.friends.filter((f) => f.id !== friendId);
    onChange({
      ...preferences,
      friends: updated,
      friendCount: updated.length,
    });
  };

  // Update friend slot
  const handleUpdateSlot = (
    friendId: string,
    slotId: string,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    const updated = preferences.friends.map((f) => {
      if (f.id !== friendId) return f;
      const updatedSlots = f.availabilitySlots.map((s) => {
        if (s.id !== slotId) return s;
        return { ...s, [field]: value };
      });
      return { ...f, availabilitySlots: updatedSlots };
    });
    onChange({ ...preferences, friends: updated });
  };

  // Update friend name
  const handleUpdateFriendName = (friendId: string, name: string) => {
    const updated = preferences.friends.map((f) => {
      if (f.id !== friendId) return f;
      return { ...f, name };
    });
    onChange({ ...preferences, friends: updated });
  };

  // Copy individual When2Meet link for friend
  const handleCopyFriendLink = (friendId: string) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/avail/${hangoutId}?mate=${friendId}`;
      navigator.clipboard.writeText(url);
      setCopiedFriendId(friendId);
      setTimeout(() => setCopiedFriendId(null), 2500);
    }
  };

  const handleCopyGeneralLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/avail/${hangoutId}`;
      navigator.clipboard.writeText(url);
      setCopiedGeneralLink(true);
      setTimeout(() => setCopiedGeneralLink(false), 2500);
    }
  };

  // Handle form submit with validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preferences.groupName.trim()) {
      setValidationError('Please enter a group name for your hangout.');
      return;
    }
    if (preferences.maxBudgetPerPerson <= 0) {
      setValidationError('Please set a maximum budget greater than $0.');
      return;
    }
    if (preferences.friends.length === 0) {
      setValidationError('Please add at least one friend to the plan.');
      return;
    }

    setValidationError(null);
    onGenerate();
  };

  // Nessie budget tier label
  const getBudgetTierLabel = (budget: number) => {
    if (budget < 25) return { label: 'Frugal Fun & Greenbelts', color: 'text-emerald-700 bg-emerald-50' };
    if (budget <= 50) return { label: 'Balanced Austin Outing', color: 'text-teal-700 bg-teal-50' };
    if (budget <= 100) return { label: 'Prime Food & Shows', color: 'text-sky-700 bg-sky-50' };
    return { label: 'VIP Weekend Splurge', color: 'text-purple-700 bg-purple-50' };
  };

  const budgetTier = getBudgetTierLabel(preferences.maxBudgetPerPerson);

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#E8E2D8] bg-white p-5 shadow-sm transition-all sm:p-7"
      >
        {/* Form Header */}
        <div className="mb-6 flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">
                Create a Hangout
              </h2>
              <span className="rounded-md bg-teal-600/10 px-2 py-0.5 text-xs font-semibold text-teal-800">
                Austin, TX
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Set your squad’s parameters, friend time windows, and target budget.
            </p>
          </div>

          <div className="mt-2 flex items-center gap-2 sm:mt-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              {preferences.friends.length} Friends in Plan
            </span>
          </div>
        </div>

        {validationError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Row 1: Group Name & Location */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Group / Hangout Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={preferences.groupName}
                  onChange={(e) =>
                    onChange({ ...preferences, groupName: e.target.value })
                  }
                  placeholder="e.g. The goobers"
                  className="w-full rounded-xl border border-slate-200 bg-[#FAF7F2]/60 px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-slate-400 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Target City / District
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MapPin className="h-4 w-4 text-teal-600" />
                </div>
                <input
                  type="text"
                  value={preferences.location}
                  onChange={(e) =>
                    onChange({ ...preferences, location: e.target.value })
                  }
                  placeholder="Austin, TX"
                  className="w-full rounded-xl border border-slate-200 bg-[#FAF7F2]/60 py-2.5 pl-9 pr-3.5 text-sm text-[#0F172A] transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              {/* Quick Neighborhood Chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AUSTIN_NEIGHBORHOODS.slice(0, 4).map((neigh) => (
                  <button
                    type="button"
                    key={neigh}
                    onClick={() =>
                      onChange({ ...preferences, location: `Austin, TX (${neigh})` })
                    }
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800 transition"
                  >
                    {neigh.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Date & Time Preferences - 2x2 Grid for spacious buttons */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                Target Date
              </label>
              <input
                type="date"
                value={preferences.date}
                onChange={(e) =>
                  onChange({ ...preferences, date: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-[#FAF7F2]/60 px-3.5 py-2.5 text-sm text-[#0F172A] transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                Vibe / Time of Day
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'afternoon', label: 'Afternoon', sub: '12-5 PM' },
                    { id: 'evening', label: 'Evening', sub: '5-9 PM' },
                    { id: 'night', label: 'Night', sub: '7 PM+' },
                    { id: 'all-day', label: 'All Day', sub: 'Flexible' },
                  ] as const
                ).map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() =>
                      onChange({ ...preferences, timePreference: t.id })
                    }
                    className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                      preferences.timePreference === t.id
                        ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-xs ring-1 ring-teal-500/20'
                        : 'border-slate-200 bg-[#FAF7F2]/50 text-slate-700 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold">{t.label}</span>
                    <span className="text-[10px] text-slate-500">{t.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Friends' Availability Slots (When2Meet Compatible) */}
          <div className="rounded-xl border border-[#E8E2D8] bg-[#FAF7F2]/40 p-4">
            <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {preferences.friends.length}
                </span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Friends’ Available Time Slots
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Edit times here or send individual When2Meet links to friends!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-teal-600 bg-teal-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-teal-800 transition"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Send Links to Friends
                </button>
                <button
                  type="button"
                  onClick={handleAddFriend}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  <Plus className="h-3 w-3" />
                  Add Mate
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFriends(!showAdvancedFriends)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Toggle friend slots"
                >
                  {showAdvancedFriends ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Shared Overlap Golden Window Banner */}
            <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-ping" />
                <span className="font-semibold text-teal-900">
                  Shared Overlap Window:
                </span>
                <span className="rounded bg-teal-50 px-2 py-0.5 font-bold text-teal-800">
                  {overlap.commonStart} – {overlap.commonEnd} ({overlap.overlapHours} hrs)
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                {overlap.allFriendsAvailable ? (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    All {preferences.friends.length} friends free during this window!
                  </span>
                ) : (
                  <span className="font-medium text-amber-700">
                    Partial overlap ({overlap.availableFriendCount} of {preferences.friends.length} mates)
                  </span>
                )}
              </div>
            </div>

            {/* Friend Cards List - Cleanly Structured & NO OVERFLOW */}
            {showAdvancedFriends && (
              <div className="mt-3 space-y-3">
                {preferences.friends.map((friend, idx) => (
                  <div
                    key={friend.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-slate-300"
                  >
                    {/* Top Row: Avatar, Name, Badge, Send Link, Remove */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${friend.avatarColor}`}
                        >
                          {friend.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <input
                            type="text"
                            value={friend.name}
                            onChange={(e) =>
                              handleUpdateFriendName(friend.id, e.target.value)
                            }
                            className="max-w-[130px] sm:max-w-[180px] rounded-md border border-transparent px-1 py-0.5 text-xs font-bold text-slate-800 hover:border-slate-300 focus:border-teal-500 focus:bg-slate-50 focus:outline-none truncate"
                          />
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            {idx === 0 ? (
                              <span className="text-teal-700 font-semibold">Lead Organizer</span>
                            ) : friend.status === 'submitted' ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Submitted via link
                              </span>
                            ) : (
                              <span>Mate</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Icons: Copy Friend's Link & Trash */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyFriendLink(friend.id)}
                          title={`Copy personal link for ${friend.name} to fill out their availability`}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                            copiedFriendId === friend.id
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : 'border-teal-600/30 bg-teal-50 text-teal-800 hover:bg-teal-100'
                          }`}
                        >
                          {copiedFriendId === friend.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3 w-3 text-teal-700" />
                              <span>Send Link</span>
                            </>
                          )}
                        </button>

                        {preferences.friends.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFriend(friend.id)}
                            title="Remove friend from plan"
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Full-Width Contained Time Slot Inputs */}
                    {friend.availabilitySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-lg border border-slate-200 bg-[#FAF7F2]/60 p-2 text-xs"
                      >
                        <div className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-teal-700" />
                            Free Time Window:
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            24-hr / local format
                          </span>
                        </div>

                        {/* Responsive 2-column inputs that NEVER overflow */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="block text-[10px] text-slate-500 mb-0.5">
                              From (Start):
                            </span>
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) =>
                                handleUpdateSlot(
                                  friend.id,
                                  slot.id,
                                  'startTime',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-600 focus:outline-none"
                            />
                          </div>

                          <div>
                            <span className="block text-[10px] text-slate-500 mb-0.5">
                              To (End):
                            </span>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) =>
                                handleUpdateSlot(
                                  friend.id,
                                  slot.id,
                                  'endTime',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-teal-600 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Maximum Spending Budget Per Person */}
          <div className="rounded-xl border border-[#E8E2D8] bg-[#FAF7F2]/40 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <DollarSign className="h-3.5 w-3.5 text-teal-600" />
                  Max Spending Budget (Per Person)
                </label>
                <p className="text-[11px] text-slate-500">
                  Simulated Capital One Nessie financial constraint.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${budgetTier.color}`}
                >
                  {budgetTier.label}
                </span>
                <div className="flex items-center rounded-xl border border-slate-300 bg-white px-2.5 py-1 shadow-2xs">
                  <span className="text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    step="5"
                    value={preferences.maxBudgetPerPerson}
                    onChange={(e) =>
                      onChange({
                        ...preferences,
                        maxBudgetPerPerson: Number(e.target.value) || 0,
                      })
                    }
                    className="w-16 border-none bg-transparent text-right text-sm font-bold text-[#0F172A] focus:outline-none"
                  />
                  <span className="ml-1 text-[11px] text-slate-400">/ person</span>
                </div>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-400 mr-1">Quick pick:</span>
              {[15, 30, 50, 75, 100, 150].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => onChange({ ...preferences, maxBudgetPerPerson: amt })}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    preferences.maxBudgetPerPerson === amt
                      ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-2xs font-bold ring-1 ring-teal-500/30'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-xs text-slate-600 border border-slate-200">
              <span>Estimated Group Total Budget Pool:</span>
              <span className="font-bold text-teal-900">
                ${(preferences.maxBudgetPerPerson * preferences.friends.length).toFixed(0)} total
              </span>
            </div>
          </div>

          {/* Section 5: Activity Interests Multi-Select */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Activity Interests & Vibe ({preferences.selectedInterests.length} selected)
                </label>
                <p className="text-[11px] text-slate-500">
                  Select the activities your squad wants to experience in Austin.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllInterests}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearAllInterests}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACTIVITY_CATEGORIES.map((cat) => {
                const isSelected = preferences.selectedInterests.includes(
                  cat.id as ActivityCategory
                );
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => toggleInterest(cat.id as ActivityCategory)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 text-teal-950 shadow-xs ring-1 ring-teal-500/20'
                        : 'border-slate-200 bg-[#FAF7F2]/40 text-slate-700 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xl">{cat.emoji}</span>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-teal-600" />
                      )}
                    </div>
                    <span className="mt-1 text-xs font-bold">{cat.label}</span>
                    <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                      {cat.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Hangout Ideas Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-teal-700 via-teal-800 to-sky-900 py-3.5 px-6 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4 text-amber-300 transition group-hover:rotate-12" />
              <span>
                {isGenerating
                  ? 'Synthesizing Hangout Plans with Meta Muse Spark...'
                  : 'Generate Hangout Ideas'}
              </span>
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Instant deterministic matching using availability overlap, Nessie budget limits, and curated Austin spots.
            </p>
          </div>
        </div>
      </form>

      {/* When2Meet Sharing Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E8E2D8] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                  <Share2 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Share When2Meet Availability Links
                  </h3>
                  <p className="text-xs text-slate-500">
                    Send each friend their personal link to enter their free times.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* General Link */}
              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-teal-950">
                    General Hangout Invite Link (Anyone can join)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyGeneralLink}
                    className="flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-800 transition shadow-2xs"
                  >
                    {copiedGeneralLink ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
                <div className="text-[11px] font-mono text-teal-800 break-all bg-white/80 p-2 rounded-lg border border-teal-200/60">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/avail/${hangoutId}`
                    : `/avail/${hangoutId}`}
                </div>
              </div>

              {/* Individual Friend Links */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Individual Personal Links (Pre-selects each friend):
                </span>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {preferences.friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${friend.avatarColor}`}
                        >
                          {friend.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {friend.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {friend.status === 'submitted'
                              ? '✓ Availability Submitted'
                              : 'Pending times'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyFriendLink(friend.id)}
                          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-teal-600 hover:text-teal-800 hover:bg-teal-50 shadow-2xs transition"
                        >
                          {copiedFriendId === friend.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <a
                          href={`/avail/${hangoutId}?mate=${friend.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open When2Meet page in new tab"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
