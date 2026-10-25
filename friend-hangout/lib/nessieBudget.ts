/**
 * Pure Nessie budget math. No network and no API key.
 * Recurring charges come from Nessie bills and from purchases that repeat
 * at roughly monthly or yearly intervals. Annual amounts are divided by 12.
 */

export type NessieAccountInput = {
  id: string;
  type: string;
  nickname: string;
  balance: number;
  last4?: string;
};

export type NessiePurchaseInput = {
  id: string;
  accountId: string;
  merchantId?: string;
  description?: string;
  amount: number;
  purchaseDate: string;
  status?: string;
};

export type NessieBillInput = {
  id: string;
  accountId: string;
  payee: string;
  nickname?: string;
  status?: string;
  paymentAmount: number;
  paymentDate?: string;
  recurringDate?: number | null;
  upcomingPaymentDate?: string;
};

export type RecurringCharge = {
  key: string;
  label: string;
  cadence: 'monthly' | 'annual';
  amount: number;
  monthlyAmount: number;
  source: 'bill' | 'purchase';
  occurrences: number;
};

export type HangoutBudgetEstimate = {
  source: 'nessie' | 'simulated';
  balance: number;
  typicalMonthlySpend: number;
  recurringMonthly: number;
  annualChargesMonthly: number;
  upcomingCharges: number;
  safetyBuffer: number;
  discretionary: number;
  suggestedPerPerson: number;
  friendCount: number;
  reasoning: string;
  recurring: RecurringCharge[];
};

export type NessieCustomerOption = {
  id: string;
  name: string;
};

export type NessieAccountSummary = {
  id: string;
  nickname: string;
  type: string;
  balance: number;
  last4: string;
};

export type NessieBudgetResponse = {
  source: 'nessie' | 'simulated';
  estimate: HangoutBudgetEstimate;
  customers: NessieCustomerOption[];
  selectedCustomerId: string | null;
  customerLocked: boolean;
  accounts: NessieAccountSummary[];
  selectedAccountId: string | null;
  accountLocked: boolean;
  notice: string | null;
};

const MONTHLY_GAP = { min: 20, max: 45 };
const ANNUAL_GAP = { min: 300, max: 400 };
const UPCOMING_DAYS = 35;
const SAFETY_RATE = 0.1;
const SAFETY_FLOOR = 50;
const HANGOUT_SHARE = 0.2;
const SUGGESTED_CAP = 150;
const MS_PER_DAY = 86_400_000;

const SIMULATED_REASON =
  'Estimate only. Nessie did not answer, so the hangout cap stays at $50 a person until you change it.';

export function simulatedHangoutBudget(
  friendCount = 1,
  reasoning = SIMULATED_REASON
): HangoutBudgetEstimate {
  return {
    source: 'simulated',
    balance: 0,
    typicalMonthlySpend: 0,
    recurringMonthly: 0,
    annualChargesMonthly: 0,
    upcomingCharges: 0,
    safetyBuffer: 0,
    discretionary: 0,
    suggestedPerPerson: 50,
    friendCount: Math.max(1, friendCount),
    reasoning,
    recurring: [],
  };
}

