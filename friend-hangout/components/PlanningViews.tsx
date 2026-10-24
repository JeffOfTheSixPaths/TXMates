'use client';

import React, { useState, useMemo } from 'react';
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
  Sparkles,
  ArrowRightLeft,
  X,
  Search,
  Star,
} from 'lucide-react';
import { HangoutPlan, PlanningViewType, Friend, ItineraryItem, Activity, ActivityCategory } from '@/types';
import { MOCK_ACTIVITIES } from '@/lib/mockData';
import { exportItineraryAsPng } from '@/lib/exportPng';

interface PlanningViewsProps {
  currentPlan: HangoutPlan;
  activeView?: PlanningViewType;
  onSelectView?: (view: PlanningViewType) => void;
  friends: Friend[];
  groupName: string;
  maxBudgetPerPerson?: number;
  selectedInterests?: ActivityCategory[];
}

interface AiAlternative {
  activity: Activity;
  reason: string;
  badgeColor: string;
  badgeLabel: string;
}

export function PlanningViews({
  currentPlan,
  friends,
  groupName,
  maxBudgetPerPerson = 50,
}: PlanningViewsProps) {
  // Itinerary custom order & swapped items state
  const [customOrder, setCustomOrder] = useState<{ planId: string; items: ItineraryItem[] } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Active itinerary: customized if modified, otherwise original plan
  const itinerary = useMemo(() => {
    return customOrder && customOrder.planId === currentPlan.id
      ? customOrder.items
      : currentPlan.itinerary;
  }, [customOrder, currentPlan.id, currentPlan.itinerary]);

  // Alternative picker modal state
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [altFilter, setAltFilter] = useState<'all' | 'same_vibe' | 'budget' | 'browse'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Friend votes state
  const [votes, setVotes] = useState<Record<string, 'up' | 'love' | null>>({
    'f-1': 'up',
    'f-2': 'love',
    'f-3': 'up',
  });
  const [isLocked, setIsLocked] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Dynamic cost calculations based on currently selected items
  const dynamicCostPerPerson = useMemo(() => {
    return itinerary.reduce((sum, item) => sum + item.activity.estimatedCostPerPerson, 0);
  }, [itinerary]);

  const dynamicTotalGroupCost = dynamicCostPerPerson * (friends.length || 4);
  const dynamicSavingsPerPerson = Math.max(0, maxBudgetPerPerson - dynamicCostPerPerson);
  const dynamicHealthScore = Math.min(
    10,
    Math.max(1, Math.round(10 - (dynamicCostPerPerson / maxBudgetPerPerson) * 3))
  );

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

  // Swap an itinerary stop with an AI-suggested alternative activity
  const handleSwapActivity = (slotIdx: number, newActivity: Activity) => {
    const updated = [...itinerary];
    const oldItem = updated[slotIdx];
    if (!oldItem) return;

    updated[slotIdx] = {
      ...oldItem,
      activity: newActivity,
      notes: `AI Pick: ${newActivity.bestFor}`,
    };

    setCustomOrder({
      planId: currentPlan.id,
      items: updated,
    });

    setSelectedSlotIdx(null);
    setStatusNotice(`✨ Swapped Stop ${slotIdx + 1} to "${newActivity.name}"!`);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  // Generate intelligent AI suggested alternatives for the selected event slot
  const currentSlotItem = selectedSlotIdx !== null ? itinerary[selectedSlotIdx] : null;

  const aiAlternatives = useMemo<AiAlternative[]>(() => {
    if (!currentSlotItem) return [];

    const currentAct = currentSlotItem.activity;
    const inItineraryIds = itinerary.map((i) => i.activity.id);
    const candidates = MOCK_ACTIVITIES.filter(
      (act) => act.id !== currentAct.id && !inItineraryIds.includes(act.id)
    );

    const suggestions: AiAlternative[] = [];

    // 1. Same category alternatives (matching vibe)
    const sameCat = candidates.filter((act) => act.category === currentAct.category);
    sameCat.slice(0, 2).forEach((act) => {
      suggestions.push({
        activity: act,
        reason: `Direct alternative matching the ${act.categoryLabel} vibe`,
        badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
        badgeLabel: '🎯 Matching Vibe',
      });
    });

    // 2. Budget-friendly alternative (saves money)
    const cheaper = candidates
      .filter((act) => act.estimatedCostPerPerson < currentAct.estimatedCostPerPerson)
      .sort((a, b) => a.estimatedCostPerPerson - b.estimatedCostPerPerson);

    if (cheaper.length > 0 && !suggestions.some((s) => s.activity.id === cheaper[0].id)) {
      const saveAmt = currentAct.estimatedCostPerPerson - cheaper[0].estimatedCostPerPerson;
      suggestions.push({
        activity: cheaper[0],
        reason: `Saves ~$${saveAmt}/person for the squad`,
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        badgeLabel: `💰 Saves $${saveAmt}`,
      });
    }

    // 3. Proximity / Same neighborhood
    const sameArea = candidates.filter(
      (act) => act.neighborhood === currentAct.neighborhood && !suggestions.some((s) => s.activity.id === act.id)
    );
    if (sameArea.length > 0) {
      suggestions.push({
        activity: sameArea[0],
        reason: `Zero commute time — located right in ${sameArea[0].neighborhood}`,
        badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
        badgeLabel: '📍 Same Neighborhood',
      });
    }

    // 4. Highest rated Austin venues
    const topRated = candidates
      .filter((act) => !suggestions.some((s) => s.activity.id === act.id))
      .sort((a, b) => b.rating - a.rating);

    topRated.slice(0, 3).forEach((act) => {
      suggestions.push({
        activity: act,
        reason: `Top rated by Austin locals (⭐ ${act.rating} from ${act.reviewCount} reviews)`,
        badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
        badgeLabel: '⭐ High Rating',
      });
    });

    return suggestions;
  }, [currentSlotItem, itinerary]);

  // Filtered alternatives list inside modal based on user tabs/search
  const displayAlternatives = useMemo(() => {
    if (!currentSlotItem) return [];

    let pool: { activity: Activity; reason: string; badgeColor: string; badgeLabel: string }[] = [];

    if (altFilter === 'all') {
      pool = aiAlternatives;
    } else if (altFilter === 'same_vibe') {
      pool = aiAlternatives.filter((s) => s.activity.category === currentSlotItem.activity.category);
    } else if (altFilter === 'budget') {
      pool = aiAlternatives.filter(
        (s) => s.activity.estimatedCostPerPerson < currentSlotItem.activity.estimatedCostPerPerson
      );
    } else {
      // 'browse': all other Austin venues
      const inItineraryIds = itinerary.map((i) => i.activity.id);
      pool = MOCK_ACTIVITIES.filter(
        (act) => act.id !== currentSlotItem.activity.id && !inItineraryIds.includes(act.id)
      ).map((act) => ({
        activity: act,
        reason: `${act.categoryLabel} in ${act.neighborhood}`,
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        badgeLabel: act.categoryLabel,
      }));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return pool.filter(
        (item) =>
          item.activity.name.toLowerCase().includes(q) ||
          item.activity.neighborhood.toLowerCase().includes(q) ||
          item.activity.description.toLowerCase().includes(q)
      );
    }

    return pool;
  }, [currentSlotItem, altFilter, aiAlternatives, itinerary, searchQuery]);

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
      setStatusNotice('📸 Itinerary exported as PNG to your downloads!');
      setTimeout(() => setStatusNotice(null), 5000);
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
      {/* Toast Notification (Export / Swapped Event) */}
      {statusNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            ✕
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
                Live calculated totals based on your current itinerary stops
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                dynamicCostPerPerson <= maxBudgetPerPerson
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {dynamicCostPerPerson <= maxBudgetPerPerson ? 'Within Target Budget' : 'Budget Alert'}
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
              ${dynamicCostPerPerson.toFixed(0)}
            </div>
            <span className="text-[10px] text-slate-400">for {itinerary.length} planned spots</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">
              Total Group Spend
            </span>
            <div className="mt-1 text-xl font-black text-slate-900">
              ${dynamicTotalGroupCost.toFixed(0)}
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
              ${dynamicSavingsPerPerson.toFixed(0)}
            </div>
            <span className="text-[10px] text-emerald-600">vs max target (${maxBudgetPerPerson})</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#FAF7F2]/60 p-3 text-center">
            <span className="text-[11px] font-medium text-slate-500">
              Budget Health Score
            </span>
            <div className="mt-1 text-xl font-black text-blue-700">
              {dynamicHealthScore}/10
            </div>
            <span className="text-[10px] text-slate-400">Financial safety</span>
          </div>
        </div>
      </div>

      {/* Proposed Itinerary Timeline with Click-to-Swap & Drag-and-Drop */}
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
                : 'Click any event to choose AI alternatives, or drag stops to reorder.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isLocked ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200/80 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Click Event to Swap
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
            <div key={`${item.activity.id}-${idx}`} className="relative">
              {/* Timeline marker */}
              <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-700 text-[10px] font-bold text-white ring-4 ring-white shadow-2xs">
                {idx + 1}
              </div>

              {/* Itinerary Card: Clicking opens AI Suggested Alternatives */}
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
                onClick={() => {
                  if (!isLocked) {
                    setSelectedSlotIdx(idx);
                    setAltFilter('all');
                    setSearchQuery('');
                  }
                }}
                className={`group relative rounded-xl border p-4 transition-all duration-150 ${
                  isLocked
                    ? 'cursor-default'
                    : 'cursor-pointer hover:border-teal-500 hover:bg-white hover:shadow-md hover:ring-2 hover:ring-teal-500/20'
                } ${
                  dragOverIndex === idx
                    ? 'border-teal-500 bg-teal-50/80 scale-[1.01] shadow-md ring-2 ring-teal-500/30'
                    : draggedIndex === idx
                    ? 'opacity-40 border-dashed border-teal-400 bg-slate-50'
                    : 'border-slate-200 bg-[#FAF7F2]/40'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isLocked && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-0.5 rounded bg-slate-100/80 px-1.5 py-0.5 text-slate-500 hover:text-slate-800 cursor-grab"
                        title="Drag stop to reorder"
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
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-0.5 ml-1 border-l border-slate-200 pl-1.5"
                      >
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, idx - 1)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          title="Move stop earlier"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === itinerary.length - 1}
                          onClick={() => moveItem(idx, idx + 1)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                          title="Move stop later"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-teal-900 transition">
                      {item.activity.name}
                    </h4>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.activity.location} ({item.activity.neighborhood})</span>
                    </div>
                  </div>

                  {/* Swap button hint */}
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSlotIdx(idx);
                        setAltFilter('all');
                        setSearchQuery('');
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[11px] font-bold text-teal-800 shadow-2xs hover:bg-teal-50 group-hover:border-teal-400 transition"
                      title="Choose other AI suggestions for this slot"
                    >
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>Swap Event</span>
                    </button>
                  )}
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
                  <span className="text-slate-500 italic truncate max-w-[280px]">
                    {item.notes}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    All {item.availableFriendsCount} friends free
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Suggested Alternatives Modal */}
      {selectedSlotIdx !== null && currentSlotItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#E8E2D8] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-800 to-slate-900 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/30 text-amber-300 ring-1 ring-amber-300/40">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">
                      Swap Stop {selectedSlotIdx + 1}: {currentSlotItem.activity.name}
                    </h3>
                    <p className="text-xs text-teal-200">
                      Choose an AI alternative for the {currentSlotItem.timeSlot} time slot.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSlotIdx(null)}
                  className="rounded-lg p-1.5 text-teal-200 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Current Event Pill */}
              <div className="mt-3.5 flex flex-wrap items-center gap-3 rounded-xl bg-white/10 px-3.5 py-2 text-xs">
                <span className="font-semibold text-teal-100">Currently:</span>
                <span className="font-bold text-white">{currentSlotItem.activity.name}</span>
                <span>•</span>
                <span>${currentSlotItem.activity.estimatedCostPerPerson}/person</span>
                <span>•</span>
                <span>{currentSlotItem.activity.neighborhood}</span>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="border-b border-slate-200 bg-[#FAF7F2]/60 px-5 py-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAltFilter('all')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      altFilter === 'all'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ★ AI Recommended ({aiAlternatives.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAltFilter('same_vibe')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      altFilter === 'same_vibe'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Same Vibe ({currentSlotItem.activity.categoryLabel})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAltFilter('budget')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      altFilter === 'budget'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Budget Savers
                  </button>
                  <button
                    type="button"
                    onClick={() => setAltFilter('browse')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      altFilter === 'browse'
                        ? 'bg-teal-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    All Venues
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search venue or tag..."
                    className="w-full sm:w-44 rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Alternatives List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {displayAlternatives.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-sm font-semibold">No matching alternatives found.</p>
                  <p className="text-xs text-slate-400 mt-1">Try switching tabs or clearing your search query.</p>
                </div>
              ) : (
                displayAlternatives.map((alt) => {
                  const costDiff =
                    alt.activity.estimatedCostPerPerson - currentSlotItem.activity.estimatedCostPerPerson;

                  return (
                    <div
                      key={alt.activity.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-500 hover:shadow-sm transition"
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">
                            {alt.activity.name}
                          </h4>
                          <span
                            className={`rounded-full px-2 py-0.2 text-[10px] font-bold border ${alt.badgeColor}`}
                          >
                            {alt.badgeLabel}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {alt.activity.rating}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-teal-800">
                            ${alt.activity.estimatedCostPerPerson}/person
                            {costDiff < 0 && (
                              <span className="text-emerald-700 font-bold ml-1">
                                (saves ${Math.abs(costDiff)})
                              </span>
                            )}
                            {costDiff > 0 && (
                              <span className="text-amber-700 font-medium ml-1">
                                (+${costDiff})
                              </span>
                            )}
                          </span>
                          <span>•</span>
                          <span>{alt.activity.durationMinutes} mins</span>
                          <span>•</span>
                          <span>{alt.activity.neighborhood}</span>
                        </div>

                        <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                          {alt.activity.description}
                        </p>

                        <div className="mt-2 text-[11px] text-teal-700 font-medium italic">
                          💡 {alt.reason}
                        </div>
                      </div>

                      <div className="shrink-0 sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleSwapActivity(selectedSlotIdx, alt.activity)}
                          className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-teal-800 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-teal-900 transition active:scale-[0.98]"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Swap In
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
              <span>Swapping recalculates your group budget and savings in real time.</span>
              <button
                type="button"
                onClick={() => setSelectedSlotIdx(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
