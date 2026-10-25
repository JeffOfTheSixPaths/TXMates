'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  ArrowRight,
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
      <p className="mt-4 flex items-center gap-2 text-base text-ink">
        <Sparkles className="h-4 w-4 animate-spin" aria-hidden />
        <span className="font-semibold">Estimating a squad cap…</span>
      </p>
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
    <div className="mt-6 bg-pine px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-semibold text-ink">Squad cap</h3>
        <p className="text-sm text-ink-soft">
          {advisory.source === 'nessie' ? 'Capital One Nessie' : 'Simulated'}
          {advisory.isLive ? ' · Muse Spark' : ''}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-4xl font-semibold tabular-nums text-ink">${target}</span>
            <span className="text-base text-ink-soft">a person</span>
            <span className="text-base tabular-nums text-ink">${totalPool} for the group</span>
            {isCurrentlyTarget && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-leaf">
                <Check className="h-3.5 w-3.5" aria-hidden /> Applied
              </span>
            )}
          </p>
          <p className="mt-2 max-w-prose text-base text-ink">{advisory.rationale}</p>
        </div>
        <div className="shrink-0">
          {isCurrentlyTarget ? (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-leaf">
              <Check className="h-4 w-4" aria-hidden />
              Applied to this hangout
            </p>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex min-h-11 items-center gap-2 bg-tomato px-4 text-base font-semibold text-white hover:opacity-95"
            >
              <span>Use ${target}</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          {appliedNotice && (
            <p className="mt-1 text-sm font-semibold text-leaf" role="status">
              Cap updated to ${target}.
            </p>
          )}
        </div>
      </div>
      {advisory.coordinationTip && (
        <p className="mt-3 max-w-prose text-base text-ink-soft">{advisory.coordinationTip}</p>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-soft">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden />
        <span>
          Only the group amount is shown.
          {friendNames.length > 0 ? ` Includes ${friendNames.join(', ')}.` : ''} Balances stay private.
        </span>
      </p>
    </div>
  );
}
