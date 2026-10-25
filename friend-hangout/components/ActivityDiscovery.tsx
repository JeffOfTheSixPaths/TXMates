'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Plus,
  Check,
  Star,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { Activity, ActivityCategory } from '@/types';
import { ACTIVITY_CATEGORIES, MOCK_ACTIVITIES } from '@/lib/mockData';
import { CATEGORY_ICONS } from './categoryIcons';
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

  const [activities, setActivities] = useState<Activity[]>(MOCK_ACTIVITIES);
  const [isLiveOpenSerp, setIsLiveOpenSerp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (selectedCategory !== 'all') params.set('category', selectedCategory);

        const res = await fetch(`/api/discovery?${params.toString()}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data.activities)) {
            setActivities(data.activities);
            setIsLiveOpenSerp(Boolean(data.isLive));
          }
        } else if (!cancelled) {
          setIsLiveOpenSerp(false);
        }
      } catch {
        if (!cancelled) setIsLiveOpenSerp(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    }

    const timer = setTimeout(loadActivities, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedCategory]);

  const shortlistedIds = useMemo(
    () => new Set(shortlist.map((a) => a.id)),
    [shortlist]
  );

  const filteredActivities = useMemo(() => {
    return activities
      .filter((act) => {
        if (budgetFilter !== 'all' && act.estimatedCostPerPerson > budgetFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') {
          return a.estimatedCostPerPerson - b.estimatedCostPerPerson;
        }
        if (sortBy === 'rating') {
          return b.rating - a.rating;
        }
        return 0;
      });
  }, [activities, budgetFilter, sortBy]);

  const handleResetFilters = () => {
    if (searchQuery || selectedCategory !== 'all') setIsLoading(true);
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
    <section aria-busy={isLoading}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Austin spots</h2>
          <p className="mt-1 max-w-prose text-base text-ink-soft">
            Search waits on a local OpenSERP server before this list is treated as final.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p role="status" className="mt-4 border border-seam bg-sheet px-4 py-3 text-base text-ink">
          {hasLoaded
            ? 'Checking OpenSERP again. The list below is the last answer, not a new one yet.'
            : 'Asking OpenSERP at 127.0.0.1:7000. A local search can take several seconds. The demo catalog stays hidden until it answers or the request times out.'}
        </p>
      ) : isLiveOpenSerp ? (
        <p role="status" className="mt-4 bg-leaf px-4 py-3 text-base text-white">
          Live OpenSERP results. Prices and hours are still estimates. Open the source link before you commit.
        </p>
      ) : (
        <p role="status" className="mt-4 bg-sun px-4 py-3 text-base text-ink">
          Demo catalog, not a live search. OpenSERP was offline or slower than the timeout, so these are the curated Austin places.
        </p>
      )}

      {shortlist.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-seam bg-sheet px-4 py-3 text-ink">
          <p className="text-base">
            <span className="font-semibold tabular-nums">{shortlist.length}</span> shortlisted, about ${shortlistTotalPerPerson} a person.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApplyShortlist}
              className="inline-flex min-h-11 items-center bg-ink px-3 text-base font-semibold text-paper"
            >
              Use this shortlist
            </button>
            <button
              type="button"
              onClick={onClearShortlist}
              className="inline-flex min-h-11 items-center gap-1.5 px-2 text-base font-semibold"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              const next = e.target.value;
              if (next !== searchQuery) setIsLoading(true);
              setSearchQuery(next);
            }}
            placeholder="Brisket, arcade, lake, jazz"
            aria-label="Search Austin venues"
            className="w-full border border-seam bg-sheet py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-ink-soft"
          />
        </div>
        <label className="flex items-center gap-2 text-base text-ink-soft sm:col-span-3">
          <span className="shrink-0">Max</span>
          <select
            value={budgetFilter === 'all' ? 'all' : budgetFilter}
            onChange={(e) =>
              setBudgetFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="w-full border border-seam bg-sheet px-2 py-2.5 text-base text-ink"
          >
            <option value="all">Any cost</option>
            <option value="10">Under $10</option>
            <option value="20">Under $20</option>
            <option value="30">Under $30</option>
            <option value={maxBudget}>Under the ${maxBudget} cap</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-base text-ink-soft sm:col-span-3">
          <span className="shrink-0">Sort</span>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'recommended' | 'price-low' | 'rating')
            }
            className="w-full border border-seam bg-sheet px-2 py-2.5 text-base text-ink"
          >
            <option value="recommended">Featured</option>
            <option value="price-low">Lowest cost</option>
            <option value="rating">Highest rated</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            if (selectedCategory !== 'all') setIsLoading(true);
            setSelectedCategory('all');
          }}
          className={`min-h-11 px-3 text-base font-semibold ${
            selectedCategory === 'all' ? 'bg-ink text-paper' : 'border border-seam bg-sheet text-ink'
          }`}
        >
          All
        </button>
        {ACTIVITY_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id as ActivityCategory];
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              type="button"
              key={cat.id}
              onClick={() => {
                if (selectedCategory !== cat.id) setIsLoading(true);
                setSelectedCategory(cat.id);
              }}
              className={`inline-flex min-h-11 items-center gap-2 px-3 text-base font-semibold ${
                isSelected ? 'bg-ink text-paper' : 'border border-seam bg-sheet text-ink'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {isLoading && !hasLoaded ? null : filteredActivities.length === 0 ? (
          <EmptyState
            title="Nothing matched"
            message="Reset the category or budget to see the Austin list again."
            onReset={handleResetFilters}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-px bg-seam sm:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((act) => {
              const isShortlisted = shortlistedIds.has(act.id);
              const isOverBudget = act.estimatedCostPerPerson > maxBudget;
              return (
                <li
                  key={act.id}
                  className={`flex flex-col p-4 ${isShortlisted ? 'bg-sun-soft' : 'bg-sheet'}`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">{act.categoryLabel}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums text-ink">
                      <Star className="h-4 w-4 fill-sun text-ink" aria-hidden />
                      {act.rating}
                      <span className="text-ink-soft">({act.reviewCount})</span>
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-ink">{act.name}</h3>
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{act.neighborhood}</span>
                  </p>
                  <p className="mt-2 flex-1 text-base text-ink">{act.description}</p>
                  {act.uncertainties && act.uncertainties.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm text-ink">
                      {act.uncertainties.map((note) => (
                        <li key={note}>Estimate: {note}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-seam pt-3">
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-ink">
                        {act.estimatedCostPerPerson === 0 ? 'Free' : `~$${act.estimatedCostPerPerson}`}
                      </p>
                      <p className="inline-flex items-center gap-1 text-sm text-ink-soft">
                        <Clock className="h-4 w-4" aria-hidden />
                        {act.durationMinutes} min
                      </p>
                      {isOverBudget && (
                        <p className="text-sm font-semibold text-tomato">Above the ${maxBudget} cap</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {act.sourceUrl && (
                        <a
                          href={act.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${act.name}`}
                          className="grid h-11 w-11 place-items-center border border-seam text-ink"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleShortlist(act)}
                        className={`inline-flex min-h-11 items-center gap-1.5 px-3 text-base font-semibold ${
                          isShortlisted ? 'bg-ink text-paper' : 'border border-seam text-ink'
                        }`}
                      >
                        {isShortlisted ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden />
                            Saved
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" aria-hidden />
                            Shortlist
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
