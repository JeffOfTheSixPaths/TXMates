/**
 * Server-only Nessie client. Import this from route handlers, never from client components.
 * The API key stays in the query string of the outbound request and is not returned.
 */

import {
  budgetFromNessieRecords,
  mapAccount,
  simulatedHangoutBudget,
  toAccountSummary,
} from './nessieBudget';
import type { NessieAccountInput, NessieBudgetResponse, NessieCustomerOption } from './nessieBudget';

const DEFAULT_BASE_URL = 'http://api.nessieisreal.com';
const REQUEST_TIMEOUT_MS = 8000;

type LoadedCustomer = {
  customers: NessieCustomerOption[];
  selected: NessieCustomerOption | null;
  locked: boolean;
};

export async function loadNessieBudget(options: {
  customerId?: string | null;
  accountId?: string | null;
  friendCount?: number;
  now?: Date;
}): Promise<NessieBudgetResponse> {
  const friendCount = Math.max(1, options.friendCount ?? 1);
  const key = process.env.NESSIE_API_KEY?.trim();
  if (!key) {
    return simulatedResponse(
      friendCount,
      'Estimate only. NESSIE_API_KEY is not set, so this cap is not a bank balance.'
    );
  }

  try {
    const loaded = await loadCustomer(key, options.customerId);
    if (!loaded.selected) {
      return simulatedResponse(friendCount, 'Estimate only. Nessie returned no customers for this key.');
    }

    const accountPayload = await nessieGet(`/customers/${loaded.selected.id}/accounts`, key);
    const allAccounts = asList(accountPayload)
      .map(mapAccount)
      .filter((account): account is NessieAccountInput => account !== null);

    const accountLock = parseIdList(process.env.NESSIE_ACCOUNT_ID);
    const requestedAccount = safeId(options.accountId);
    const { accounts, selectedAccountId, accountLocked, notice } = selectAccounts(
      allAccounts,
      accountLock,
      requestedAccount
    );

    if (notice && accounts.length === 0) {
      return simulatedResponse(friendCount, notice, loaded);
    }

    const purchases: unknown[] = [];
    const bills: unknown[] = [];
    await Promise.all(
      accounts.map(async (account) => {
        const [purchasePayload, billPayload] = await Promise.all([
          nessieGet(`/accounts/${account.id}/purchases`, key),
          nessieGet(`/accounts/${account.id}/bills`, key),
        ]);
        purchases.push(...asList(purchasePayload));
        bills.push(...asList(billPayload));
      })
    );

    const estimate = budgetFromNessieRecords({
      accounts,
      purchases,
      bills,
      friendCount,
      now: options.now,
    });

    return {
      source: 'nessie',
      estimate,
      customers: loaded.customers,
      selectedCustomerId: loaded.selected.id,
      customerLocked: loaded.locked,
      accounts: accounts.map(toAccountSummary),
      selectedAccountId,
      accountLocked,
      notice,
    };
  } catch {
    return simulatedResponse(
      friendCount,
      'Estimate only. Nessie did not answer, so this cap is not a bank balance.'
    );
  }
}

async function loadCustomer(key: string, requestedId: string | null | undefined): Promise<LoadedCustomer> {
  const payload = await nessieGet('/customers', key);
  const customers = asList(payload)
    .map(mapCustomer)
    .filter((customer): customer is NessieCustomerOption => customer !== null);
  const pinned = safeId(process.env.NESSIE_CUSTOMER_ID);
  const requested = safeId(requestedId);
  if (pinned) {
    const match = customers.find((customer) => customer.id === pinned);
    return {
      customers,
      selected: match ?? { id: pinned, name: 'Pinned customer' },
      locked: true,
    };
  }
  const selected =
    customers.find((customer) => customer.id === requested) ?? customers[0] ?? null;
  return { customers, selected, locked: false };
}

function selectAccounts(
  allAccounts: NessieAccountInput[],
  lockedIds: string[],
  requestedId: string | null
): {
  accounts: NessieAccountInput[];
  selectedAccountId: string | null;
  accountLocked: boolean;
  notice: string | null;
} {
  if (lockedIds.length > 0) {
    const accounts = allAccounts.filter((account) => lockedIds.includes(account.id));
    if (accounts.length === 0) {
      return {
        accounts: [],
        selectedAccountId: null,
        accountLocked: true,
        notice: 'Estimate only. NESSIE_ACCOUNT_ID did not match an account on this customer.',
      };
    }
    return {
      accounts,
      selectedAccountId: accounts.length === 1 ? accounts[0].id : null,
      accountLocked: true,
      notice: null,
    };
  }

  if (requestedId) {
    const match = allAccounts.filter((account) => account.id === requestedId);
    if (match.length === 1) {
      return {
        accounts: match,
        selectedAccountId: requestedId,
        accountLocked: false,
        notice: null,
      };
    }
  }

  return {
    accounts: allAccounts,
    selectedAccountId: null,
    accountLocked: false,
    notice: null,
  };
}

async function nessieGet(path: string, key: string): Promise<unknown> {
  const base = (process.env.NESSIE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  url.searchParams.set('key', key);
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Nessie request failed with status ${response.status}`);
  }
  return response.json();
}

function simulatedResponse(
  friendCount: number,
  notice: string,
  loaded?: LoadedCustomer
): NessieBudgetResponse {
  return {
    source: 'simulated',
    estimate: simulatedHangoutBudget(friendCount, notice),
    customers: loaded?.customers ?? [],
    selectedCustomerId: loaded?.selected?.id ?? null,
    customerLocked: loaded?.locked ?? false,
    accounts: [],
    selectedAccountId: null,
    accountLocked: false,
    notice,
  };
}

function mapCustomer(raw: unknown): NessieCustomerOption | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record._id === 'string' ? record._id : typeof record.id === 'string' ? record.id : '';
  if (!safeId(id)) return null;
  const first = typeof record.first_name === 'string' ? record.first_name : '';
  const last = typeof record.last_name === 'string' ? record.last_name : '';
  const name = `${first} ${last}`.trim() || 'Customer';
  return { id, name };
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseIdList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => safeId(part.trim()))
    .filter((part): part is string => Boolean(part));
}

export function safeId(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}
