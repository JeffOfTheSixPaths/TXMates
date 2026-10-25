"use client";

import React from "react";
import Link from "next/link";
import { Check, Clock, MapPin, RotateCcw, Share2, Users } from "lucide-react";

interface HeaderProps {
  friendCount: number;
  location: string;
  hasPlan: boolean;
  onReset: () => void;
}

export function Header({ friendCount, location, hasPlan, onReset }: HeaderProps) {
  const [copied, setCopied] = React.useState(false);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-black/30 bg-cola text-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center bg-sun text-sm font-bold text-ink">
            Tx
          </span>
          <span className="text-lg font-semibold tracking-tight">TXMates</span>
        </Link>

        <p className="hidden items-center gap-4 text-sm text-paper-dim md:flex">
          <span className="inline-flex items-center gap-1.5 text-paper">
            <MapPin className="h-4 w-4" aria-hidden />
            {location || "Austin, TX"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-paper">
            <Users className="h-4 w-4" aria-hidden />
            {friendCount} mates
          </span>
          <span>{hasPlan ? "Plan on the table" : "No plan yet"}</span>
        </p>

        <div className="flex items-center gap-2">
          <Link
            href="/avail/txmates-demo"
            target="_blank"
            className="inline-flex min-h-11 items-center gap-1.5 bg-sun px-3 text-sm font-semibold text-ink"
          >
            <Clock className="h-4 w-4" aria-hidden />
            When2Meet
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex min-h-11 items-center gap-1.5 border border-paper/40 px-3 text-sm font-semibold text-paper"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Invite</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-paper-dim"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
