'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowRight,
  CreditCard,
  PiggyBank,
  DollarSign,
  Wallet,
} from 'lucide-react';
import type { SquadPricePointResponse } from '@/types';

interface NessieSquadPriceAdvisorProps {
  advisory: SquadPricePointResponse | null;
  loading: boolean;
  currentBudget: number;
  onApplyGroupTarget: (amount: number) => void;
}

export function NessieSquadPriceAdvisor({
  advisory,
  loading,
  currentBudget,
  onApplyGroupTarget,
}: NessieSquadPriceAdvisorProps) {
  const [showFriendBreakdown, setShowFriendBreakdown] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState(false);

  if (loading && !advisory) {
    return (
      <div className="mt-4 border border-seam bg-pine p-4">
        <div className="flex items-center gap-2 text-ink">
          <Sparkles className="h-4 w-4 animate-spin text-sun" aria-hidden />
          <span className="text-base font-semibold">
            Consulting Meta Muse Spark & Capital One Nessie…
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Analyzing friends’ checking balances, credit debt, recurring bills, and savings to find a fair price point for everyone.
        </p>
      </div>
    );
  }

  if (!advisory) return null;

  const target = advisory.groupPricePoint;
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
              Squad Spending Advisor
            </h4>
            <p className="text-xs text-ink-soft">
              {advisory.isLive ? 'Live Meta Muse Spark 1.3 synthesis' : 'Nessie profile intelligence'}
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
            {advisory.source === 'nessie' ? 'Capital One Nessie' : 'Simulated data'}
          </span>
          {advisory.isLive && (
            <span className="bg-sun px-2 py-0.5 text-ink">
              Muse Spark
            </span>
          )}
        </div>
      </div>

      {/* Recommended Squad Target Card */}
      <div className="mt-4 flex flex-col gap-3 rounded-none border border-seam bg-pine p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Recommended Group Cap
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-ink">
              ${target}
            </span>
            <span className="text-sm font-semibold text-ink-soft">/ person</span>
            {isCurrentlyTarget && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-leaf">
                <Check className="h-3.5 w-3.5" aria-hidden /> Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Anchored to accommodate friends with tighter margins or debt.
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
              <span>Apply Squad Target (${target})</span>
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

      {/* Muse Rationale & Coordination Tip */}
      <div className="mt-4 space-y-2.5 text-sm text-ink">
        <p className="leading-relaxed">
          <span className="font-semibold text-ink">Why this target: </span>
          {advisory.rationale}
        </p>
        {advisory.coordinationTip && (
          <div className="border-l-2 border-sun bg-pine/60 py-1.5 pl-3 text-xs leading-relaxed text-ink">
            <span className="font-semibold text-ink">Coordination tip: </span>
            {advisory.coordinationTip}
          </div>
        )}
      </div>

      {/* Accordion: Friend-by-Friend Breakdown */}
      <div className="mt-4 border-t border-seam pt-3">
        <button
          type="button"
          onClick={() => setShowFriendBreakdown(!showFriendBreakdown)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-ink hover:text-tomato"
          aria-expanded={showFriendBreakdown}
        >
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-ink-soft" aria-hidden />
            View each friend’s Nessie profile & comfort point ({advisory.friends.length})
          </span>
          {showFriendBreakdown ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showFriendBreakdown && (
          <ul className="mt-3 divide-y divide-seam border-t border-seam">
            {advisory.friends.map((friend) => {
              const hasDebt = friend.debt > 0;

              return (
                <li key={friend.friendId} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink">
                        {friend.name}
                      </span>
                      {friend.nessieCustomerId && (
                        <span className="border border-seam bg-pine px-1.5 py-0.2 text-[10px] font-semibold text-ink-soft">
                          Nessie
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-ink-soft">Comfort target: </span>
                      <span className="text-sm font-bold tabular-nums text-ink">
                        ${friend.suggestedPricePoint}
                      </span>
                    </div>
                  </div>

                  {/* Financial indicators pills */}
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 bg-pine px-2 py-0.5 text-ink">
                      <DollarSign className="h-3 w-3 text-ink-soft" />
                      Checking: ${Math.round(friend.checkingBalance).toLocaleString()}
                    </span>

                    {friend.savingsBalance > 0 && (
                      <span className="inline-flex items-center gap-1 bg-pine px-2 py-0.5 text-ink">
                        <PiggyBank className="h-3 w-3 text-leaf" />
                        Savings: ${Math.round(friend.savingsBalance).toLocaleString()}
                      </span>
                    )}

                    {hasDebt && (
                      <span className="inline-flex items-center gap-1 border border-tomato/40 bg-tomato/10 px-2 py-0.5 font-semibold text-tomato">
                        <CreditCard className="h-3 w-3" />
                        Debt: ${Math.round(friend.debt).toLocaleString()}
                      </span>
                    )}

                    {friend.discretionary > 0 && (
                      <span className="inline-flex items-center gap-1 bg-pine px-2 py-0.5 text-ink-soft">
                        Discretionary: ~${Math.round(friend.discretionary).toLocaleString()}/mo
                      </span>
                    )}
                  </div>

                  {/* Friend Insight */}
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {friend.insight}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
