export type NessieSeedAddress = {
  street_number: string;
  street_name: string;
  city: string;
  state: string;
  zip: string;
};

export type NessieSeedPlan = {
  customer: {
    first_name: string;
    last_name: string;
    address: NessieSeedAddress;
  };
  account: {
    type: 'Checking';
    nickname: string;
    rewards: number;
    balance: number;
  };
  merchants: Array<{
    name: string;
    category: string;
    address: NessieSeedAddress;
    geocode: { lat: number; lng: number };
  }>;
  purchases: Array<{
    merchantName: string;
    medium: 'balance';
    purchase_date: string;
    amount: number;
    status: 'completed';
    description: string;
  }>;
  bills: Array<{
    status: 'recurring';
    payee: string;
    nickname: string;
    payment_date: string;
    recurring_date: number;
    payment_amount: number;
  }>;
};

const AUSTIN: NessieSeedAddress = {
  street_number: '100',
  street_name: 'Congress Ave',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
};

export function buildNessieSeed(now = new Date()): NessieSeedPlan {
  return {
    customer: {
      first_name: 'Demo',
      last_name: 'Organizer',
      address: AUSTIN,
    },
    account: {
      type: 'Checking',
      nickname: 'Hangout checking',
      rewards: 0,
      balance: 2500,
    },
    merchants: [
      {
        name: 'North Loop Streaming',
        category: 'Entertainment',
        address: AUSTIN,
        geocode: { lat: 30.2672, lng: -97.7431 },
      },
      {
        name: 'East Side Grocer',
        category: 'Food',
        address: AUSTIN,
        geocode: { lat: 30.262, lng: -97.724 },
      },
    ],
    purchases: [
      purchase('North Loop Streaming', -90, 15.99, 'Monthly streaming', now),
      purchase('North Loop Streaming', -60, 15.99, 'Monthly streaming', now),
      purchase('North Loop Streaming', -30, 15.99, 'Monthly streaming', now),
      purchase('East Side Grocer', -12, 86, 'Groceries', now),
      purchase('East Side Grocer', -4, 74, 'Groceries', now),
    ],
    bills: [
      {
        status: 'recurring',
        payee: 'Austin Landlord',
        nickname: 'Rent',
        payment_date: iso(addDays(now, 10)),
        recurring_date: 1,
        payment_amount: 900,
      },
      {
        status: 'recurring',
        payee: 'Renter Insurer',
        nickname: 'Annual renter insurance',
        payment_date: iso(addDays(now, 20)),
        recurring_date: 15,
        payment_amount: 180,
      },
    ],
  };
}

export function createdId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record._id === 'string' && record._id) return record._id;
  const created = record.objectCreated;
  if (created && typeof created === 'object') {
    const id = (created as { _id?: unknown })._id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function purchase(
  merchantName: string,
  dayOffset: number,
  amount: number,
  description: string,
  now: Date
): NessieSeedPlan['purchases'][number] {
  return {
    merchantName,
    medium: 'balance',
    purchase_date: iso(addDays(now, dayOffset)),
    amount,
    status: 'completed',
    description,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
