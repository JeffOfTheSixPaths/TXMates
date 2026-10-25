import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { budgetFromNessieRecords, detectRecurringCharges, estimateHangoutBudget } from './nessieBudget.ts';

const NOW = new Date('2025-04-10T12:00:00.000Z');

describe('detectRecurringCharges', () => {
  it('treats a Nessie recurring bill as monthly', () => {
    const { recurring } = detectRecurringCharges(
      [],
      [
        {
          id: 'bill-rent',
          accountId: 'acc-1',
          payee: 'Landlord',
          nickname: 'Rent',
          status: 'recurring',
          paymentAmount: 900,
          recurringDate: 1,
          paymentDate: '2025-04-01',
        },
      ],
      NOW
    );
    assert.equal(recurring.length, 1);
    assert.equal(recurring[0].cadence, 'monthly');
    assert.equal(recurring[0].monthlyAmount, 900);
    assert.equal(recurring[0].source, 'bill');
  });

  it('normalizes an annual bill label to a monthly amount', () => {
    const { recurring } = detectRecurringCharges(
      [],
      [
        {
          id: 'bill-car',
          accountId: 'acc-1',
          payee: 'Insurer',
          nickname: 'Annual car insurance',
          status: 'recurring',
          paymentAmount: 240,
          recurringDate: 15,
        },
      ],
      NOW
    );
    assert.equal(recurring[0].cadence, 'annual');
    assert.equal(recurring[0].amount, 240);
    assert.equal(recurring[0].monthlyAmount, 20);
  });

  it('detects annual bills from payment dates about a year apart', () => {
    const { recurring } = detectRecurringCharges(
      [],
      [
        {
          id: 'b1',
          accountId: 'acc-1',
          payee: 'Domain registrar',
          status: 'completed',
          paymentAmount: 120,
          paymentDate: '2024-04-01',
        },
        {
          id: 'b2',
          accountId: 'acc-1',
          payee: 'Domain registrar',
          status: 'pending',
          paymentAmount: 132,
          paymentDate: '2025-04-06',
        },
      ],
      NOW
    );
    assert.equal(recurring.length, 1);
    assert.equal(recurring[0].cadence, 'annual');
    assert.equal(recurring[0].monthlyAmount, 10.5);
  });

  it('detects monthly purchases at the same merchant and ignores cancelled ones', () => {
    const { recurring } = detectRecurringCharges(
      [
        purchase('p1', 'netflix', 15.99, '2025-01-03'),
        purchase('p2', 'netflix', 15.99, '2025-02-02'),
        purchase('p3', 'netflix', 15.99, '2025-03-04'),
        purchase('p4', 'netflix', 15.99, '2025-03-20', 'cancelled'),
        purchase('g1', 'grocer', 40, '2025-03-02'),
        purchase('g2', 'grocer', 80, '2025-03-18'),
      ],
      [],
      NOW
    );
    const netflix = recurring.find((charge) => charge.label === 'netflix');
    assert.ok(netflix);
    assert.equal(netflix?.cadence, 'monthly');
    assert.equal(netflix?.monthlyAmount, 15.99);
    assert.equal(recurring.some((charge) => charge.label === 'grocer'), false);
  });

  it('normalizes yearly purchases to a monthly amount', () => {
    const { recurring } = detectRecurringCharges(
      [
        purchase('a1', 'prime', 119, '2024-06-01', 'completed', 'Annual Prime'),
        purchase('a2', 'prime', 139, '2025-06-01', 'completed', 'Annual Prime'),
      ],
      [],
      NOW
    );
    assert.equal(recurring.length, 1);
    assert.equal(recurring[0].cadence, 'annual');
    assert.equal(recurring[0].monthlyAmount, 10.75);
  });

  it('keeps a monthly pattern when one interval skips a month', () => {
    const { recurring } = detectRecurringCharges(
      [
        purchase('s1', 'spotify', 11, '2025-01-01'),
        purchase('s2', 'spotify', 11, '2025-02-01'),
        purchase('s3', 'spotify', 11, '2025-03-01'),
        purchase('s4', 'spotify', 11, '2025-05-01'),
      ],
      [],
      NOW
    );
    assert.equal(recurring[0]?.cadence, 'monthly');
  });

  it('does not treat a one-off pair of close purchases as recurring', () => {
    const { recurring } = detectRecurringCharges(
      [purchase('c1', 'cafe', 8, '2025-04-01'), purchase('c2', 'cafe', 9, '2025-04-04')],
      [],
      NOW
    );
    assert.equal(recurring.length, 0);
  });

  it('does not double count a purchase that repeats a recurring bill', () => {
    const { recurring } = detectRecurringCharges(
      [
        purchase('n1', 'm-netflix', 15.99, '2025-01-03', 'completed', 'Netflix'),
        purchase('n2', 'm-netflix', 15.99, '2025-02-03', 'completed', 'Netflix'),
      ],
      [
        {
          id: 'bill-netflix',
          accountId: 'acc-1',
          payee: 'Netflix',
          status: 'recurring',
          paymentAmount: 15.99,
          recurringDate: 3,
        },
      ],
      NOW
    );
    assert.equal(recurring.length, 1);
    assert.equal(recurring[0].source, 'bill');
  });

  it('counts a pending non-recurring bill due soon as upcoming', () => {
    const { upcomingCharges, recurring } = detectRecurringCharges(
      [],
      [
        {
          id: 'dentist',
          accountId: 'acc-1',
          payee: 'Dentist',
          status: 'pending',
          paymentAmount: 80,
          upcomingPaymentDate: '2025-04-20',
        },
      ],
      NOW
    );
    assert.equal(recurring.length, 0);
    assert.equal(upcomingCharges, 80);
  });
});

