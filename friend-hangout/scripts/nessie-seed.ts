/**
 * Opt-in demo data for a Nessie key that has no customers yet.
 * Reads NESSIE_API_KEY from .env.local or the environment and never prints it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNessieSeed, createdId, parseEnvFile } from '../lib/nessieSeed';
import { nessieBaseUrl } from '../lib/nessieServer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadLocalEnv() {
  const envPath = path.join(root, '.env.local');
  let text = '';
  try {
    text = readFileSync(envPath, 'utf8');
  } catch {
    return;
  }
  const values = parseEnvFile(text);
  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

async function post(apiPath: string, body: unknown, key: string): Promise<unknown> {
  const url = new URL(`${nessieBaseUrl()}${apiPath}`);
  url.searchParams.set('key', key);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Nessie ${apiPath} failed with status ${response.status}`);
  }
  return payload;
}

async function main() {
  loadLocalEnv();
  const key = process.env.NESSIE_API_KEY?.trim();
  if (!key) {
    console.error('NESSIE_API_KEY is not set. Add it to friend-hangout/.env.local and run this again.');
    process.exitCode = 1;
    return;
  }

  const plan = buildNessieSeed(new Date());
  const customer = await post('/customers', plan.customer, key);
  const customerId = createdId(customer);
  if (!customerId) throw new Error('Nessie created a customer without an id');

  const account = await post(`/customers/${customerId}/accounts`, plan.account, key);
  const accountId = createdId(account);
  if (!accountId) throw new Error('Nessie created an account without an id');

  const merchantIds = new Map<string, string>();
  for (const merchant of plan.merchants) {
    const created = await post('/merchants', merchant, key);
    const merchantId = createdId(created);
    if (!merchantId) throw new Error(`Nessie created merchant ${merchant.name} without an id`);
    merchantIds.set(merchant.name, merchantId);
  }

  for (const purchase of plan.purchases) {
    const merchantId = merchantIds.get(purchase.merchantName);
    if (!merchantId) throw new Error(`Missing merchant ${purchase.merchantName}`);
    await post(
      `/accounts/${accountId}/purchases`,
      {
        medium: purchase.medium,
        purchase_date: purchase.purchase_date,
        amount: purchase.amount,
        status: purchase.status,
        description: purchase.description,
        merchant_id: merchantId,
      },
      key
    );
  }

  for (const bill of plan.bills) {
    await post(`/accounts/${accountId}/bills`, bill, key);
  }

  console.log(`Created customer ${customerId} (${plan.customer.first_name} ${plan.customer.last_name}).`);
  console.log(`Created checking account ${accountId} with balance ${plan.account.balance}.`);
  console.log(`Created ${plan.merchants.length} merchants, ${plan.purchases.length} purchases, and ${plan.bills.length} bills.`);
  console.log('Reload the planner. The budget line should now use this Nessie customer.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Nessie seed failed';
  console.error(message);
  process.exitCode = 1;
});
