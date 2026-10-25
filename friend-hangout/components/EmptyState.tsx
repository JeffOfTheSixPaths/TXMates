"use client";

import React from "react";
import { RotateCcw, SearchX } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  onReset?: () => void;
  actionText?: string;
}

export function EmptyState({
  title = "No activities match your filters",
  message = "Widen the budget, clear the search, or pick another category.",
  onReset,
  actionText = "Reset filters",
}: EmptyStateProps) {
  return (
    <div className="border border-dashed border-seam px-6 py-14 text-center">
      <SearchX className="mx-auto h-7 w-7 text-ink-soft" aria-hidden />
      <h3 className="mt-3 text-xl font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-prose text-base text-ink-soft">{message}</p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex min-h-11 items-center gap-2 border border-seam bg-sheet px-4 text-base font-semibold text-ink"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {actionText}
        </button>
      )}
    </div>
  );
}
