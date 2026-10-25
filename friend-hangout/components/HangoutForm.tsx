'use client';

import React, { useState } from 'react';
import type { NessieBudgetResponse } from '@/lib/nessieBudget';
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  MapPin,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { ActivityCategory, Friend, HangoutPreferences } from '@/types';
import { ACTIVITY_CATEGORIES, AUSTIN_NEIGHBORHOODS } from '@/lib/mockData';
import { calculateAvailabilityOverlap } from '@/lib/planner';
import { CATEGORY_ICONS } from './categoryIcons';

interface HangoutFormProps {
  preferences: HangoutPreferences;
  onChange: (updated: HangoutPreferences) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  nessie: NessieBudgetResponse | null;
  nessieLoading: boolean;
  onSelectCustomer: (customerId: string) => void;
  onSelectAccount: (accountId: string) => void;
}

export function HangoutForm({
  preferences,
  onChange,
  onGenerate,
  isGenerating,
  nessie,
  nessieLoading,
  onSelectCustomer,
  onSelectAccount,
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
      'bg-cola text-paper',
      'bg-tomato text-white',
      'bg-leaf text-white',
      'bg-ink text-sun',
      'bg-sun text-ink',
      'bg-ink-soft text-paper',
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

  const budgetTier =
    preferences.maxBudgetPerPerson < 25
      ? "Frugal"
      : preferences.maxBudgetPerPerson <= 50
        ? "Balanced"
        : preferences.maxBudgetPerPerson <= 100
          ? "A night out"
          : "Splurge";

  const fieldClass =
    "w-full border border-seam bg-pine px-3 py-2.5 text-base text-ink placeholder:text-ink-soft";

  return (
    <>
      <form onSubmit={handleSubmit} className="border border-seam bg-sheet p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-seam pb-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">The constraints</h2>
            <p className="mt-1 text-base text-ink-soft">
              {preferences.friends.length} mates. The hour scale above uses these windows.
            </p>
          </div>
          <p className="text-base font-semibold text-ink">{budgetTier}</p>
        </div>

        {validationError && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-base font-semibold text-tomato">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{validationError}</span>
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-base font-semibold text-ink">
            Group name
            <input
              type="text"
              value={preferences.groupName}
              onChange={(e) => onChange({ ...preferences, groupName: e.target.value })}
              placeholder="The goobers"
              required
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <div>
            <label className="block text-base font-semibold text-ink">
              Where
              <span className="relative mt-1 block">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
                <input
                  type="text"
                  value={preferences.location}
                  onChange={(e) => onChange({ ...preferences, location: e.target.value })}
                  placeholder="Austin, TX"
                  className={`${fieldClass} pl-9`}
                />
              </span>
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AUSTIN_NEIGHBORHOODS.slice(0, 4).map((neigh) => (
                <button
                  type="button"
                  key={neigh}
                  onClick={() => onChange({ ...preferences, location: `Austin, TX (${neigh})` })}
                  className="border border-seam bg-pine px-2 py-1 text-sm font-semibold text-ink"
                >
                  {neigh.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-base font-semibold text-ink">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" aria-hidden />
              Date
            </span>
            <input
              type="date"
              value={preferences.date}
              onChange={(e) => onChange({ ...preferences, date: e.target.value })}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <fieldset>
            <legend className="inline-flex items-center gap-1.5 text-base font-semibold text-ink">
              <Clock className="h-4 w-4" aria-hidden />
              Time of day
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(
                [
                  { id: "afternoon", label: "Afternoon", sub: "12–5" },
                  { id: "evening", label: "Evening", sub: "5–9" },
                  { id: "night", label: "Night", sub: "7+" },
                  { id: "all-day", label: "All day", sub: "Flexible" },
                ] as const
              ).map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => onChange({ ...preferences, timePreference: t.id })}
                  className={`px-2 py-2 text-center ${
                    preferences.timePreference === t.id
                      ? "bg-sun text-ink"
                      : "border border-seam bg-pine text-ink"
                  }`}
                >
                  <span className="block text-base font-semibold">{t.label}</span>
                  <span className="text-sm text-ink-soft">{t.sub}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <section className="mt-8 border-t border-seam pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-ink">Free windows</h3>
              <p className="text-base text-ink-soft">
                {overlap.allFriendsAvailable
                  ? `Everyone overlaps ${overlap.commonStart}–${overlap.commonEnd} (${overlap.overlapHours} hrs).`
                  : `${overlap.availableFriendCount} of ${preferences.friends.length} overlap ${overlap.commonStart}–${overlap.commonEnd}.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex min-h-11 items-center gap-1.5 bg-ink px-3 text-base font-semibold text-paper"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Send links
              </button>
              <button
                type="button"
                onClick={handleAddFriend}
                className="inline-flex min-h-11 items-center gap-1.5 border border-seam px-3 text-base font-semibold text-ink"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add mate
              </button>
              <button
                type="button"
                onClick={() => setShowAdvancedFriends(!showAdvancedFriends)}
                aria-expanded={showAdvancedFriends}
                className="inline-flex min-h-11 items-center px-2 text-ink"
              >
                {showAdvancedFriends ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                <span className="sr-only">{showAdvancedFriends ? "Hide mates" : "Show mates"}</span>
              </button>
            </div>
          </div>

          {showAdvancedFriends && (
            <ul className="mt-4 border-t border-seam">
              {preferences.friends.map((friend, idx) => (
                <li key={friend.id} className="border-b border-seam py-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center text-sm font-semibold ${friend.avatarColor}`}>
                        {friend.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <input
                          type="text"
                          value={friend.name}
                          aria-label={`Name for mate ${idx + 1}`}
                          onChange={(e) => handleUpdateFriendName(friend.id, e.target.value)}
                          className="w-full max-w-[14rem] bg-transparent text-base font-semibold text-ink"
                        />
                        <p className="text-sm text-ink-soft">
                          {idx === 0
                            ? "Organizer"
                            : friend.status === "submitted"
                              ? "Submitted from their link"
                              : "Waiting on a link"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyFriendLink(friend.id)}
                        className="inline-flex min-h-11 items-center gap-1 border border-seam px-2 text-sm font-semibold text-ink"
                      >
                        {copiedFriendId === friend.id ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4" aria-hidden />
                            Link
                          </>
                        )}
                      </button>
                      {preferences.friends.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFriend(friend.id)}
                          aria-label={`Remove ${friend.name}`}
                          className="grid h-11 w-11 place-items-center text-ink"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {friend.availabilitySlots.map((slot) => (
                    <div key={slot.id} className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-sm font-semibold text-ink-soft">
                        From
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => handleUpdateSlot(friend.id, slot.id, "startTime", e.target.value)}
                          className={`mt-1 ${fieldClass}`}
                        />
                      </label>
                      <label className="text-sm font-semibold text-ink-soft">
                        Until
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => handleUpdateSlot(friend.id, slot.id, "endTime", e.target.value)}
                          className={`mt-1 ${fieldClass}`}
                        />
                      </label>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 border-t border-seam pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="text-lg font-semibold text-ink" htmlFor="budget-amount">
              Max per person
            </label>
            <div className="flex items-center border border-seam bg-pine px-2">
              <span className="text-base text-ink-soft">$</span>
              <input
                id="budget-amount"
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
                className="w-20 bg-transparent py-2 text-right text-base font-semibold tabular-nums text-ink"
              />
            </div>
          </div>
          <NessieBudgetNote
            nessie={nessie}
            nessieLoading={nessieLoading}
            currentBudget={preferences.maxBudgetPerPerson}
            onUseSuggestion={() =>
              onChange({
                ...preferences,
                maxBudgetPerPerson: nessie?.estimate.suggestedPerPerson ?? preferences.maxBudgetPerPerson,
              })
            }
            onSelectCustomer={onSelectCustomer}
            onSelectAccount={onSelectAccount}
          />
          <input
            type="range"
            min="10"
            max="150"
            step="5"
            aria-label="Budget slider"
            value={preferences.maxBudgetPerPerson}
            onChange={(e) =>
              onChange({
                ...preferences,
                maxBudgetPerPerson: Number(e.target.value),
              })
            }
            className="mt-4 w-full"
          />
          <p className="mt-2 flex justify-between text-sm text-ink-soft">
            <span>$10</span>
            <span>$50</span>
            <span>$100</span>
            <span>$150</span>
          </p>
          <p className="mt-3 text-base text-ink">
            Group pool{" "}
            <span className="font-semibold tabular-nums">
              ${preferences.maxBudgetPerPerson * preferences.friends.length}
            </span>
          </p>
        </section>

        <section className="mt-8 border-t border-seam pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-ink">
              Interests ({preferences.selectedInterests.length})
            </h3>
            <div className="flex gap-3 text-base font-semibold">
              <button type="button" onClick={selectAllInterests} className="text-ink">
                All
              </button>
              <button type="button" onClick={clearAllInterests} className="text-ink-soft">
                Clear
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACTIVITY_CATEGORIES.map((cat) => {
              const isSelected = preferences.selectedInterests.includes(cat.id as ActivityCategory);
              const Icon = CATEGORY_ICONS[cat.id as ActivityCategory];
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => toggleInterest(cat.id as ActivityCategory)}
                  aria-pressed={isSelected}
                  className={`px-3 py-3 text-left ${
                    isSelected ? "bg-sun text-ink" : "border border-seam bg-pine text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="mt-2 block text-base font-semibold">{cat.label}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{cat.desc}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-8">
          <button
            type="submit"
            disabled={isGenerating}
            className="flex min-h-11 w-full items-center justify-center bg-tomato px-6 text-base font-semibold text-white disabled:bg-seam disabled:text-ink-soft"
          >
            {isGenerating ? "Refreshing the plan…" : "Generate hangout ideas"}
          </button>
          <p className="mt-2 text-center text-sm text-ink-soft">
            Matches the overlap, the cap, and the Austin list you have selected.
          </p>
        </div>
      </form>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="w-full max-w-lg border border-seam bg-sheet p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="invite-title" className="text-xl font-semibold text-ink">
                  Send When2Meet links
                </h3>
                <p className="mt-1 text-base text-ink-soft">
                  Each mate opens their own link and paints hours onto the same scale.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                aria-label="Close"
                className="grid h-11 w-11 place-items-center text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 border border-seam bg-pine p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-ink">Anyone can join</p>
                <button
                  type="button"
                  onClick={handleCopyGeneralLink}
                  className="inline-flex min-h-11 items-center gap-1 bg-ink px-3 text-sm font-semibold text-paper"
                >
                  {copiedGeneralLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedGeneralLink ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 break-all text-sm text-ink-soft">
                {typeof window !== "undefined"
                  ? `${window.location.origin}/avail/${hangoutId}`
                  : `/avail/${hangoutId}`}
              </p>
            </div>

            <ul className="mt-4 max-h-60 space-y-2 overflow-y-auto">
              {preferences.friends.map((friend) => (
                <li key={friend.id} className="flex items-center justify-between gap-2 border-b border-seam py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center text-sm font-semibold ${friend.avatarColor}`}>
                      {friend.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-ink">{friend.name}</p>
                      <p className="text-sm text-ink-soft">
                        {friend.status === "submitted" ? "Hours submitted" : "Still pending"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyFriendLink(friend.id)}
                      className="inline-flex min-h-11 items-center gap-1 border border-seam px-2 text-sm font-semibold text-ink"
                    >
                      {copiedFriendId === friend.id ? "Copied" : "Copy"}
                    </button>
                    <a
                      href={`/avail/${hangoutId}?mate=${friend.id}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open link for ${friend.name}`}
                      className="grid h-11 w-11 place-items-center text-ink"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="inline-flex min-h-11 items-center bg-ink px-4 text-base font-semibold text-paper"
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

function NessieBudgetNote({
  nessie,
  nessieLoading,
  currentBudget,
  onUseSuggestion,
  onSelectCustomer,
  onSelectAccount,
}: {
  nessie: NessieBudgetResponse | null;
  nessieLoading: boolean;
  currentBudget: number;
  onUseSuggestion: () => void;
  onSelectCustomer: (customerId: string) => void;
  onSelectAccount: (accountId: string) => void;
}) {
  const suggested = nessie?.estimate.suggestedPerPerson;
  const showUse =
    nessie?.source === 'nessie' &&
    typeof suggested === 'number' &&
    suggested !== currentBudget;

  return (
    <div className="mt-3 space-y-3">
      <p role="status" className="text-base text-ink">
        {nessieLoading
          ? 'Reading Nessie accounts, purchases, and bills…'
          : nessie?.source === 'nessie'
            ? nessie.estimate.reasoning
            : nessie?.notice ||
              'Estimate only. Nessie did not answer, so this cap is not a bank balance.'}
      </p>
      {nessie && nessie.customers.length > 1 && !nessie.customerLocked && (
        <label className="block text-base font-semibold text-ink">
          Nessie customer
          <select
            value={nessie.selectedCustomerId ?? ''}
            onChange={(event) => onSelectCustomer(event.target.value)}
            className="mt-1 w-full border border-seam bg-pine px-3 py-2.5 text-base font-normal text-ink"
          >
            {nessie.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {nessie && nessie.accounts.length > 1 && !nessie.accountLocked && (
        <label className="block text-base font-semibold text-ink">
          Nessie account
          <select
            value={nessie.selectedAccountId ?? 'all'}
            onChange={(event) => onSelectAccount(event.target.value === 'all' ? '' : event.target.value)}
            className="mt-1 w-full border border-seam bg-pine px-3 py-2.5 text-base font-normal text-ink"
          >
            <option value="all">All accounts</option>
            {nessie.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.nickname} ({account.type}
                {account.last4 ? ` · ${account.last4}` : ''}) ${Math.round(account.balance)}
              </option>
            ))}
          </select>
        </label>
      )}
      {showUse && (
        <button
          type="button"
          onClick={onUseSuggestion}
          className="inline-flex min-h-11 items-center border border-seam px-3 text-base font-semibold text-ink"
        >
          Use ${suggested} from Nessie
        </button>
      )}
    </div>
  );
}
