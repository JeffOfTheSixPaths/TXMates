'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Clock,
  MapPin,
  CheckCircle2,
  ThumbsUp,
  Heart,
  Lock,
  ShieldCheck,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Download,
} from 'lucide-react';
import { HangoutPlan, PlanningViewType, Friend, ItineraryItem } from '@/types';
import { exportItineraryAsPng } from '@/lib/exportPng';

interface PlanningViewsProps {
  currentPlan: HangoutPlan;
  activeView?: PlanningViewType;
  onSelectView?: (view: PlanningViewType) => void;
  friends: Friend[];
  groupName: string;
}

export function PlanningViews({
  currentPlan,
  friends,
  groupName,
}: PlanningViewsProps) {
  // Itinerary custom order state to support drag-and-drop reordering without cascading effect renders
  const [customOrder, setCustomOrder] = useState<{ planId: string; items: ItineraryItem[] } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Active itinerary: uses customized drag-and-drop order if for the current plan, else original plan itinerary
  const itinerary = customOrder && customOrder.planId === currentPlan.id
    ? customOrder.items
    : currentPlan.itinerary;

  // Friend votes state
  const [votes, setVotes] = useState<Record<string, 'up' | 'love' | null>>({
    'f-1': 'up',
    'f-2': 'love',
    'f-3': 'up',
  });
  const [isLocked, setIsLocked] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Reorder itinerary items and maintain chronological time slots
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= itinerary.length) return;
    const updated = [...itinerary];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    // Keep chronological time slots aligned with their positions
    const reorderedWithTimes = updated.map((item, idx) => ({
      ...item,
      timeSlot: currentPlan.itinerary[idx]?.timeSlot || item.timeSlot,
    }));

    setCustomOrder({
      planId: currentPlan.id,
      items: reorderedWithTimes,
    });
  };

  // Export current itinerary to high-res PNG
  const handleExportPng = () => {
    setIsExporting(true);
    try {
      exportItineraryAsPng({
        groupName,
        items: itinerary,
        plan: currentPlan,
        friends,
      });
      setExportNotice('📸 Itinerary exported as PNG to your downloads!');
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err) {
      console.error('Failed to export itinerary as PNG:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle lock state and export PNG when locked
  const handleToggleLock = () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    if (nextLocked) {
      handleExportPng();
    }
  };

  // Cast vote for a friend
  const handleVote = (friendId: string, type: 'up' | 'love') => {
    setVotes((prev) => {
      const current = prev[friendId];
      if (current === type) {
        const next = { ...prev };
        delete next[friendId];
        return next;
      }
      return { ...prev, [friendId]: type };
    });
  };

  const voteCount = Object.keys(votes).length;
  const totalFriends = friends.length || 4;
  const consensusPercentage = Math.round((voteCount / totalFriends) * 100);

  return (
    <div className="space-y-6">
      {/* Export Confirmation Toast */}
      {exportNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-emerald-600" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={handleExportPng}
            className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] text-white hover:bg-emerald-800 transition"
          >
            Download Again
          </button>
        </div>
      )}

      {/* Capital One Nessie Budget & Cost Breakdown */}
      <div className="rounded-2xl border border-[#E8E2D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Estimated Group Budget & Cost Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Simulated financial insights via Capital One Nessie logic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                currentPlan.nessieFinancialInsight.budgetStatus === 'under'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : currentPlan.nessieFinancialInsight.budgetStatus === 'on-target'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {currentPlan.nessieFinancialInsight.budgetStatus === 'under'
                ? 'Under Budget'
                : currentPlan.nessieFinancialInsight.budgetStatus === 'on-target'
                ? 'Within Target'
                : 'Budget Alert'}
            </span>
          </div>
        </div>

        {/* Cost Matrix Cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">
              Cost Per Person
            </span>
            <div className="mt-1 text-xl font-black text-teal-900">
              ${currentPlan.totalCostPerPerson.toFixed(0)}
            </div>
            <span className="text-[10px] text-slate-400">for {itinerary.length} planned spots</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">
              Total Group Spend
            </span>
            <div className="mt-1 text-xl font-black text-slate-900">
              ${currentPlan.totalGroupCost.toFixed(0)}
            </div>
            <span className="text-[10px] text-slate-400">
              {friends.length} mates total
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">
              Per-Person Savings
            </span>
            <div className="mt-1 text-xl font-black text-emerald-700">
              ${currentPlan.nessieFinancialInsight.savingsPerPerson.toFixed(0)}
            </div>
            <span className="text-[10px] text-emerald-600">vs max target</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">
              Nessie Health Score
            </span>
            <div className="mt-1 text-xl font-black text-blue-700">
              {currentPlan.nessieFinancialInsight.financialHealthScore}/10
            </div>
            <span className="text-[10px] text-slate-400">Financial safety</span>
          </div>
        </div>

        {/* Nessie Tip */}
        <div className="mt-3.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-900">
          <span className="font-bold">Nessie Financial Insight: </span>
          {currentPlan.nessieFinancialInsight.budgetTip}
        </div>
      </div>

      {/* Proposed Itinerary Timeline with Drag-and-Drop */}
      <div className="rounded-2xl border border-[#E8E2D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">
                Proposed Itinerary Schedule
              </h3>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800">
                {itinerary.length} Stops
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isLocked
                ? 'Itinerary is locked and finalized for the squad.'
                : 'Drag stops around or use arrows to adjust the schedule order.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isLocked ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200/80 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                <GripVertical className="h-3.5 w-3.5 text-teal-600" />
                Drag to Reorder Stops
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <Lock className="h-3.5 w-3.5" />
                Itinerary Locked
              </span>
            )}

            {isLocked && (
              <button
                type="button"
                onClick={handleExportPng}
                disabled={isExporting}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-600 bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export PNG
              </button>
            )}
          </div>
        </div>

        {/* Timeline Sequence */}
        <div className="relative pl-6 space-y-6 before:absolute before:bottom-3 before:top-3 before:left-2.5 before:w-0.5 before:bg-teal-200">
          {itinerary.map((item, idx) => (
            <div key={item.activity.id} className="relative">
              {/* Timeline marker */}
              <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white ring-4 ring-white shadow-2xs">
                {idx + 1}
              </div>

              {/* Itinerary Card with Drag and Drop */}
              <div
                draggable={!isLocked}
                onDragStart={(e) => {
                  if (isLocked) return;
                  e.dataTransfer.setData('text/plain', String(idx));
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedIndex(idx);
                }}
                onDragOver={(e) => {
                  if (isLocked) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === idx) setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  if (isLocked) return;
                  e.preventDefault();
                  const from = draggedIndex ?? Number(e.dataTransfer.getData('text/plain'));
                  moveItem(from, idx);
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`rounded-xl border p-4 transition-all duration-150 ${
                  isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                } ${
                  dragOverIndex === idx
                    ? 'border-teal-500 bg-teal-50/80 scale-[1.01] shadow-md ring-2 ring-teal-500/30'
                    : draggedIndex === idx
                    ? 'opacity-40 border-dashed border-teal-400 bg-slate-50'
                    : 'border-slate-200 bg-[#FAF7F2]/40 hover:border-teal-400 hover:bg-white hover:shadow-xs'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isLocked && (
                      <div
                        className="flex items-center gap-0.5 rounded bg-slate-100/80 px-1.5 py-0.5 text-slate-500 hover:text-slate-800"
                        title="Drag stop up or down"
                      >
                        <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold uppercase select-none">
                          Stop {idx + 1}
                        </span>
                      </div>
                    )}

                    <span className="inline-flex items-center gap-1 rounded-md bg-teal-800 px-2.5 py-0.5 text-xs font-bold text-white shadow-2xs">
                      <Clock className="h-3 w-3" />
                      {item.timeSlot}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {item.activity.categoryLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-teal-900">
                      ${item.activity.estimatedCostPerPerson}/person
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">
                      {item.activity.durationMinutes} mins
                    </span>

                    {!isLocked && (
                      <div className="flex items-center gap-0.5 ml-1 border-l border-slate-200 pl-1.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItem(idx, idx - 1);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          title="Move stop earlier"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === itinerary.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveItem(idx, idx + 1);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          title="Move stop later"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  <h4 className="text-base font-bold text-slate-900">
                    {item.activity.name}
                  </h4>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{item.activity.location} ({item.activity.neighborhood})</span>
                  </div>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {item.activity.description}
                </p>

                {/* Highlights tags */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {item.activity.highlights.map((h) => (
                    <span
                      key={h}
                      className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                    >
                      ✓ {h}
                    </span>
                  ))}
                </div>

                {/* Friend availability status */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-[11px]">
                  <span className="text-slate-500 italic">{item.notes}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    All {item.availableFriendsCount} friends free
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Voting & Consensus Module */}
      <div className="rounded-2xl border border-[#E8E2D8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Mate Voting & Plan Consensus
            </h3>
            <p className="text-xs text-slate-500">
              Each friend can cast their vote to lock in this hangout plan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              Consensus: {voteCount} of {totalFriends} friends ({consensusPercentage}%)
            </span>
          </div>
        </div>

        {/* Consensus progress bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${consensusPercentage}%` }}
          />
        </div>

        {/* Friends voting cards */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {friends.map((friend) => {
            const vote = votes[friend.id];
            return (
              <div
                key={friend.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#FAF7F2]/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${friend.avatarColor}`}
                  >
                    {friend.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {friend.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {vote ? (
                        <span className="text-emerald-700 font-semibold">
                          {vote === 'love' ? 'Loves it! ❤️' : 'Ready to go! 👍'}
                        </span>
                      ) : (
                        'Awaiting vote...'
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleVote(friend.id, 'up')}
                    title="Thumbs up"
                    className={`rounded-lg p-1.5 transition ${
                      vote === 'up'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote(friend.id, 'love')}
                    title="Love it"
                    className={`rounded-lg p-1.5 transition ${
                      vote === 'love'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                    }`}
                  >
                    <Heart className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lock Plan Action & PNG Export */}
        <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4 sm:flex-row">
          <div>
            <h4 className="text-xs font-bold text-teal-950">
              {isLocked ? '🎉 Plan Confirmed & Locked!' : 'Squad Consensus Status'}
            </h4>
            <p className="text-[11px] text-teal-800">
              {isLocked
                ? 'All mates have confirmed! Calendar invites and itinerary notifications generated.'
                : `${voteCount} mates have approved. Lock the plan to automatically export the itinerary as a PNG.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLocked && (
              <button
                type="button"
                onClick={handleExportPng}
                disabled={isExporting}
                className="flex items-center gap-1.5 rounded-xl border border-teal-600 bg-white px-3.5 py-2 text-xs font-bold text-teal-800 shadow-2xs hover:bg-teal-50 transition active:scale-[0.99]"
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? 'Exporting...' : 'Export PNG'}
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleLock}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${
                isLocked
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-teal-800 text-white hover:bg-teal-900'
              }`}
            >
              {isLocked ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Plan Confirmed (Click to Unlock)
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Lock & Export Itinerary PNG
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
