import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { loadNessieBudget } from './nessieServer.ts';

const KEY = 'secret-nessie-key';

describe('loadNessieBudget against a mock API', () => {
  let base = '';
  let server: Server;

  before(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.searchParams.get('key') !== KEY) {
        res.writeHead(401);
        res.end('{}');
        return;
      }
      const path = url.pathname;
      let body: unknown = [];
      if (path === '/customers') {
        body = [
          { _id: 'cust-a', first_name: 'Ada', last_name: 'Lovelace' },
          { _id: 'cust-b', first_name: 'Grace', last_name: 'Hopper' },
        ];
      } else if (path === '/customers/cust-a/accounts') {
        body = [
          {
            _id: 'acc-1',
            type: 'Checking',
            nickname: 'Daily',
            balance: 1800,
            account_number: '0000111122223333',
            customer_id: 'cust-a',
          },
        ];
      } else if (path === '/customers/cust-b/accounts') {
        body = [
          {
            _id: 'acc-2',
            type: 'Checking',
            nickname: 'Other',
            balance: 50,
            account_number: '99998888',
            customer_id: 'cust-b',
          },
        ];
      } else if (path.endsWith('/purchases')) {
        body = [];
      } else if (path === '/accounts/acc-1/bills') {
        body = [
          {
            _id: 'bill-1',
            status: 'recurring',
            payee: 'Rent',
            nickname: 'Rent',
            payment_amount: 400,
            recurring_date: 1,
            account_id: 'acc-1',
          },
        ];
      } else if (path.endsWith('/bills')) {
        body = [];
      } else {
        res.writeHead(404);
        res.end('{}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('returns a live estimate and does not echo the key or full account number', async () => {
    process.env.NESSIE_API_KEY = KEY;
    process.env.NESSIE_BASE_URL = base;
    delete process.env.NESSIE_CUSTOMER_ID;
    delete process.env.NESSIE_ACCOUNT_ID;
    const result = await loadNessieBudget({ friendCount: 4, now: new Date('2025-04-10T00:00:00Z') });
    const encoded = JSON.stringify(result);
    assert.equal(result.source, 'nessie');
    assert.equal(result.selectedCustomerId, 'cust-a');
    assert.equal(result.customers.length, 2);
    assert.equal(result.accounts[0]?.last4, '3333');
    assert.equal(result.estimate.balance, 1800);
    assert.equal(result.estimate.recurringMonthly, 400);
    assert.equal(encoded.includes(KEY), false);
    assert.equal(encoded.includes('11112222'), false);
  });

  it('honors a customer id and falls back when the API is down', async () => {
    process.env.NESSIE_API_KEY = KEY;
    process.env.NESSIE_BASE_URL = base;
    delete process.env.NESSIE_CUSTOMER_ID;
    const picked = await loadNessieBudget({
      customerId: 'cust-b',
      now: new Date('2025-04-10T00:00:00Z'),
    });
    assert.equal(picked.selectedCustomerId, 'cust-b');
    assert.equal(picked.estimate.balance, 50);

    process.env.NESSIE_BASE_URL = 'http://127.0.0.1:9';
    const failed = await loadNessieBudget({ now: new Date('2025-04-10T00:00:00Z') });
    assert.equal(failed.source, 'simulated');
    assert.match(failed.notice || '', /did not answer/);
    assert.equal(JSON.stringify(failed).includes(KEY), false);
  });
});
