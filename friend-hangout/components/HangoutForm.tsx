'use client';

import React, { useState, useMemo } from 'react';
import type { NessieBudgetResponse } from '@/lib/nessieBudget';
import type { SquadPricePointResponse } from '@/types';
import { NessieSquadPriceAdvisor } from './NessieSquadPriceAdvisor';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ActivityCategory, Friend, HangoutPreferences } from '@/types';
import { ACTIVITY_CATEGORIES, AUSTIN_NEIGHBORHOODS } from '@/lib/mockData';
import { availabilityStrong, coverageCount } from '@/lib/availabilityHeat';
import { heatStyle } from './OverlapRunner';
import { calculateAvailabilityOverlap, compareCandidateDates, formatFriendlyDate } from '@/lib/planner';
import { CATEGORY_ICONS } from './categoryIcons';
import { DragCalendar } from './DragCalendar';
import { When2MeetGrid } from './When2MeetGrid';

interface HangoutFormProps {
  preferences: HangoutPreferences;
  onChange: (updated: HangoutPreferences) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  nessie?: NessieBudgetResponse | null;
  nessieBudget?: NessieBudgetResponse | null;
  nessieLoading?: boolean;
  onSelectCustomer?: (customerId: string) => void;
  onSelectAccount?: (accountId: string) => void;
  squadAdvisory?: SquadPricePointResponse | null;
  squadAdvisoryLoading?: boolean;
  onApplySquadPricePoint?: (target: number) => void;
  plannerStep?: 'who' | 'when' | 'budget';
  onPlannerStep?: (step: 'who' | 'when' | 'budget') => void;
  plain?: boolean;
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
  squadAdvisory,
  squadAdvisoryLoading,
  onApplySquadPricePoint,
  plannerStep,
  onPlannerStep,
  plain = false,
}: HangoutFormProps) {
  const [showAdvancedFriends, setShowAdvancedFriends] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedFriendId, setCopiedFriendId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedGeneralLink, setCopiedGeneralLink] = useState(false);
  const [batchSyncLoading, setBatchSyncLoading] = useState(false);
  const [syncAllNotice, setSyncAllNotice] = useState<string | null>(null);
  const [singleSyncLoadingId, setSingleSyncLoadingId] = useState<string | null>(null);

  const selectedDatesList = useMemo(() => {
    const list =
      preferences.selectedDates && preferences.selectedDates.length > 0
        ? preferences.selectedDates
        : [preferences.date];
    if (!list.includes(preferences.date)) {
      return [preferences.date, ...list];
    }
    return list;
  }, [preferences.selectedDates, preferences.date]);

  const candidateDates = useMemo(
    () => compareCandidateDates(preferences.friends, selectedDatesList),
    [preferences.friends, selectedDatesList]
  );

  const handleSetActiveDate = (newDate: string) => {
    onChange({
      ...preferences,
      date: newDate,
      selectedDates: selectedDatesList.includes(newDate)
        ? selectedDatesList
        : [...selectedDatesList, newDate],
    });
  };

  const handleDatesChange = (newDates: string[]) => {
    const nextDate = newDates.includes(preferences.date) ? preferences.date : newDates[0] || preferences.date;
    onChange({
      ...preferences,
      selectedDates: newDates,
      date: nextDate,
    });
  };

  const overlap = calculateAvailabilityOverlap(preferences.friends, preferences.date);
  const hangoutId = preferences.id || 'txmates-demo';

  const handleBatchSyncGoogleCalendars = async () => {
    setBatchSyncLoading(true);
    setSyncAllNotice(null);
    try {
      const res = await fetch('/api/calendar/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hangoutId: preferences.id || 'txmates-demo',
          friends: preferences.friends,
          date: preferences.date,
          timePreference: preferences.timePreference,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync Google Calendars');
      }

      onChange({
        ...preferences,
        friends: data.updatedFriends,
      });

      setSyncAllNotice(data.summary);
      setTimeout(() => setSyncAllNotice(null), 8000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch calendar sync failed';
      setValidationError(msg);
    } finally {
      setBatchSyncLoading(false);
    }
  };

  const handleSyncSingleFriendCalendar = async (friend: Friend) => {
    setSingleSyncLoadingId(friend.id);
    try {
      const res = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friend,
          date: preferences.date,
          mode: 'auto',
          timePreference: preferences.timePreference,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync Google Calendar');
      }

      const updatedFriends = preferences.friends.map((f) => {
        if (f.id !== friend.id) return f;
        return {
          ...f,
          status: 'submitted' as const,
          calendarSynced: true,
          calendarSyncDetails: {
            source: 'demo' as const,
            syncedAt: new Date().toISOString(),
            eventsDetected: data.busyEvents.length,
            busyEvents: data.busyEvents,
            freeWindows: data.freeWindows,
            suggestedStart: data.suggestedStartTime,
            suggestedEnd: data.suggestedEndTime,
          },
          availabilitySlots: [
            {
              id:
                f.availabilitySlots.find((s) => s.date === preferences.date)?.id ||
                f.availabilitySlots[0]?.id ||
                `slot-${f.id}`,
              startTime: data.suggestedStartTime,
              endTime: data.suggestedEndTime,
              date: preferences.date,
            },
            ...f.availabilitySlots.filter((s) => s.date && s.date !== preferences.date),
          ],
        };
      });

      onChange({
        ...preferences,
        friends: updatedFriends,
      });

      setSyncAllNotice(
        `Synced Google Calendar for ${friend.name}: free ${data.suggestedStartTime}–${data.suggestedEndTime}.`
      );
      setTimeout(() => setSyncAllNotice(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Calendar sync failed';
      setValidationError(msg);
    } finally {
      setSingleSyncLoadingId(null);
    }
  };

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
      onPlannerStep?.('who');
      return;
    }
    if (preferences.maxBudgetPerPerson <= 0) {
      setValidationError('Please set a maximum budget greater than $0.');
      onPlannerStep?.('budget');
      return;
    }
    if (preferences.friends.length === 0) {
      setValidationError('Please add at least one friend to the plan.');
      onPlannerStep?.('who');
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

  const showWho = !plannerStep || plannerStep === "who";
  const showWhen = !plannerStep || plannerStep === "when";
  const showBudget = !plannerStep || plannerStep === "budget";

  return (
    <>
      <form onSubmit={handleSubmit} className={plain ? "" : "bg-sheet px-5 py-6 sm:px-7 sm:py-8"}>
        {!plannerStep && (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl font-semibold text-ink">The constraints</h2>
              <p className="mt-2 text-base text-ink-soft">
                {preferences.friends.length} mates. {budgetTier}.
              </p>
            </div>
          </div>
        )}

        {validationError && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-base font-semibold text-tomato">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{validationError}</span>
          </p>
        )}

        {showWho && (
        <div className={`${plannerStep === "who" ? "mt-6" : "mt-8"} grid grid-cols-1 gap-4 sm:grid-cols-2`}>
          <label className="block text-base font-semibold text-ink">
            Group name
            <input
              type="text"
              value={preferences.groupName}
              onChange={(e) => onChange({ ...preferences, groupName: e.target.value })}
              placeholder="Group Name Here"
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
              {(() => {
                const loc = (preferences.location || '').toLowerCase();
                let chips: Array<{ label: string; value: string }> = [];
                if (loc.includes('dallas')) {
                  chips = [
                    { label: 'Deep Ellum', value: 'Dallas, TX (Deep Ellum)' },
                    { label: 'Arts District', value: 'Dallas, TX (Arts District)' },
                    { label: 'Uptown', value: 'Dallas, TX (Uptown)' },
                    { label: 'Bishop Arts', value: 'Dallas, TX (Bishop Arts)' },
                  ];
                } else if (loc.includes('san antonio')) {
                  chips = [
                    { label: 'Pearl', value: 'San Antonio, TX (Pearl District)' },
                    { label: 'River Walk', value: 'San Antonio, TX (River Walk)' },
                    { label: 'Southtown', value: 'San Antonio, TX (Southtown)' },
                    { label: 'Downtown', value: 'San Antonio, TX (Downtown)' },
                  ];
                } else if (loc.includes('seattle')) {
                  chips = [
                    { label: 'Capitol Hill', value: 'Seattle, WA (Capitol Hill)' },
                    { label: 'Ballard', value: 'Seattle, WA (Ballard)' },
                    { label: 'Fremont', value: 'Seattle, WA (Fremont)' },
                    { label: 'Pike Place', value: 'Seattle, WA (Pike Place)' },
                  ];
                } else if (loc.includes('chicago')) {
                  chips = [
                    { label: 'West Loop', value: 'Chicago, IL (West Loop)' },
                    { label: 'Wicker Park', value: 'Chicago, IL (Wicker Park)' },
                    { label: 'River North', value: 'Chicago, IL (River North)' },
                    { label: 'Lincoln Park', value: 'Chicago, IL (Lincoln Park)' },
                  ];
                } else if (loc.includes('austin') || !loc) {
                  chips = AUSTIN_NEIGHBORHOODS.slice(0, 4).map((neigh) => ({
                    label: neigh.split(' ')[0],
                    value: `Austin, TX (${neigh})`,
                  }));
                } else {
                  chips = [
                    { label: 'Austin', value: 'Austin, TX' },
                    { label: 'Dallas', value: 'Dallas, TX' },
                    { label: 'San Antonio', value: 'San Antonio, TX' },
                    { label: 'Seattle', value: 'Seattle, WA' },
                    { label: 'Chicago', value: 'Chicago, IL' },
                  ];
                }
                return chips.map((chip) => (
                  <button
                    type="button"
                    key={chip.label}
                    onClick={() => onChange({ ...preferences, location: chip.value })}
                    className="bg-pine px-2 py-1 text-sm font-semibold text-ink"
                  >
                    {chip.label}
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
        )}

        {showWhen && (
        <>
        <div className={plannerStep === "when" ? "" : "mt-8"}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-base font-semibold text-ink">
              <Calendar className="h-4 w-4" aria-hidden />
              Dates ({candidateDates.length})
            </span>
            <span className="text-sm text-ink-soft">
              Planning <strong className="font-semibold text-ink">{formatFriendlyDate(preferences.date)}</strong>
            </span>
          </div>

          <DragCalendar
            selectedDates={selectedDatesList}
            activeDate={preferences.date}
            onDatesChange={handleDatesChange}
            onActiveDateSelect={handleSetActiveDate}
          />
        </div>

        <details className="mt-6">
          <summary className="cursor-pointer text-base font-semibold text-ink">Hour-by-hour grid</summary>
          <div className="mt-3">
            <When2MeetGrid
              dates={candidateDates.map((c) => c.date)}
              friends={preferences.friends}
              title="When2Meet"
            />
          </div>
        </details>

        <div className="mt-4">
          <fieldset>
            <legend className="inline-flex items-center gap-1.5 text-base font-semibold text-ink">
              <Clock className="h-4 w-4" aria-hidden />
              Time of day for {formatFriendlyDate(preferences.date)}
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { id: "afternoon", label: "Afternoon", sub: "12–5", start: "12:00", end: "17:00" },
                  { id: "evening", label: "Evening", sub: "5–9", start: "17:00", end: "21:00" },
                  { id: "night", label: "Night", sub: "7+", start: "19:00", end: "23:00" },
                  { id: "all-day", label: "All day", sub: "Flexible", start: "11:00", end: "22:00" },
                ] as const
              ).map((t) => {
                const coverage = coverageCount(preferences.friends, t.start, t.end, preferences.date);
                const selected = preferences.timePreference === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => onChange({ ...preferences, timePreference: t.id })}
                    aria-pressed={selected}
                    data-strong={availabilityStrong(coverage.count, coverage.total) ? "true" : "false"}
                    style={heatStyle(coverage.count, coverage.total)}
                    className={`avail-heat border px-2 py-2 text-center ${selected ? "outline outline-2 outline-offset-2 outline-ink" : ""}`}
                  >
                    <span className="block text-base font-semibold">{t.label}</span>
                    <span className="text-sm">
                      {t.sub} · {coverage.word} {coverage.count}/{coverage.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        </>
        )}

        {(showWho || showWhen) && (
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">
                {showWho && !showWhen ? "Mates" : "Free windows"}
              </h3>
              {showWhen ? (
                <p className="mt-1 text-base text-ink-soft">
                  {overlap.allFriendsAvailable
                    ? `All free ${overlap.commonStart}–${overlap.commonEnd}.`
                    : overlap.availableFriendCount > 0
                      ? `${overlap.availableFriendCount} of ${preferences.friends.length} overlap, ${overlap.commonStart}–${overlap.commonEnd}.`
                      : `No shared window yet.`}
                </p>
              ) : (
                <p className="mt-1 text-base text-ink-soft">
                  {preferences.friends.length} on this hangout.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {showWho && (
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 bg-ink px-3 text-base font-semibold text-paper"
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Send links
                </button>
              )}
              {showWho && (
                <button
                  type="button"
                  onClick={handleAddFriend}
                  className="inline-flex min-h-11 items-center gap-1.5 px-3 text-base font-semibold text-ink"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add mate
                </button>
              )}
              {showWhen && (
                <button
                  type="button"
                  onClick={() => setShowAdvancedFriends(!showAdvancedFriends)}
                  aria-expanded={showAdvancedFriends}
                  className="inline-flex min-h-11 items-center gap-1 px-2 text-base font-semibold text-ink"
                >
                  {showAdvancedFriends ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showAdvancedFriends ? "Hide hours" : "Edit hours"}
                </button>
              )}
            </div>
          </div>

          {syncAllNotice && (
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-leaf" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{syncAllNotice}</span>
            </p>
          )}

          {showWhen && showAdvancedFriends && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleBatchSyncGoogleCalendars}
                disabled={batchSyncLoading}
                className="inline-flex min-h-11 items-center gap-1.5 bg-tomato px-3 text-base font-semibold text-white transition hover:bg-tomato/90 disabled:opacity-60"
              >
                {batchSyncLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Syncing calendars…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Import Google Calendars
                  </>
                )}
              </button>
            </div>
          )}

          {(showWho || showAdvancedFriends) && (
          <ul className="mt-2">
              {preferences.friends.map((friend, idx) => (
                <li key={friend.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center text-sm font-semibold ${friend.avatarColor}`}>
                        {friend.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={friend.name}
                            aria-label={`Name for mate ${idx + 1}`}
                            onChange={(e) => handleUpdateFriendName(friend.id, e.target.value)}
                            className="w-full max-w-[14rem] bg-transparent text-base font-semibold text-ink"
                          />
                          {friend.nessieCustomerId && (
                            <span className="shrink-0 text-sm font-semibold text-leaf">Nessie</span>
                          )}
                          {friend.calendarSynced && (
                            <span className="shrink-0 text-sm font-semibold text-leaf">Calendar</span>
                          )}
                        </div>
                        <p className="text-sm text-ink-soft">
                          {friend.calendarSynced
                            ? `Calendar synced, ${friend.calendarSyncDetails?.eventsDetected || 0} busy`
                            : idx === 0
                              ? "Organizer"
                              : friend.status === "submitted"
                                ? "Submitted"
                                : "Waiting"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {showWhen && showAdvancedFriends && (
                      <button
                        type="button"
                        onClick={() => handleSyncSingleFriendCalendar(friend)}
                        disabled={singleSyncLoadingId === friend.id}
                        className={`inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold ${
                          friend.calendarSynced ? "text-leaf" : "text-ink"
                        }`}
                        title={
                          friend.calendarSynced
                            ? `Google Calendar synced (${friend.calendarSyncDetails?.eventsDetected || 0} busy events)`
                            : `Import Google Calendar for ${friend.name}`
                        }
                      >
                        {singleSyncLoadingId === friend.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : friend.calendarSynced ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-leaf" aria-hidden />
                            Synced
                          </>
                        ) : (
                          <>
                            <Calendar className="h-4 w-4" aria-hidden />
                            Calendar
                          </>
                        )}
                      </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyFriendLink(friend.id)}
                        className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-ink"
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
                  {showWhen && showAdvancedFriends && friend.availabilitySlots.map((slot) => (
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
          {plannerStep === "who" && onPlannerStep && (
            <button
              type="button"
              onClick={() => onPlannerStep("when")}
              className="mt-8 flex min-h-11 w-full items-center justify-center bg-ink px-6 text-base font-semibold text-paper"
            >
              Next: When
            </button>
          )}
          {plannerStep === "when" && onPlannerStep && (
            <button
              type="button"
              onClick={() => onPlannerStep("budget")}
              className="mt-8 flex min-h-11 w-full items-center justify-center bg-ink px-6 text-base font-semibold text-paper"
            >
              Next: Budget and vibes
            </button>
          )}
        </section>
        )}

        {showBudget && (
        <>
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="text-xl font-semibold text-ink" htmlFor="budget-amount">
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
          {squadAdvisory && (
            <NessieSquadPriceAdvisor
              advisory={squadAdvisory}
              loading={Boolean(squadAdvisoryLoading)}
              currentBudget={preferences.maxBudgetPerPerson}
              friendNames={preferences.friends.map((f) => f.name)}
              onApplyGroupTarget={(target) => {
                if (onApplySquadPricePoint) {
                  onApplySquadPricePoint(target);
                } else {
                  onChange({
                    ...preferences,
                    maxBudgetPerPerson: target,
                    friends: preferences.friends.map((f) => ({
                      ...f,
                      budgetPreference: target,
                    })),
                  });
                }
              }}
            />
          )}
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

        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xl font-semibold text-ink">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {ACTIVITY_CATEGORIES.map((cat) => {
              const isSelected = preferences.selectedInterests.includes(cat.id as ActivityCategory);
              const Icon = CATEGORY_ICONS[cat.id as ActivityCategory];
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => toggleInterest(cat.id as ActivityCategory)}
                  aria-pressed={isSelected}
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
        </section>

        <div className="mt-10">
          <button
            type="submit"
            disabled={isGenerating}
            className="flex min-h-11 w-full items-center justify-center bg-tomato px-6 text-base font-semibold text-white disabled:bg-seam disabled:text-ink-soft"
          >
            {isGenerating ? "Refreshing the plan…" : "Generate hangout ideas"}
          </button>
          <p className="mt-2 text-center text-sm text-ink-soft">
            Uses the overlap, the cap, and your interests.
          </p>
        </div>
        </>
        )}
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

function publicBudgetCopy(text: string) {
  if (/NESSIE_API_KEY|MUSE_API_KEY|\.env|npm run/i.test(text)) {
    console.warn(text);
    return 'Estimate';
  }
  return text;
}

function NessieBudgetNote({
  nessie,
  nessieLoading,
  currentBudget,
  onUseSuggestion,
  onSelectCustomer,
  onSelectAccount,
}: {
  nessie?: NessieBudgetResponse | null;
  nessieLoading?: boolean;
  currentBudget: number;
  onUseSuggestion: () => void;
  onSelectCustomer?: (customerId: string) => void;
  onSelectAccount?: (accountId: string) => void;
}) {
  const suggested = nessie?.estimate.suggestedPerPerson;
  const showUse =
    nessie?.source === 'nessie' &&
    typeof suggested === 'number' &&
    suggested !== currentBudget;
  const rawStatus = nessieLoading
    ? null
    : nessie?.source === 'nessie'
      ? `${nessie.estimate.museEnriched ? 'Muse. ' : ''}${nessie.estimate.reasoning}`
      : nessie?.notice || 'Estimate only. Nessie did not answer, so this cap is not a bank balance.';
  const statusCopy = rawStatus == null ? null : publicBudgetCopy(rawStatus);

  return (
    <div className="mt-3 space-y-3">
      {nessieLoading ? (
        <p role="status" className="text-base text-ink">
          Reading accounts, then asking Muse to explain the cap…
        </p>
      ) : statusCopy === 'Estimate' ? (
        <p role="status" className="text-sm font-semibold text-ink-soft">
          Estimate
        </p>
      ) : (
        <p role="status" className="text-base text-ink">
          {statusCopy}
        </p>
      )}
      {nessie?.source === 'nessie' && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-ink">How this cap was set</summary>
          <p className="mt-2 text-base text-ink">
            {nessie.estimate.savingsBalance > 0 || nessie.estimate.plannedMonthlySavings > 0
              ? `Savings $${Math.round(nessie.estimate.savingsBalance)} stays out of the hangout budget${
                  nessie.estimate.plannedMonthlySavings > 0
                    ? `, with about $${Math.round(nessie.estimate.plannedMonthlySavings)} a month set aside`
                    : ''
                }. `
              : ''}
            Nessie does not update account balances from purchases or deposits, so this uses the balance field as stored.
          </p>
        </details>
      )}
      {nessie && nessie.customers.length > 1 && !nessie.customerLocked && (
        <label className="block text-base font-semibold text-ink">
          Nessie customer
          <select
            value={nessie.selectedCustomerId ?? ''}
            onChange={(event) => onSelectCustomer?.(event.target.value)}
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
            onChange={(event) => onSelectAccount?.(event.target.value === 'all' ? '' : event.target.value)}
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
      {nessie?.estimate.museTips && nessie.estimate.museTips.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-base text-ink">
          {nessie.estimate.museTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
      {showUse && (
        <button
          type="button"
          onClick={onUseSuggestion}
          className="inline-flex min-h-11 items-center bg-ink px-3 text-base font-semibold text-paper"
        >
          Use ${suggested} from Nessie
        </button>
      )}
    </div>
  );
}