export function detectRecurringCharges(
  purchases: NessiePurchaseInput[],
  bills: NessieBillInput[],
  now: Date = new Date()
): { recurring: RecurringCharge[]; upcomingCharges: number } {
  const recurring: RecurringCharge[] = [];
  const consumedBillIds = new Set<string>();
  const billLabels: string[] = [];

  const billsByPayee = new Map<string, NessieBillInput[]>();
  for (const bill of bills) {
    if (!isActiveCharge(bill.status) || bill.paymentAmount <= 0) continue;
    const key = normalizeLabel(bill.payee || bill.nickname || bill.id);
    const group = billsByPayee.get(key) ?? [];
    group.push(bill);
    billsByPayee.set(key, group);
  }

  for (const [key, group] of billsByPayee) {
    const explicit = group.filter(isExplicitRecurringBill);
    if (explicit.length === 0) continue;
    const label = chargeLabel(explicit[0]);
    const amount = median(explicit.map((bill) => bill.paymentAmount));
    const annual = isAnnualLabel(label) || cadenceFromDates(datesOf(explicit)) === 'annual';
    recurring.push(toCharge(`bill:${key}`, label, annual ? 'annual' : 'monthly', amount, 'bill', explicit.length));
    billLabels.push(normalizeLabel(label));
    explicit.forEach((bill) => consumedBillIds.add(bill.id));
  }

  for (const [key, group] of billsByPayee) {
    const rest = group.filter((bill) => !consumedBillIds.has(bill.id));
    if (rest.length < 2) continue;
    const cadence = cadenceFromDates(datesOf(rest));
    if (!cadence) continue;
    const label = chargeLabel(rest[0]);
    const amount = median(rest.map((bill) => bill.paymentAmount));
    recurring.push(
      toCharge(`bill-history:${key}`, label, isAnnualLabel(label) ? 'annual' : cadence, amount, 'bill', rest.length)
    );
    billLabels.push(normalizeLabel(label));
    rest.forEach((bill) => consumedBillIds.add(bill.id));
  }

  const purchasesByMerchant = new Map<string, NessiePurchaseInput[]>();
  for (const purchase of purchases) {
    if (!isActiveCharge(purchase.status) || purchase.amount <= 0) continue;
    const merchantKey = purchaseMerchantKey(purchase);
    if (!merchantKey) continue;
    const label = purchaseLabel(purchase);
    if (billLabels.some((bill) => labelsOverlap(bill, normalizeLabel(label)))) continue;
    const group = purchasesByMerchant.get(merchantKey) ?? [];
    group.push(purchase);
    purchasesByMerchant.set(merchantKey, group);
  }

  for (const [key, group] of purchasesByMerchant) {
    const events = collapseByDay(group);
    if (events.length < 2) continue;
    const gaps = gapsBetween(events.map((event) => event.day));
    const cadence = classifyGaps(gaps);
    if (!cadence) continue;
    const label = purchaseLabel(group[0]);
    const amount = median(events.map((event) => event.amount));
    recurring.push(
      toCharge(`purchase:${key}`, label, isAnnualLabel(label) ? 'annual' : cadence, amount, 'purchase', events.length)
    );
  }

  const today = startOfUtcDay(now);
  let upcomingCharges = 0;
  for (const bill of bills) {
    if (consumedBillIds.has(bill.id)) continue;
    if (!isActiveCharge(bill.status) || bill.paymentAmount <= 0) continue;
    const due = firstDate(bill.upcomingPaymentDate, bill.paymentDate);
    if (due === null) continue;
    const days = Math.round((due - today) / MS_PER_DAY);
    if (days >= 0 && days <= UPCOMING_DAYS) upcomingCharges += bill.paymentAmount;
  }

  return { recurring, upcomingCharges: roundMoney(upcomingCharges) };
}

export function estimateHangoutBudget(input: {
  accounts: NessieAccountInput[];
  purchases: NessiePurchaseInput[];
  bills: NessieBillInput[];
  friendCount?: number;
  now?: Date;
}): HangoutBudgetEstimate {
  const now = input.now ?? new Date();
  const friendCount = Math.max(1, input.friendCount ?? 1);
  const { recurring, upcomingCharges } = detectRecurringCharges(input.purchases, input.bills, now);
  const balance = roundMoney(spendableBalance(input.accounts));
  const typicalMonthlySpend = roundMoney(
    typicalMonthlyNonRecurring(input.purchases, recurring)
  );
  const recurringMonthly = roundMoney(
    recurring.reduce((sum, charge) => sum + charge.monthlyAmount, 0)
  );
  const annualChargesMonthly = roundMoney(
    recurring
      .filter((charge) => charge.cadence === 'annual')
      .reduce((sum, charge) => sum + charge.monthlyAmount, 0)
  );
  const safetyBuffer =
    balance > 0 ? Math.min(balance, Math.max(SAFETY_FLOOR, Math.round(balance * SAFETY_RATE))) : 0;
  const discretionary = roundMoney(
    Math.max(0, balance - typicalMonthlySpend - recurringMonthly - upcomingCharges - safetyBuffer)
  );
  const suggestedPerPerson = roundToFive(Math.min(SUGGESTED_CAP, discretionary * HANGOUT_SHARE));

  return {
    source: 'nessie',
    balance,
    typicalMonthlySpend,
    recurringMonthly,
    annualChargesMonthly,
    upcomingCharges,
    safetyBuffer,
    discretionary,
    suggestedPerPerson,
    friendCount,
    reasoning: formatReasoning({
      balance,
      typicalMonthlySpend,
      recurringMonthly,
      annualChargesMonthly,
      suggestedPerPerson,
    }),
    recurring,
  };
}