describe('estimateHangoutBudget', () => {
  it('subtracts typical spend, normalized recurring charges, an upcoming bill, and a buffer', () => {
    const estimate = estimateHangoutBudget({
      now: NOW,
      friendCount: 4,
      accounts: [
        { id: 'chk', type: 'Checking', nickname: 'Daily', balance: 2500 },
        { id: 'sav', type: 'Savings', nickname: 'Rainy', balance: 500 },
        { id: 'cc', type: 'Credit Card', nickname: 'Card', balance: 200 },
      ],
      bills: [
        {
          id: 'rent',
          accountId: 'chk',
          payee: 'Landlord',
          nickname: 'Rent',
          status: 'recurring',
          paymentAmount: 800,
          recurringDate: 1,
        },
        {
          id: 'dentist',
          accountId: 'chk',
          payee: 'Dentist',
          status: 'pending',
          paymentAmount: 60,
          upcomingPaymentDate: '2025-04-20',
        },
      ],
      purchases: [
        purchase('n1', 'netflix', 16, '2025-01-03'),
        purchase('n2', 'netflix', 16, '2025-02-02'),
        purchase('n3', 'netflix', 16, '2025-03-04'),
        purchase('y1', 'prime', 120, '2024-06-01', 'completed', 'Annual Prime'),
        purchase('y2', 'prime', 120, '2025-06-01', 'completed', 'Annual Prime'),
        purchase('g1', 'grocer', 200, '2025-01-08', 'completed', 'Grocer'),
        purchase('g2', 'grocer', 220, '2025-04-02', 'completed', 'Grocer'),
      ],
    });

    assert.equal(estimate.source, 'nessie');
    assert.equal(estimate.balance, 2300);
    assert.equal(estimate.savingsBalance, 500);
    assert.equal(estimate.plannedMonthlySavings, 0);
    assert.equal(estimate.recurringMonthly, 826);
    assert.equal(estimate.annualChargesMonthly, 10);
    assert.equal(estimate.typicalMonthlySpend, 210);
    assert.equal(estimate.upcomingCharges, 60);
    assert.equal(estimate.safetyBuffer, 230);
    assert.equal(estimate.discretionary, 974);
    assert.equal(estimate.suggestedPerPerson, 150);
    assert.equal(estimate.friendCount, 4);
    assert.equal(
      estimate.reasoning,
      'Balance $2,300 (Nessie does not update this from purchases or deposits), savings $500 held separately, typical spending ~$210/mo, recurring ~$826/mo incl. annual charges, suggested hangout budget $150/person.'
    );
  });

  it('keeps savings out of spendable cash and subtracts a monthly savings plan', () => {
    const estimate = estimateHangoutBudget({
      now: NOW,
      accounts: [
        { id: 'chk', type: 'Checking', nickname: 'Daily', balance: 400 },
        { id: 'sav', type: 'Savings', nickname: 'Rainy', balance: 5000 },
        { id: 'cc', type: 'Credit Card', nickname: 'Card', balance: 0 },
      ],
      purchases: [],
      bills: [],
      deposits: [
        {
          id: 'dep-same',
          accountId: 'sav',
          amount: 100,
          transactionDate: '2025-01-04',
          status: 'completed',
          description: 'Payday transfer',
        },
        {
          id: 'dep-once',
          accountId: 'chk',
          amount: 900,
          transactionDate: '2025-02-01',
          status: 'completed',
          description: 'Paycheck',
        },
      ],
      transfers: [
        { id: 't1', payerId: 'chk', payeeId: 'sav', amount: 100, transactionDate: '2025-01-04', status: 'completed' },
        { id: 't1', payerId: 'chk', payeeId: 'sav', amount: 100, transactionDate: '2025-01-04', status: 'completed' },
        { id: 't2', payerId: 'chk', payeeId: 'sav', amount: 100, transactionDate: '2025-02-04', status: 'completed' },
        { id: 't3', payerId: 'chk', payeeId: 'sav', amount: 100, transactionDate: '2025-03-04', status: 'completed' },
        { id: 'out', payerId: 'sav', payeeId: 'chk', amount: 100, transactionDate: '2025-03-20', status: 'completed' },
      ],
    });
    assert.equal(estimate.balance, 400);
    assert.equal(estimate.savingsBalance, 5000);
    assert.equal(estimate.plannedMonthlySavings, 100);
    assert.equal(estimate.safetyBuffer, 50);
    assert.equal(estimate.discretionary, 250);
    assert.equal(estimate.suggestedPerPerson, 50);
    assert.match(estimate.reasoning, /savings \$5,000 held separately/);
    assert.match(estimate.reasoning, /planned savings ~\$100\/mo/);
    assert.match(estimate.reasoning, /does not update this from purchases or deposits/);
  });

  it('suggests $0 when obligations consume the balance', () => {
    const estimate = estimateHangoutBudget({
      now: NOW,
      accounts: [{ id: 'chk', type: 'Checking', nickname: 'Daily', balance: 100 }],
      purchases: [],
      bills: [
        {
          id: 'rent',
          accountId: 'chk',
          payee: 'Landlord',
          status: 'recurring',
          paymentAmount: 900,
          recurringDate: 1,
        },
      ],
    });
    assert.equal(estimate.suggestedPerPerson, 0);
    assert.equal(estimate.discretionary, 0);
  });

  it('reads mocked Nessie JSON, including string amounts', () => {
    const estimate = budgetFromNessieRecords({
      now: NOW,
      accounts: [
        {
          _id: 'acc-1',
          type: 'Checking',
          nickname: 'Main',
          balance: '1000',
          account_number: '1234567890',
        },
      ],
      purchases: [
        {
          _id: 'p1',
          merchant_id: 'gym',
          description: 'Gym',
          amount: 40,
          purchase_date: '2025-01-15',
          status: 'completed',
        },
        {
          _id: 'p2',
          merchant_id: 'gym',
          description: 'Gym',
          amount: 40,
          purchase_date: '2025-02-15',
          status: 'completed',
        },
        {
          _id: 'p3',
          merchant_id: 'gym',
          description: 'Gym',
          amount: 40,
          purchase_date: '2025-03-15',
          status: 'completed',
        },
      ],
      bills: [],
    });
    assert.equal(estimate.balance, 1000);
    assert.equal(estimate.recurringMonthly, 40);
    assert.match(estimate.reasoning, /suggested hangout budget \$/);
  });
});

function purchase(
  id: string,
  merchantId: string,
  amount: number,
  purchaseDate: string,
  status = 'completed',
  description = merchantId
) {
  return {
    id,
    accountId: 'acc-1',
    merchantId,
    description,
    amount,
    purchaseDate,
    status,
  };
}
