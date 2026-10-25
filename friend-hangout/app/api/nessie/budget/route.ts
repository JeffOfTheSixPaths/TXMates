import { connection } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { museComplete } from '@/lib/museClient';
import { budgetCopyCacheKey, parseBudgetCopy } from '@/lib/musePlan';
import { loadNessieBudget, safeId } from '@/lib/nessieServer';

export async function GET(req: NextRequest) {
  await connection();
  const friendCount = Number(req.nextUrl.searchParams.get('friendCount') || '1');
  const budget = await loadNessieBudget({
    customerId: safeId(req.nextUrl.searchParams.get('customerId')),
    accountId: safeId(req.nextUrl.searchParams.get('accountId')),
    friendCount: Number.isFinite(friendCount) ? friendCount : 1,
    now: new Date(),
  });

  if (budget.estimate.source === 'nessie') {
    const db = getDb();
    const result = await museComplete(db, {
      purpose: 'budget',
      cacheKey: budgetCopyCacheKey(budget.estimate),
      temperature: 0.3,
      maxTokens: 700,
      messages: [
        {
          role: 'system',
          content:
            'Explain these Nessie budget numbers in plain language for a friend-group hangout. Reply with ONLY JSON: {"explanation":"2-3 sentences","tips":["up to 3 short tips"]}. Do not invent accounts that are not in the numbers. balance is checking, with credit-card debt subtracted. savingsBalance is not spendable. plannedMonthlySavings is already set aside. Nessie does not update balances from purchases or deposits.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            balance: budget.estimate.balance,
            typicalMonthlySpend: budget.estimate.typicalMonthlySpend,
            recurringMonthly: budget.estimate.recurringMonthly,
            annualChargesMonthly: budget.estimate.annualChargesMonthly,
            upcomingCharges: budget.estimate.upcomingCharges,
            safetyBuffer: budget.estimate.safetyBuffer,
            discretionary: budget.estimate.discretionary,
            suggestedPerPerson: budget.estimate.suggestedPerPerson,
            friendCount: budget.estimate.friendCount,
            savingsBalance: budget.estimate.savingsBalance,
            plannedMonthlySavings: budget.estimate.plannedMonthlySavings,
          }),
        },
      ],
    });
    const copy = result.content ? parseBudgetCopy(result.content) : null;
    if (copy) {
      budget.estimate.reasoning = copy.explanation;
      budget.estimate.museTips = copy.tips;
      budget.estimate.museEnriched = true;
    }
    if (result.limited) {
      budget.notice = budget.notice
        ? `${budget.notice} Muse daily limit reached, so this stays the calculated wording.`
        : 'Muse daily limit reached, so this stays the calculated wording.';
    }
  }

  return NextResponse.json(budget);
}