export function budgetFromNessieRecords(input: {
  accounts: unknown[];
  purchases: unknown[];
  bills: unknown[];
  friendCount?: number;
  now?: Date;
}): HangoutBudgetEstimate {
  return estimateHangoutBudget({
    accounts: input.accounts.map(mapAccount).filter((account): account is NessieAccountInput => account !== null),
    purchases: input.purchases
      .map(mapPurchase)
      .filter((purchase): purchase is NessiePurchaseInput => purchase !== null),
    bills: input.bills.map(mapBill).filter((bill): bill is NessieBillInput => bill !== null),
    friendCount: input.friendCount,
    now: input.now,
  });
}

export function mapAccount(raw: unknown): NessieAccountInput | null {
  const record = asRecord(raw);
  if (!record) return null;
  const balance = asNumber(record.balance);
  const id = asString(record._id) || asString(record.id);
  if (!id || balance === null) return null;
  return {
    id,
    type: asString(record.type) || 'Checking',
    nickname: asString(record.nickname),
    balance,
    last4: last4(asString(record.account_number)),
  };
}

export function mapPurchase(raw: unknown): NessiePurchaseInput | null {
  const record = asRecord(raw);
  if (!record) return null;
  const amount = asNumber(record.amount);
  const purchaseDate = asString(record.purchase_date);
  const id = asString(record._id) || asString(record.id);
  if (!id || amount === null || !purchaseDate) return null;
  return {
    id,
    accountId: asString(record.account_id),
    merchantId: asString(record.merchant_id) || undefined,
    description: asString(record.description) || undefined,
    amount,
    purchaseDate,
    status: asString(record.status) || undefined,
  };
}

export function mapBill(raw: unknown): NessieBillInput | null {
  const record = asRecord(raw);
  if (!record) return null;
  const paymentAmount = asNumber(record.payment_amount);
  const id = asString(record._id) || asString(record.id);
  if (!id || paymentAmount === null) return null;
  const recurringDate = asNumber(record.recurring_date);
  return {
    id,
    accountId: asString(record.account_id),
    payee: asString(record.payee),
    nickname: asString(record.nickname) || undefined,
    status: asString(record.status) || undefined,
    paymentAmount,
    paymentDate: asString(record.payment_date) || undefined,
    recurringDate,
    upcomingPaymentDate: asString(record.upcoming_payment_date) || undefined,
  };
}

export function toAccountSummary(account: NessieAccountInput): NessieAccountSummary {
  return {
    id: account.id,
    nickname: account.nickname || account.type,
    type: account.type,
    balance: account.balance,
    last4: account.last4 || '',
  };
}

function formatReasoning(input: {
  balance: number;
  typicalMonthlySpend: number;
  recurringMonthly: number;
  annualChargesMonthly: number;
  suggestedPerPerson: number;
}): string {
  const recurring =
    input.annualChargesMonthly > 0
      ? `recurring ~$${dollars(input.recurringMonthly)}/mo incl. annual charges`
      : `recurring ~$${dollars(input.recurringMonthly)}/mo`;
  return `Balance $${dollars(input.balance)}, typical spending ~$${dollars(input.typicalMonthlySpend)}/mo, ${recurring}, suggested hangout budget $${dollars(input.suggestedPerPerson)}/person.`;
}

function spendableBalance(accounts: NessieAccountInput[]): number {
  let liquid = 0;
  for (const account of accounts) {
    const type = account.type.toLowerCase();
    if (type.includes('credit')) {
      if (account.balance > 0) liquid -= account.balance;
      continue;
    }
    if (type.includes('checking') || type.includes('savings') || type.length === 0) {
      liquid += account.balance;
    }
  }
  return liquid;
}

