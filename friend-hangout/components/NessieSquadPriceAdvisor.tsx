'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import type { SquadPricePointResponse } from '@/types';

interface NessieSquadPriceAdvisorProps {
  advisory: SquadPricePointResponse | null;
  loading: boolean;
  currentBudget: number;
  onApplyGroupTarget: (amount: number) => void;
  friendNames?: string[];
}

export function NessieSquadPriceAdvisor({
  advisory,
  loading,
  currentBudget,
  onApplyGroupTarget,
  friendNames = [],
}: NessieSquadPriceAdvisorProps) {
  const [appliedNotice, setAppliedNotice] = useState(false);

  if (loading && !advisory) {
    return (
      <div className="mt-4 border border-seam bg-pine p-4">
        <div className="flex items-center gap-2 text-ink">
          <Sparkles className="h-4 w-4 animate-spin text-sun" aria-hidden />
          <span className="text-base font-semibold">
            Estimating inclusive group price point via Nessie & Meta Muse Spark…
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Privately evaluating squad members’ spending limits to suggest a fair overall budget.
        </p>
      </div>
    );
  }

  if (!advisory) return null;

  const target = advisory.groupPricePoint;
  const totalPool = advisory.groupTotalPool;
  const isCurrentlyTarget = currentBudget === target;

  const handleApply = () => {
    onApplyGroupTarget(target);
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 3000);
  };

  return (
    <div className="mt-5 border-2 border-seam bg-sheet p-4 sm:p-5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-seam pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center bg-sun text-ink">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h4 className="text-base font-semibold text-ink">
              Squad Price Recommendation
            </h4>
            <p className="text-xs text-ink-soft">
              {advisory.isLive ? 'Meta Muse Spark 1.3 intelligence' : 'Nessie financial capacity analysis'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span
            className={`px-2 py-0.5 ${
              advisory.source === 'nessie'
                ? 'bg-leaf text-white'
                : 'bg-seam text-ink-soft'
            }`}
          >
            {advisory.source === 'nessie' ? 'Capital One Nessie' : 'Simulated'}
          </span>
          {advisory.isLive && (
            <span className="bg-sun px-2 py-0.5 text-ink">
              Muse Spark
            </span>
          )}
        </div>
      </div>

      {/* Recommended Overall Money Card */}
      <div className="mt-4 flex flex-col gap-3 border border-seam bg-pine p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Recommended Overall Spend
          </span>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-ink">
              ${target}
            </span>
            <span className="text-sm font-semibold text-ink-soft">/ person</span>
            <span className="border border-seam bg-sheet px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
              ${totalPool} total group pool
            </span>
            {isCurrentlyTarget && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-leaf">
                <Check className="h-3.5 w-3.5" aria-hidden /> Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Accommodates everyone&apos;s spending capacity so no friend feels excluded.
          </p>
        </div>

        <div>
          {isCurrentlyTarget ? (
            <div className="inline-flex items-center gap-1.5 border border-leaf bg-leaf/10 px-3 py-2 text-sm font-semibold text-leaf">
              <Check className="h-4 w-4" aria-hidden />
              Applied to hangout
            </div>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex min-h-11 items-center gap-2 bg-tomato px-4 text-sm font-semibold text-white hover:opacity-95"
            >
              <span>Apply Recommended Cap (${target})</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          {appliedNotice && (
            <p className="mt-1 text-right text-xs font-semibold text-leaf">
              Hangout cap updated to ${target}!
            </p>
          )}
        </div>
      </div>

      {/* Rationale & Coordination Guidance */}
      <div className="mt-4 space-y-2.5 text-sm text-ink">
        <p className="leading-relaxed">
          <span className="font-semibold text-ink">Why this amount: </span>
          {advisory.rationale}
        </p>
        {advisory.coordinationTip && (
          <div className="border-l-2 border-sun bg-pine/60 py-1.5 pl-3 text-xs leading-relaxed text-ink">
            <span className="font-semibold text-ink">Group tip: </span>
            {advisory.coordinationTip}
          </div>
        )}
      </div>

      {/* Privacy Guarantee & Included Members */}
      <div className="mt-4 border-t border-seam pt-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <Lock className="h-3.5 w-3.5 text-leaf" aria-hidden />
          <span className="font-semibold text-ink">Privacy Protected:</span>
          <span>Only the overall group amount is revealed. Individual bank balances are confidential.</span>
        </div>
        {friendNames.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-soft">Factored into target:</span>
            {friendNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 border border-seam bg-pine px-2 py-0.5 text-xs font-semibold text-ink"
              >
                <ShieldCheck className="h-3 w-3 text-leaf" />
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
