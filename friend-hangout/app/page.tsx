'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import {
  Activity,
  HangoutPreferences,
  PlanningViewType,
  Friend,
} from '@/types';
import { INITIAL_FRIENDS, MOCK_ACTIVITIES } from '@/lib/mockData';
import { generatePlan, calculateAvailabilityOverlap } from '@/lib/planner';
import { Header } from '@/components/Header';
import { HangoutForm } from '@/components/HangoutForm';
import { PlanningViews } from '@/components/PlanningViews';
import { ActivityDiscovery } from '@/components/ActivityDiscovery';

const DEFAULT_PREFERENCES: HangoutPreferences = {
  groupName: 'The goobers',
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
  const [shortlist, setShortlist] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<'planner' | 'discovery'>('planner');
  const [lastSyncNotice, setLastSyncNotice] = useState<string | null>(null);

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
                `🎉 ${updatedFriendName || 'A friend'} updated their available times via When2Meet link! Overlap recalculated.`
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

  // Compute current plan deterministically
  const currentPlan = useMemo(() => {
    return generatePlan(preferences, activeView);
  }, [preferences, activeView]);

  // Handle plan regeneration with brief animation
  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      // Smooth scroll to planning views
      const el = document.getElementById('planning-views-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 450);
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
  };

  const overlap = calculateAvailabilityOverlap(preferences.friends);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2] text-[#0F172A]">
      {/* Top Header */}
      <Header
        friendCount={preferences.friends.length}
        location={preferences.location}
        hasPlan={true}
        onReset={handleReset}
      />

      {/* When2Meet Real-Time Submission Banner */}
      {lastSyncNotice && (
        <div className="bg-emerald-600 px-4 py-2.5 text-center text-xs font-bold text-white shadow-sm transition animate-in slide-in-from-top">
          {lastSyncNotice}
        </div>
      )}

      {/* Hero Welcome Banner */}
      <section className="border-b border-[#E8E2D8] bg-gradient-to-b from-[#F5EFE6]/80 to-[#FAF7F2] py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-600/20 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                <span className="flex h-2 w-2 rounded-full bg-teal-600" />
                <span>Austin, Texas Hackathon Edition</span>
                <span className="text-teal-400">•</span>
                <span>Desktop-First Social Planning</span>
              </div>

              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl">
                Plan hangouts your mates will actually show up to.
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                <strong className="text-slate-900">TXMates</strong> harmonizes friends’ shared availability, budgets, and tastes into curated Austin itineraries using deterministic AI planning.
              </p>

              {/* Core integration pillars */}
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 rounded-lg bg-white/80 border border-slate-200/80 px-2.5 py-1 text-slate-700 font-medium shadow-2xs">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  Meta Muse Spark (AI Planning)
                </span>
                <span className="flex items-center gap-1.5 rounded-lg bg-white/80 border border-slate-200/80 px-2.5 py-1 text-slate-700 font-medium shadow-2xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                  Capital One Nessie (Budget Insights)
                </span>
                <span className="flex items-center gap-1.5 rounded-lg bg-white/80 border border-slate-200/80 px-2.5 py-1 text-slate-700 font-medium shadow-2xs">
                  <Compass className="h-3.5 w-3.5 text-emerald-600" />
                  OpenSerp (Local Discovery)
                </span>
              </div>
            </div>

            {/* Quick Hangout Snapshot Card */}
            <div className="rounded-2xl border border-[#E8E2D8] bg-white p-5 shadow-xs lg:w-80 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current Session
                </span>
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                  {preferences.friends.length} Active Mates
                </span>
              </div>

              <div className="mt-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Group:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[170px]">
                    {preferences.groupName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Common Free Time:</span>
                  <span className="font-bold text-teal-800">
                    {overlap.commonStart} – {overlap.commonEnd}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Max Budget / Person:</span>
                  <span className="font-bold text-slate-900">
                    ${preferences.maxBudgetPerPerson}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Selected Interests:</span>
                  <span className="font-bold text-slate-700">
                    {preferences.selectedInterests.length} categories
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-800 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-teal-900 transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Refresh AI Itinerary
              </button>
            </div>
          </div>

          {/* Tab Navigation for Desktop View */}
          <div className="mt-8 flex gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === 'planner'
                  ? 'border-teal-700 text-teal-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Hangout Form & Itinerary Views</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('discovery')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === 'discovery'
                  ? 'border-teal-700 text-teal-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Activity Discovery ({MOCK_ACTIVITIES.length} Austin Venues)</span>
              {shortlist.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-700 text-[10px] text-white">
                  {shortlist.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'planner' ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Create a Hangout Planning Form */}
            <div className="lg:col-span-5">
              <div className="sticky top-20">
                <HangoutForm
                  preferences={preferences}
                  onChange={setPreferences}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                />
              </div>
            </div>

            {/* Right Column: Planning Views & Itinerary */}
            <div id="planning-views-section" className="lg:col-span-7">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">
                      Generated Hangout Solutions
                    </h2>
                    <p className="text-xs text-slate-500">
                      Switch between 3 strategic planning modes crafted for {preferences.groupName}.
                    </p>
                  </div>

                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 border border-teal-200/80">
                    Active View: {activeView.toUpperCase()}
                  </span>
                </div>

                <PlanningViews
                  currentPlan={currentPlan}
                  activeView={activeView}
                  onSelectView={setActiveView}
                  friends={preferences.friends}
                  groupName={preferences.groupName}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Activity Discovery View */
          <div className="space-y-6">
            <ActivityDiscovery
              shortlist={shortlist}
              onToggleShortlist={handleToggleShortlist}
              onClearShortlist={handleClearShortlist}
              onApplyShortlist={handleApplyShortlist}
              maxBudget={preferences.maxBudgetPerPerson}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-[#E8E2D8] bg-white py-8 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">TXMates</span>
            <span>•</span>
            <span>Austin, TX Social Planning MVP</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-500">
            <span>Meta Muse Spark AI (Planned)</span>
            <span>•</span>
            <span>Capital One Nessie Budgeting (Simulated)</span>
            <span>•</span>
            <span>OpenSerp Search (Simulated)</span>
          </div>

          <p className="text-slate-400">
            Built for Desktop-First Hackathon Demo
          </p>
        </div>
      </footer>
    </div>
  );
}
