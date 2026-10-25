"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  MapPin,
  RotateCcw,
  Share2,
  Users,
  ChevronDown,
  Plus,
  Layers,
} from "lucide-react";
import type { HangoutSummary } from "@/types";

interface HeaderProps {
  friendCount: number;
  location: string;
  hasPlan: boolean;
  onReset: () => void;
  hangoutId?: string;
  groupName?: string;
}

export function Header({
  friendCount,
  location,
  hasPlan,
  onReset,
  hangoutId = "txmates-demo",
  groupName,
}: HeaderProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [groups, setGroups] = useState<HangoutSummary[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupLocation, setNewGroupLocation] = useState("Austin, TX");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/hangouts?list=true")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { hangouts?: HangoutSummary[] } | null) => {
        if (!cancelled && data?.hangouts) {
          setGroups(data.hangouts);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [hangoutId]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/hangouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          groupName: newGroupName.trim(),
          location: newGroupLocation.trim() || "Austin, TX",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setNewGroupName("");
        if (data.id) {
          router.push(`/h/${data.id}`);
        }
      }
    } catch (err) {
      console.error("Error creating new group:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const currentDisplayName =
    groupName ||
    groups.find((g) => g.id === hangoutId)?.groupName ||
    (hangoutId === "txmates-demo" ? "Austin Weekend Crew" : hangoutId);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/30 bg-cola text-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center bg-sun text-sm font-bold text-ink">
                Tx
              </span>
              <span className="text-lg font-semibold tracking-tight">TXMates</span>
            </Link>

            {/* Multi-group switcher dropdown */}
            <div className="relative ml-2">
              <button
                type="button"
                onClick={() => setShowDropdown((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded border border-paper/20 bg-cola-soft px-2.5 py-1 text-xs font-semibold text-paper hover:border-paper/40"
              >
                <Layers className="h-3.5 w-3.5 text-sun" />
                <span className="max-w-[140px] truncate sm:max-w-[200px]">
                  {currentDisplayName}
                </span>
                <ChevronDown className="h-3 w-3 text-paper-dim" />
              </button>

              {showDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-64 rounded border border-seam bg-sheet text-ink shadow-xl z-50 p-2">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                    Your Groups
                  </div>
                  <div className="mt-1 max-h-56 overflow-y-auto space-y-0.5">
                    {groups.map((g) => {
                      const isCurrent = g.id === hangoutId;
                      const href = g.id === "txmates-demo" ? "/" : `/h/${g.id}`;
                      return (
                        <Link
                          key={g.id}
                          href={href}
                          onClick={() => setShowDropdown(false)}
                          className={`flex items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                            isCurrent
                              ? "bg-sun/20 font-bold text-ink"
                              : "hover:bg-pine text-ink"
                          }`}
                        >
                          <span className="truncate">{g.groupName}</span>
                          <span className="text-[10px] text-ink-soft">
                            {g.friendCount} mates
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mt-2 border-t border-seam pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDropdown(false);
                        setShowCreateModal(true);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded bg-sun px-2 py-1.5 text-xs font-bold text-ink hover:opacity-90"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create New Group
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

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
              href={`/avail/${hangoutId}`}
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
              className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-paper-dim hover:text-paper"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* Modal to create a new group */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded border border-seam bg-sheet p-6 shadow-2xl">
            <h3 className="text-xl font-bold tracking-tight text-ink">
              Create New Hangout Group
            </h3>
            <p className="mt-1 text-sm text-ink-soft">
              Every group gets a separate When2Meet invite link and isolated itinerary recommendations.
            </p>

            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Austin Tech Brunchers"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="mt-1 w-full border border-seam bg-pine px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
                  City / Location
                </label>
                <input
                  type="text"
                  placeholder="Austin, TX"
                  value={newGroupLocation}
                  onChange={(e) => setNewGroupLocation(e.target.value)}
                  className="mt-1 w-full border border-seam bg-pine px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-seam">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded border border-seam px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-pine"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || isCreating}
                  className="rounded bg-sun px-4 py-1.5 text-xs font-bold text-ink hover:opacity-90 disabled:opacity-40"
                >
                  {isCreating ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
