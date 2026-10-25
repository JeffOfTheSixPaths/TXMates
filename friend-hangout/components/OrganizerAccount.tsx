'use client';

import React, { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2 } from 'lucide-react';
import { parseInviteInput } from '@/lib/organizerAccount';

const STORAGE_KEY = 'txmates-account';

type SavedAccount = {
  name: string;
  email: string;
  importStatements: boolean;
};

function readSavedAccount(): SavedAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedAccount>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      importStatements: parsed.importStatements === true,
    };
  } catch {
    return null;
  }
}

function writeSavedAccount(account: SavedAccount) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Private mode or quota. The fields still work for this visit.
  }
}

interface OrganizerAccountProps {
  hangoutId: string;
  onNameChange?: (name: string) => void;
}

export function OrganizerAccount({ hangoutId, onNameChange }: OrganizerAccountProps) {
  const router = useRouter();
  const statementHintId = useId();
  const inviteHintId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [importStatements, setImportStatements] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinValue, setJoinValue] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const invitePath = `/avail/${hangoutId}`;
  const onNameChangeRef = React.useRef(onNameChange);
  onNameChangeRef.current = onNameChange;

  useEffect(() => {
    const saved = readSavedAccount();
    if (saved) {
      setName(saved.name);
      setEmail(saved.email);
      setImportStatements(saved.importStatements);
      if (saved.name) onNameChangeRef.current?.(saved.name);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeSavedAccount({ name, email, importStatements });
  }, [hydrated, name, email, importStatements]);

  const handleNameChange = (next: string) => {
    setName(next);
    onNameChange?.(next);
  };

  const handleCopyInvite = async () => {
    const absolute =
      typeof window === 'undefined' ? invitePath : `${window.location.origin}${invitePath}`;
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
      setJoinError('That does not look like a TXMates invite. Paste a link such as /avail/txmates-demo.');
      return;
    }
    setJoinError(null);
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
    <section className="border border-seam bg-sheet p-5 sm:p-7" aria-labelledby="organizer-account-heading">
      <h2 id="organizer-account-heading" className="text-2xl font-semibold tracking-tight text-ink">
        You
      </h2>
      <p className="mt-1 text-base text-ink-soft">
        Name and email stay on this device. Copy a link for mates, or drop in an invite you were sent.
      </p>

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
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@email.com"
            className={`mt-1 ${fieldClass}`}
          />
        </label>
      </div>

      <div className="mt-6">
        <label htmlFor="organizer-invite" className="block text-base font-semibold text-ink">
          Invite mates
        </label>
        <p id={inviteHintId} className="mt-1 text-sm text-ink-soft">
          Anyone with this link can mark hours on the same hangout.
        </p>
        <div className="mt-2 flex min-h-11 items-stretch border border-seam bg-pine">
          <span className="grid w-11 shrink-0 place-items-center text-ink-soft" aria-hidden>
            <Link2 className="h-4 w-4" />
          </span>
          <span suppressHydrationWarning className="hidden shrink-0 items-center text-sm text-ink-soft sm:flex">
            {typeof window === 'undefined' ? '' : window.location.origin}
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

      <form className="mt-5" onSubmit={handleJoin}>
        <label htmlFor="organizer-join" className="block text-base font-semibold text-ink">
          Have an invite?
        </label>
        <p className="mt-1 text-sm text-ink-soft">Paste a TXMates link from someone else.</p>
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

      <div className="mt-6 border-t border-seam pt-5">
        <label className="flex cursor-pointer items-start gap-3 text-base text-ink">
          <input
            type="checkbox"
            checked={importStatements}
            onChange={(event) => setImportStatements(event.target.checked)}
            aria-describedby={statementHintId}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-leaf"
          />
          <span>
            <span className="font-semibold">
              Import Capital One bank statements to better understand this group's budget
            </span>
            <span id={statementHintId} className="mt-1 block text-sm text-ink-soft">
              {importStatements
                ? 'Marked for this device. A live statement import is not wired yet, so Nessie still uses the demo customer read.'
                : 'Demo only. Checking this remembers the preference. Nothing is sent to Capital One.'}
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
