'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Plus,
  Check,
  Star,
  Info,
  Sparkles,
  Bookmark,
  Trash2,
} from 'lucide-react';
import { Activity } from '@/types';
import { ACTIVITY_CATEGORIES, MOCK_ACTIVITIES } from '@/lib/mockData';
import { EmptyState } from './EmptyState';

interface ActivityDiscoveryProps {
  shortlist: Activity[];
  onToggleShortlist: (activity: Activity) => void;
  onClearShortlist: () => void;
  onApplyShortlist: () => void;
  maxBudget: number;
}

export function ActivityDiscovery({
  shortlist,
  onToggleShortlist,
  onClearShortlist,
  onApplyShortlist,
  maxBudget,
}: ActivityDiscoveryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [budgetFilter, setBudgetFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'rating'>('recommended');

  const shortlistedIds = useMemo(
    () => new Set(shortlist.map((a) => a.id)),
    [shortlist]
  );

  // Filter activities
  const filteredActivities = useMemo(() => {
    return MOCK_ACTIVITIES.filter((act) => {
      // Category filter
      if (selectedCategory !== 'all' && act.category !== selectedCategory) {
        return false;
      }

      // Budget filter
      if (budgetFilter !== 'all' && act.estimatedCostPerPerson > budgetFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = act.name.toLowerCase().includes(q);
        const matchesDesc = act.description.toLowerCase().includes(q);
        const matchesNeigh = act.neighborhood.toLowerCase().includes(q);
        const matchesTags = act.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesDesc && !matchesNeigh && !matchesTags) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-low') {
        return a.estimatedCostPerPerson - b.estimatedCostPerPerson;
      }
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      return 0; // default order
    });
  }, [searchQuery, selectedCategory, budgetFilter, sortBy]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setBudgetFilter('all');
    setSortBy('recommended');
  };

  const shortlistTotalPerPerson = shortlist.reduce(
    (sum, a) => sum + a.estimatedCostPerPerson,
    0
  );

  return (
    <div className="rounded-2xl border border-[#E8E2D8] bg-white p-5 shadow-sm sm:p-7">
      {/* Discovery Section Header */}
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Austin Activity Discovery
            </h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              Simulated OpenSerp Demo
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Browse authentic Austin venues and activities. Select any spot to add it to your group shortlist.
          </p>
        </div>

        {/* Demo Notice Disclaimer */}
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-[11px] font-medium text-amber-900">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Demo dataset curated for Austin, TX. Demonstrating search UI without live API calls.</span>
        </div>
      </div>

      {/* Shortlist Floating Status (if items are selected) */}
      {shortlist.length > 0 && (
        <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Bookmark className="h-4 w-4 text-teal-700" />
            <span className="text-xs font-bold text-teal-950">
              Your Shortlist: {shortlist.length} {shortlist.length === 1 ? 'activity' : 'activities'}
            </span>
            <span className="text-xs text-teal-800">
              (${shortlistTotalPerPerson}/person total)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApplyShortlist}
              className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Build Itinerary with Shortlist
            </button>
            <button
              type="button"
              onClick={onClearShortlist}
              title="Clear shortlist"
              className="rounded-lg p-1.5 text-teal-700 hover:bg-teal-200/60 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
          {/* Keyword Search */}
          <div className="relative sm:col-span-6">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Austin spots (e.g. brisket, arcade, lake, jazz)..."
              className="w-full rounded-xl border border-slate-200 bg-[#FAF7F2]/60 py-2 pl-9 pr-3.5 text-xs text-slate-800 placeholder-slate-400 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* Max Cost Filter */}
          <div className="flex items-center gap-1.5 sm:col-span-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Max:</span>
            <select
              value={budgetFilter === 'all' ? 'all' : budgetFilter}
              onChange={(e) =>
                setBudgetFilter(
                  e.target.value === 'all' ? 'all' : Number(e.target.value)
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-[#FAF7F2]/60 py-2 px-2.5 text-xs font-medium text-slate-700 transition focus:border-teal-600 focus:bg-white focus:outline-none"
            >
              <option value="all">Any Cost</option>
              <option value="10">Under $10</option>
              <option value="20">Under $20</option>
              <option value="30">Under $30</option>
              <option value={maxBudget}>Under Group Budget (${maxBudget})</option>
            </select>
          </div>

          {/* Sort By Filter */}
          <div className="flex items-center gap-1.5 sm:col-span-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'recommended' | 'price-low' | 'rating'
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-[#FAF7F2]/60 py-2 px-2.5 text-xs font-medium text-slate-700 transition focus:border-teal-600 focus:bg-white focus:outline-none"
            >
              <option value="recommended">Featured / Match</option>
              <option value="price-low">Lowest Cost First</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              selectedCategory === 'all'
                ? 'bg-teal-800 text-white shadow-2xs'
                : 'border border-slate-200 bg-[#FAF7F2]/60 text-slate-700 hover:border-slate-300'
            }`}
          >
            All Categories ({MOCK_ACTIVITIES.length})
          </button>
          {ACTIVITY_CATEGORIES.map((cat) => {
            const count = MOCK_ACTIVITIES.filter((a) => a.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-teal-800 text-white shadow-2xs'
                    : 'border border-slate-200 bg-[#FAF7F2]/60 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Activities Grid */}
      <div className="mt-6">
        {filteredActivities.length === 0 ? (
          <EmptyState
            title="No activities matched your search"
            message="Try resetting your category or budget filters to explore all Austin recommendations."
            onReset={handleResetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((act) => {
              const isShortlisted = shortlistedIds.has(act.id);
              const isOverBudget = act.estimatedCostPerPerson > maxBudget;

              return (
                <div
                  key={act.id}
                  className={`group relative flex flex-col justify-between rounded-xl border p-4 transition ${
                    isShortlisted
                      ? 'border-teal-600 bg-teal-50/40 shadow-xs ring-1 ring-teal-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {act.categoryLabel}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{act.rating}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({act.reviewCount})
                        </span>
                      </div>
                    </div>

                    {/* Title & Neighborhood */}
                    <h3 className="mt-2 text-sm font-bold text-slate-900 group-hover:text-teal-900 transition">
                      {act.name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                      <span className="truncate">{act.neighborhood}</span>
                    </div>

                    {/* Description */}
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-3">
                      {act.description}
                    </p>

                    {/* Highlights */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {act.highlights.slice(0, 2).map((h) => (
                        <span
                          key={h}
                          className="rounded-md bg-[#FAF7F2] border border-slate-200/80 px-1.5 py-0.5 text-[10px] text-slate-600"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Footer: Cost, Duration, Shortlist CTA */}
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-black text-slate-900">
                            {act.estimatedCostPerPerson === 0 ? 'FREE' : `$${act.estimatedCostPerPerson}`}
                          </span>
                          {act.estimatedCostPerPerson > 0 && (
                            <span className="text-[10px] text-slate-400">/ person</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{act.durationMinutes} mins</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleShortlist(act)}
                        className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                          isShortlisted
                            ? 'bg-teal-700 text-white hover:bg-teal-800'
                            : 'border border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-800 hover:bg-teal-50/50'
                        }`}
                      >
                        {isShortlisted ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-teal-200" />
                            Shortlisted
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Shortlist
                          </>
                        )}
                      </button>
                    </div>

                    {isOverBudget && (
                      <div className="mt-1.5 text-[10px] text-amber-700 font-medium">
                        Above target budget of ${maxBudget}/person
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
