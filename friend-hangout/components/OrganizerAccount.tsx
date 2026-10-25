'use client';

import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2 } from 'lucide-react';
import { parseInviteInput } from '@/lib/organizerAccount';

const STORAGE_KEY = 'txmates-account';

type SavedAccount = {
  name: string;
  email: string;
  importStatements: boolean;
};

const EMPTY_ACCOUNT: SavedAccount = { name: '', email: '', importStatements: false };

// The saved account lives in localStorage and is read with useSyncExternalStore,
// so the server render and first client render agree (empty) with no hydration mismatch.
const listeners = new Set<() => void>();
let memoryFallback: string | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function getRawAccount(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memoryFallback;
  } catch {
    return memoryFallback;
  }
}

function getServerRawAccount(): string | null {
  return null;
}

function parseSavedAccount(raw: string | null): SavedAccount {
  if (!raw) return EMPTY_ACCOUNT;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedAccount>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      importStatements: parsed.importStatements === true,
    };
  } catch {
    return EMPTY_ACCOUNT;
  }
}

function writeSavedAccount(account: SavedAccount) {
  const raw = JSON.stringify(account);
  memoryFallback = raw;
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Private mode or quota. The fields still work for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribeNoop() {
  return () => {};
}

interface OrganizerAccountProps {
  hangoutId: string;
  onNameChange?: (name: string) => void;
}

export function OrganizerAccount({ hangoutId, onNameChange }: OrganizerAccountProps) {
  const router = useRouter();
  const statementHintId = useId();
  const inviteHintId = useId();
  const rawAccount = useSyncExternalStore(subscribe, getRawAccount, getServerRawAccount);
  const account = useMemo(() => parseSavedAccount(rawAccount), [rawAccount]);
  const { name, email, importStatements } = account;
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => '');
  const [copied, setCopied] = useState(false);
  const [joinValue, setJoinValue] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);

  const invitePath = `/avail/${encodeURIComponent(hangoutId)}`;
  const onNameChangeRef = useRef(onNameChange);
  useEffect(() => {
    onNameChangeRef.current = onNameChange;
  }, [onNameChange]);

  // Keep the first friend slot in sync with the saved name (on load and as it is typed).
  useEffect(() => {
    if (name) onNameChangeRef.current?.(name);
  }, [name]);

  const updateAccount = (patch: Partial<SavedAccount>) => {
    writeSavedAccount({ ...account, ...patch });
  };

  const handleNameChange = (next: string) => {
    updateAccount({ name: next });
  };

  const handleCopyInvite = async () => {
    const absolute = `${window.location.origin}${invitePath}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const handleJoin = (event: React.FormEvent) => {
    event.preventDefault();
    setJoinNotice(null);
    const parsed = parseInviteInput(joinValue);
    if (!parsed) {
      setJoinError('That does not look like a TXMates invite. Paste a link such as /avail/txmates-demo or /h/weekend-crew.');
      return;
    }
    setJoinError(null);
    if (parsed.kind === 'group') {
      router.push(parsed.id === 'txmates-demo' ? '/' : `/h/${encodeURIComponent(parsed.id)}`);
      return;
    }
    if (parsed.id === hangoutId && !parsed.mate) {
      setJoinNotice("That is this hangout's invite. Copy it for mates, or paste a different one.");
      return;
    }
    const href = parsed.mate
      ? `/avail/${parsed.id}?mate=${encodeURIComponent(parsed.mate)}`
      : `/avail/${parsed.id}`;
    router.push(href);
  };

  const fieldClass =
    'w-full border border-seam bg-pine px-3 py-2.5 text-base text-ink placeholder:text-ink-soft';

  return (
    <section className="bg-sheet px-5 py-6 sm:px-7 sm:py-8" aria-labelledby="organizer-account-heading">
      <h2 id="organizer-account-heading" className="text-3xl font-semibold text-ink">
        You
      </h2>
      <p className="mt-2 max-w-prose text-base text-ink-soft">Saved on this device.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-base font-semibold text-ink">
          Name
          <input
            type="text"
            name="organizer-name"
            autoComplete="name"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Marcus W."
            className={`mt-1 ${fieldClass}`}
          />
        </label>
        <label className="block text-base font-semibold text-ink">
          Email
          <input
            type="email"
            name="organizer-email"
            autoComplete="email"
            value={email}
            onChange={(event) => updateAccount({ email: event.target.value })}
            placeholder="you@email.com"
            className={`mt-1 ${fieldClass}`}
          />
        </label>
      </div>

      <div className="mt-8">
        <label htmlFor="organizer-invite" className="block text-base font-semibold text-ink">
          Invite mates
        </label>
        <p id={inviteHintId} className="mt-1 text-sm text-ink-soft">
          Anyone with this link can mark hours.
        </p>
        <div className="mt-2 flex min-h-11 items-stretch border border-seam bg-pine">
          <span className="grid w-11 shrink-0 place-items-center text-ink-soft" aria-hidden>
            <Link2 className="h-4 w-4" />
          </span>
          <span className="hidden shrink-0 items-center text-sm text-ink-soft sm:flex">
            {origin}
          </span>
          <input
            id="organizer-invite"
            type="text"
            readOnly
            value={invitePath}
            aria-describedby={inviteHintId}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent py-2 pr-2 text-base text-ink"
          />
          <button
            type="button"
            onClick={handleCopyInvite}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 bg-ink px-3 text-sm font-semibold text-paper hover:bg-cola"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <details className="mt-6">
        <summary className="cursor-pointer text-base font-semibold text-ink">Have an invite?</summary>
        <form className="mt-3" onSubmit={handleJoin}>
        <p className="text-sm text-ink-soft">Paste a TXMates link from someone else.</p>
        <div className="mt-2 flex min-h-11 items-stretch border border-seam bg-pine">
          <input
            id="organizer-join"
            type="text"
            value={joinValue}
            onChange={(event) => {
              setJoinValue(event.target.value);
              setJoinError(null);
              setJoinNotice(null);
            }}
            placeholder="/avail/txmates-demo"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink placeholder:text-ink-soft"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 shrink-0 items-center bg-ink px-3 text-sm font-semibold text-paper hover:bg-cola"
          >
            Join
          </button>
        </div>
        {joinError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-tomato">
            {joinError}
          </p>
        )}
        {joinNotice && (
          <p role="status" className="mt-2 text-sm font-semibold text-ink">
            {joinNotice}
          </p>
        )}
        </form>
      </details>

      <div className="mt-8 bg-pine px-4 py-4">
        <label className="flex cursor-pointer items-start gap-3 text-base text-ink">
          <input
            type="checkbox"
            checked={importStatements}
            onChange={(event) => updateAccount({ importStatements: event.target.checked })}
            aria-describedby={statementHintId}
            className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-leaf"
          />
          <span>
            <span className="block font-semibold">
              Import Capital One bank statements
            </span>
            <span id={statementHintId} className="mt-1 block text-sm text-ink-soft">
              Recent spending shapes a per-person cap that fits. Balances stay on this device.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
