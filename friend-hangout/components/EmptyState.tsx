'use client';

import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  onReset?: () => void;
  actionText?: string;
}

export function EmptyState({
  title = 'No activities match your filters',
  message = 'Try relaxing your budget filter, clearing search keywords, or selecting more activity categories.',
  onReset,
  actionText = 'Reset Search Filters',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E8E2D8] bg-white/70 py-12 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <SearchX className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <RotateCcw className="h-3.5 w-3.5 text-teal-600" />
          {actionText}
        </button>
      )}
    </div>
  );
}
