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
import { formatActivityPrice, formatAge, formatEventSpan } from '@/lib/activityFormat';
import { ACTIVITY_CATEGORIES } from '@/lib/mockData';
import { CATEGORY_ICONS } from './categoryIcons';
import { EmptyState } from './EmptyState';

interface ActivityDiscoveryProps {
  shortlist: Activity[];
  onToggleShortlist: (activity: Activity) => void;
  onClearShortlist: () => void;
  onApplyShortlist: () => void;
  maxBudget: number;
  location?: string;
  onLocationChange?: (location: string) => void;
}

export function ActivityDiscovery({
  shortlist,
  onToggleShortlist,
  onClearShortlist,
  onApplyShortlist,
  maxBudget,
  location,
  onLocationChange,
}: ActivityDiscoveryProps) {
  const currentLocation = location || 'Austin, TX';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [budgetFilter, setBudgetFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'rating'>('recommended');

  const [activities, setActivities] = useState<Activity[]>([]);
  const [source, setSource] = useState<'openserp' | 'saved' | 'fallback' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    async function loadActivities() {
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (selectedCategory !== 'all') params.set('category', selectedCategory);
        if (currentLocation.trim()) params.set('location', currentLocation.trim());

        const res = await fetch(`/api/discovery?${params.toString()}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data.activities)) {
            setActivities(data.activities);
            setSource(data.source === 'openserp' || data.source === 'saved' ? data.source : 'fallback');
            setNotice(typeof data.notice === 'string' ? data.notice : null);
            setRefreshing(Boolean(data.refreshing));
          }
          if (data.refreshing && polls < 3 && !cancelled) {
            polls += 1;
            pollTimer = setTimeout(() => {
              if (!cancelled) void loadActivities();
            }, 6000);
          }
        } else if (!cancelled) {
          setSource('fallback');
          setRefreshing(false);
        }
      } catch {
        if (!cancelled) {
          setSource('fallback');
          setRefreshing(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    }

    const timer = setTimeout(() => {
      void loadActivities();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [searchQuery, selectedCategory, currentLocation]);

  const shortlistedIds = useMemo(
    () => new Set(shortlist.map((a) => a.id)),
    [shortlist]
  );

  const filteredActivities = useMemo(() => {
    return activities
      .filter((act) => {
        if (budgetFilter !== 'all' && act.priceListed !== false && act.estimatedCostPerPerson > budgetFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') {
          const unknownA = a.priceListed === false ? 1 : 0;
          const unknownB = b.priceListed === false ? 1 : 0;
          if (unknownA !== unknownB) return unknownA - unknownB;
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

  const shortlistHasUnlistedPrice = shortlist.some((activity) => activity.priceListed === false);
  const shortlistTotalPerPerson = shortlist.reduce(
    (sum, activity) => sum + (activity.priceListed === false ? 0 : activity.estimatedCostPerPerson),
    0
  );

  return (
    <section aria-busy={isLoading}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{currentLocation.split(',')[0].trim() || 'Local'} spots</h2>
          <p className="mt-1 max-w-prose text-base text-ink-soft">
            Saved spots show up immediately. OpenSERP runs again when this search is more than a few hours old.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p role="status" className="mt-4 border border-seam bg-sheet px-4 py-3 text-base text-ink">
          {hasLoaded
            ? 'Checking saved spots again. The list below is the last answer, not a new one yet.'
            : 'Checking saved spots. A new OpenSERP search can take about 15 seconds.'}
        </p>
      ) : (
        <p
          role="status"
          className={`mt-4 px-4 py-3 text-base ${source === 'openserp' ? 'bg-leaf text-white' : source === 'saved' ? 'border border-seam bg-sheet text-ink' : 'bg-sun text-ink'}`}
        >
          {notice ||
            (source === 'openserp'
              ? 'Live OpenSERP results, saved on this machine. Prices and hours are still estimates.'
              : source === 'saved'
                ? refreshing
                  ? 'Saved spots are on screen. OpenSERP is refreshing this search in the background.'
                  : 'Saved spots from this machine.'
                : 'Demo catalog. OpenSERP did not answer and nothing is saved for this search yet.')}
        </p>
      )}

      {shortlist.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-seam bg-sheet px-4 py-3 text-ink">
          <p className="text-base">
            <span className="font-semibold tabular-nums">{shortlist.length}</span> shortlisted, about ${shortlistTotalPerPerson} a person
            {shortlistHasUnlistedPrice ? ', plus events whose ticket price was not listed' : ''}.
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
        <div className="relative sm:col-span-3">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            type="text"
            value={currentLocation}
            onChange={(e) => onLocationChange?.(e.target.value)}
            placeholder="Austin, TX"
            aria-label="City or area"
            className="w-full border border-seam bg-sheet py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-ink-soft"
          />
        </div>
        <div className="relative sm:col-span-4">
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
            aria-label="Search venues"
            className="w-full border border-seam bg-sheet py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-ink-soft"
          />
        </div>
        <label className="flex items-center gap-2 text-base text-ink-soft sm:col-span-2">
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
              const isOverBudget = act.priceListed !== false && act.estimatedCostPerPerson > maxBudget;
              const eventWhen = formatEventSpan(act.startDate, act.endDate);
              const freshness =
                act.resultFreshness === 'live'
                  ? 'Live'
                  : act.resultFreshness === 'saved'
                    ? `Saved, last seen ${formatAge(act.lastSeen) || 'earlier'}`
                    : act.resultFreshness === 'catalog'
                      ? 'Austin calendar'
                      : 'Demo';
              const kindLabel =
                act.kind === 'event'
                  ? `Event${eventWhen ? `, ${eventWhen}` : ', date not listed'}`
                  : act.kind === 'place'
                    ? 'Place'
                    : '';
              return (
                <li
                  key={act.id}
                  className={`flex flex-col p-4 ${isShortlisted ? 'bg-sun-soft' : 'bg-sheet'}`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-ink">{act.categoryLabel}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums text-ink">
                      {act.reviewCount > 0 ? (
                        <>
                          <Star className="h-4 w-4 fill-sun text-ink" aria-hidden />
                          {act.rating}
                          <span className="text-ink-soft">({act.reviewCount})</span>
                        </>
                      ) : (
                        <span className="text-ink-soft">No rating saved</span>
                      )}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-ink">{act.name}</h3>
                  <p className="mt-1 text-sm text-ink">
                    {freshness}
                    {kindLabel ? ` · ${kindLabel}` : ''}
                    {act.museEnriched ? ' · Muse' : ''}
                  </p>
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
                        {formatActivityPrice(act)}
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
