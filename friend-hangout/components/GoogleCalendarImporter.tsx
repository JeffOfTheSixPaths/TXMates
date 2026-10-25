'use client';

import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Friend, FriendCalendarSyncDetails } from '@/types';
import {
  formatFriendlyTime,
  generateIcsFeed,
  getDemoGoogleCalendarEvents,
} from '@/lib/googleCalendar';

interface GoogleCalendarImporterProps {
  friend: Friend;
  date: string;
  timePreference?: 'afternoon' | 'evening' | 'all-day' | 'night';
  onSyncComplete: (
    startTime: string,
    endTime: string,
    syncDetails: FriendCalendarSyncDetails
  ) => void;
  compact?: boolean;
}

export function GoogleCalendarImporter({
  friend,
  date,
  timePreference = 'afternoon',
  onSyncComplete,
  compact = false,
}: GoogleCalendarImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'auto' | 'url' | 'upload'>('auto');
  const [icalUrl, setIcalUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [showScheduleDetails, setShowScheduleDetails] = useState(false);

  // 1-Click Auto Sync
  const handleAutoSync = async () => {
    setLoading(true);
    setError(null);
    setSyncNotice(null);

    try {
      const res = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friend,
          date,
          mode: 'auto',
          timePreference,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to auto-import Google Calendar');
      }

      const syncDetails: FriendCalendarSyncDetails = {
        source: 'demo',
        syncedAt: new Date().toISOString(),
        eventsDetected: data.busyEvents.length,
        busyEvents: data.busyEvents,
        freeWindows: data.freeWindows,
        suggestedStart: data.suggestedStartTime,
        suggestedEnd: data.suggestedEndTime,
      };

      onSyncComplete(data.suggestedStartTime, data.suggestedEndTime, syncDetails);
      setSyncNotice(data.summaryNotice);
      setShowScheduleDetails(true);
      if (compact) setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Calendar sync failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // iCal Feed URL Sync
  const handleUrlSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icalUrl.trim()) {
      setError('Please enter a valid Google Calendar iCal URL (.ics)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friend,
          date,
          mode: 'ical',
          icalUrl: icalUrl.trim(),
          timePreference,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.summaryNotice || 'Could not parse calendar feed');
      }

      const syncDetails: FriendCalendarSyncDetails = {
        source: 'ical',
        syncedAt: new Date().toISOString(),
        eventsDetected: data.busyEvents.length,
        busyEvents: data.busyEvents,
        freeWindows: data.freeWindows,
        suggestedStart: data.suggestedStartTime,
        suggestedEnd: data.suggestedEndTime,
      };

      onSyncComplete(data.suggestedStartTime, data.suggestedEndTime, syncDetails);
      setSyncNotice(data.summaryNotice);
      setShowScheduleDetails(true);
      setIsOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import iCal URL';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // File Upload (.ics)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const icsContent = event.target?.result as string;
        if (!icsContent || !icsContent.includes('BEGIN:VCALENDAR')) {
          throw new Error('The selected file is not a valid iCalendar (.ics) file.');
        }

        const res = await fetch('/api/calendar/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            friend,
            date,
            mode: 'upload',
            icsContent,
            timePreference,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to parse uploaded calendar file');
        }

        const syncDetails: FriendCalendarSyncDetails = {
          source: 'upload',
          syncedAt: new Date().toISOString(),
          eventsDetected: data.busyEvents.length,
          busyEvents: data.busyEvents,
          freeWindows: data.freeWindows,
          suggestedStart: data.suggestedStartTime,
          suggestedEnd: data.suggestedEndTime,
        };

        onSyncComplete(data.suggestedStartTime, data.suggestedEndTime, syncDetails);
        setSyncNotice(data.summaryNotice);
        setShowScheduleDetails(true);
        setIsOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not parse .ics file';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Failed to read the file.');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  // Download Sample Google Calendar .ics for testing
  const handleDownloadSampleIcs = () => {
    const events = getDemoGoogleCalendarEvents(friend.name || friend.id, date);
    const icsText = generateIcsFeed(friend.name || 'Friend', events, date);
    const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${friend.name.replace(/\s+/g, '_')}_calendar.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const isSynced = friend.calendarSynced;
  const syncDetails = friend.calendarSyncDetails;

  return (
    <div className="bg-pine p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center border border-seam bg-sheet text-ink">
            <Calendar className="h-4 w-4 text-tomato" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-ink">Google Calendar Sync</span>
              {isSynced && (
                <span className="inline-flex items-center gap-1 border border-leaf/40 bg-leaf/10 px-2 py-0.5 text-xs font-semibold text-leaf">
                  <CheckCircle2 className="h-3 w-3" />
                  Synced
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft">
              {isSynced
                ? `Free window detected from ${syncDetails?.eventsDetected || 0} calendar events`
                : 'Import your busy events to auto-fill your free hours on ' + date}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoSync}
            disabled={loading}
            className="inline-flex min-h-9 items-center gap-1.5 bg-tomato px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-tomato/90 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing schedule…
              </>
            ) : isSynced ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Re-sync Google Calendar
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-sun" />
                Auto-Import Google Calendar
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex min-h-9 items-center gap-1 border border-seam bg-sheet px-2.5 text-sm font-semibold text-ink hover:bg-pine"
          >
            <Link2 className="h-3.5 w-3.5 text-ink-soft" />
            More options
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {syncNotice && (
        <p className="mt-3 flex items-start gap-1.5 text-sm font-medium text-leaf">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{syncNotice}</span>
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm font-medium text-tomato" role="alert">
          {error}
        </p>
      )}

      {/* Synced Details Breakdown */}
      {isSynced && syncDetails && (
        <div className="mt-3 border-t border-seam pt-3">
          <button
            type="button"
            onClick={() => setShowScheduleDetails(!showScheduleDetails)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold text-ink-soft hover:text-ink"
          >
            <span>
              Detected schedule for {date} ({syncDetails.eventsDetected} busy events)
            </span>
            <span className="inline-flex items-center gap-1">
              {showScheduleDetails ? 'Hide details' : 'Show breakdown'}
              {showScheduleDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </span>
          </button>

          {showScheduleDetails && (
            <div className="mt-2 space-y-1.5">
              {syncDetails.busyEvents.map((evt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between border border-dashed border-tomato/30 bg-tomato/5 px-2.5 py-1.5 text-xs text-ink"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full bg-tomato" />
                    {evt.summary}
                  </span>
                  <span className="font-mono text-ink-soft">
                    {formatFriendlyTime(evt.startTime)} – {formatFriendlyTime(evt.endTime)}
                  </span>
                </div>
              ))}

              <div className="flex items-center justify-between border border-leaf/40 bg-leaf/10 px-2.5 py-2 text-xs font-semibold text-ink">
                <span className="flex items-center gap-1.5 text-leaf">
                  <Clock className="h-3.5 w-3.5" />
                  Optimal Free Window (Auto-filled)
                </span>
                <span className="font-mono text-leaf">
                  {formatFriendlyTime(syncDetails.suggestedStart)} –{' '}
                  {formatFriendlyTime(syncDetails.suggestedEnd)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Drawer: iCal URL / .ics Upload / Sample Download */}
      {isOpen && (
        <div className="mt-4 border-t border-seam pt-4">
          <div className="mb-3 flex border-b border-seam text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`border-b-2 px-3 py-1.5 ${
                activeTab === 'auto'
                  ? 'border-ink text-ink font-bold'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              1-Click Auto
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`border-b-2 px-3 py-1.5 ${
                activeTab === 'url'
                  ? 'border-ink text-ink font-bold'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              Google iCal URL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`border-b-2 px-3 py-1.5 ${
                activeTab === 'upload'
                  ? 'border-ink text-ink font-bold'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              Upload .ics File
            </button>
          </div>

          {activeTab === 'auto' && (
            <div className="space-y-2 text-xs text-ink-soft">
              <p>
                Automatically synchronizes schedule and busy periods for{' '}
                <strong className="text-ink">{friend.name}</strong> on {date}.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAutoSync}
                  disabled={loading}
                  className="inline-flex min-h-8 items-center gap-1.5 bg-tomato px-3 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Run Auto Sync Now
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSampleIcs}
                  className="inline-flex min-h-8 items-center gap-1 border border-seam bg-sheet px-2.5 text-xs font-semibold text-ink hover:bg-pine"
                >
                  <Download className="h-3 w-3" />
                  Download sample .ics for testing
                </button>
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleUrlSync} className="space-y-2">
              <label className="block text-xs font-semibold text-ink">
                Google Calendar Secret or Public iCal URL (.ics)
                <input
                  type="url"
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  value={icalUrl}
                  onChange={(e) => setIcalUrl(e.target.value)}
                  className="mt-1 w-full border border-seam bg-sheet px-2.5 py-1.5 text-xs text-ink"
                />
              </label>
              <p className="text-xs text-ink-soft">
                Find this in Google Calendar &gt; Settings for my calendar &gt; Integrate calendar &gt; Secret address in iCal format.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-8 items-center gap-1 bg-ink px-3 text-xs font-semibold text-paper disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Fetch &amp; Sync URL
                </button>
              </div>
            </form>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink">
                Select exported .ics file
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={handleFileUpload}
                  className="mt-1 block w-full text-xs text-ink file:mr-2 file:border-0 file:bg-ink file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-paper"
                />
              </label>
              <p className="text-xs text-ink-soft">
                Exported from Google Calendar via Settings &gt; Import &amp; Export &gt; Export.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
