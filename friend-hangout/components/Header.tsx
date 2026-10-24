'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, MapPin, Users, Share2, Check, ShieldCheck, Search, Clock } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-[#E8E2D8] bg-[#FAF7F2]/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand & Texas Star Identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 via-teal-800 to-sky-900 shadow-sm ring-2 ring-teal-500/20">
            <span className="text-xl font-black text-amber-300">★</span>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white">
              TX
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-[#0F172A]">
                TXMates
              </span>
              <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-600/20">
                Desktop MVP
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">
              Friend Hangout Planner • Austin, TX Edition
            </p>
          </div>
        </div>

        {/* Integration Architecture Badges */}
        <div className="hidden items-center gap-2 lg:flex">
          <div className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/60 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            <span>Meta Muse Spark</span>
            <span className="rounded bg-emerald-100 px-1 text-[10px] font-bold text-emerald-800">Live v1.3</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>Capital One Nessie</span>
            <span className="rounded bg-blue-50 px-1 text-[10px] text-blue-700">Budget</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs">
            <Search className="h-3.5 w-3.5 text-emerald-600" />
            <span>OpenSerp</span>
            <span className="rounded bg-emerald-50 px-1 text-[10px] text-emerald-700">Events</span>
          </div>
        </div>

        {/* Status indicators & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-3 rounded-full border border-[#E8E2D8] bg-white px-3 py-1 text-xs font-medium text-slate-600 md:flex">
            <span className="flex items-center gap-1 text-teal-700">
              <MapPin className="h-3.5 w-3.5" />
              {location || 'Austin, TX'}
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {friendCount} Mates
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {hasPlan ? 'Plan Generated' : 'Ready'}
            </span>
          </div>

          <Link
            href="/avail/txmates-demo"
            target="_blank"
            title="Open When2Meet friend availability page in new tab"
            className="flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 shadow-2xs hover:bg-teal-100 transition"
          >
            <Clock className="h-3.5 w-3.5 text-teal-700" />
            <span className="hidden md:inline">When2Meet Link</span>
          </Link>

          <button
            onClick={handleShare}
            title="Share hangout link"
            className="flex items-center gap-1.5 rounded-lg border border-[#E8E2D8] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-teal-600" />
                <span className="text-teal-700">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Invite Mates</span>
              </>
            )}
          </button>

          <button
            onClick={onReset}
            title="Reset to default mock scenario"
            className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