function typicalMonthlyNonRecurring(
  purchases: NessiePurchaseInput[],
  recurring: RecurringCharge[]
): number {
  const recurringKeys = new Set(
    recurring.filter((charge) => charge.source === 'purchase').map((charge) => charge.key.replace(/^purchase:/, ''))
  );
  const byMonth = new Map<string, number>();
  for (const purchase of purchases) {
    if (!isActiveCharge(purchase.status) || purchase.amount <= 0) continue;
    const merchantKey = purchaseMerchantKey(purchase);
    if (merchantKey && recurringKeys.has(merchantKey)) continue;
    const month = purchase.purchaseDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    byMonth.set(month, (byMonth.get(month) ?? 0) + purchase.amount);
  }
  if (byMonth.size === 0) return 0;
  const total = [...byMonth.values()].reduce((sum, value) => sum + value, 0);
  return total / byMonth.size;
}

function toCharge(
  key: string,
  label: string,
  cadence: 'monthly' | 'annual',
  amount: number,
  source: 'bill' | 'purchase',
  occurrences: number
): RecurringCharge {
  const normalized = roundMoney(amount);
  return {
    key,
    label,
    cadence,
    amount: normalized,
    monthlyAmount: roundMoney(cadence === 'annual' ? normalized / 12 : normalized),
    source,
    occurrences,
  };
}

function isExplicitRecurringBill(bill: NessieBillInput): boolean {
  const status = (bill.status || '').toLowerCase();
  if (status === 'recurring') return true;
  return typeof bill.recurringDate === 'number' && bill.recurringDate >= 1 && bill.recurringDate <= 31;
}

function isActiveCharge(status: string | undefined): boolean {
  const value = (status || '').toLowerCase();
  return value !== 'cancelled' && value !== 'canceled';
}

function isAnnualLabel(label: string): boolean {
  return /\b(annual|annually|yearly|per year|once a year)\b/i.test(label);
}

function chargeLabel(bill: NessieBillInput): string {
  return (bill.nickname || bill.payee || 'Bill').trim();
}

function purchaseLabel(purchase: NessiePurchaseInput): string {
  return (purchase.description || purchase.merchantId || 'Purchase').trim();
}

function purchaseMerchantKey(purchase: NessiePurchaseInput): string | null {
  if (purchase.merchantId) return `merchant:${purchase.merchantId}`;
  const description = normalizeLabel(purchase.description || '');
  if (description.length < 2) return null;
  return `desc:${description}`;
}

function datesOf(bills: NessieBillInput[]): number[] {
  return bills
    .map((bill) => firstDate(bill.paymentDate, bill.upcomingPaymentDate))
    .filter((day): day is number => day !== null)
    .sort((a, b) => a - b);
}

function cadenceFromDates(days: number[]): 'monthly' | 'annual' | null {
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length < 2) return null;
  return classifyGaps(gapsBetween(unique));
}

function classifyGaps(gaps: number[]): 'monthly' | 'annual' | null {
  if (gaps.length === 0) return null;
  const mid = median(gaps);
  const monthlyHits = gaps.filter((gap) => gap >= MONTHLY_GAP.min && gap <= MONTHLY_GAP.max).length;
  const annualHits = gaps.filter((gap) => gap >= ANNUAL_GAP.min && gap <= ANNUAL_GAP.max).length;
  const needed = Math.ceil(gaps.length * 0.6);
  if (monthlyHits >= needed && mid >= MONTHLY_GAP.min && mid <= MONTHLY_GAP.max) return 'monthly';
  if (annualHits >= needed && mid >= ANNUAL_GAP.min && mid <= ANNUAL_GAP.max) return 'annual';
  return null;
}

function collapseByDay(purchases: NessiePurchaseInput[]): { day: number; amount: number }[] {
  const byDay = new Map<number, number>();
  for (const purchase of purchases) {
    const day = parseDay(purchase.purchaseDate);
    if (day === null) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + purchase.amount);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, amount]) => ({ day, amount }));
}

function gapsBetween(days: number[]): number[] {
  const gaps: number[] = [];
  for (let index = 1; index < days.length; index += 1) {
    gaps.push(Math.round((days[index] - days[index - 1]) / MS_PER_DAY));
  }
  return gaps;
}

function firstDate(primary?: string, fallback?: string): number | null {
  return parseDay(primary || '') ?? parseDay(fallback || '');
}

function parseDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function labelsOverlap(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 4 || right.length < 4) return false;
  return left.includes(right) || right.includes(left);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToFive(value: number): number {
  return Math.max(0, Math.round(value / 5) * 5);
}

function dollars(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function last4(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}
