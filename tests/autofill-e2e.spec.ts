/**
 * Cycle 1 (refreshed harness) — Add-stock form rows 7–19 of
 * .loopzai/spec.md "Success criteria": ticker-blur company-name autofill
 * with the D2 provenance write rule, D3 dot-class retry, D6 miss-never-writes,
 * D7 stale-response guard, D8 blank-ticker guard, D9 normalization, D5 Add-only.
 *
 * FROZEN — derived solely from .loopzai/spec.md + .loopzai/spec-amendments.md
 * (test-plan rows taken from .loopzai/implementation-plan.md, which is
 * non-authoritative), implemented BEFORE reading execution-log.md or the
 * implementation diff. Committed to git at Verification attempt 1; later
 * attempts run this file unchanged.
 *
 * Harness (identical to the frozen cycle-2/3 harness): dev Convex
 * deployment from .env.local, testing.reset, browser sign-in via the
 * env-gated test form, one long-lived ADMIN context with a `/api/stock`
 * stub installed on the context. The stub records the RAW `ticker` query
 * value of every request (row 8 needs exact bytes) and honours a mutable
 * per-ticker delay (row 17).
 *
 * Request accounting is always a delta from a mark taken after openAdd():
 * the dashboard's own load/refresh fetches also hit the stub.
 */
import { test, expect, Page, BrowserContext, Locator } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import * as fs from 'fs';
import * as path from 'path';

const SECRET = 'loopzai-e2e-dev-secret'; // frozen, cycle-2 spec §10
const ADMIN = 'trixiematic415@gmail.com';

function convexUrl(): string {
  const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!m) throw new Error('NEXT_PUBLIC_CONVEX_URL not found in .env.local');
  const url = m[1].trim();
  if (url.includes('frugal-anaconda-225')) {
    throw new Error('Refusing to run e2e against the production deployment');
  }
  return url;
}

const NAMES: Record<string, string | null> = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  'BRK-B': 'Berkshire Hathaway Inc.',
  NONAME: null,
};

type Stub = { log: string[]; delays: Record<string, number> };

async function installStub(ctx: BrowserContext): Promise<Stub> {
  const stub: Stub = { log: [], delays: {} };
  await ctx.route('**/api/stock*', async (route) => {
    const url = new URL(route.request().url());
    const raw = url.searchParams.get('ticker') ?? '';
    stub.log.push(raw);
    const ticker = raw.toUpperCase();
    const delay = stub.delays[ticker];
    if (delay) await new Promise((r) => setTimeout(r, delay));

    if (ticker === 'NETFAIL') {
      await route.abort('failed');
      return;
    }
    if (ticker === 'BRK.B') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'stubbed upstream 404' }),
      });
      return;
    }
    if (ticker === 'FAIL') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'stubbed upstream failure' }),
      });
      return;
    }
    if (!(ticker in NAMES)) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'stubbed unknown ticker' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ticker,
        price: 100,
        previousClose: 100,
        changePercent: 0,
        historicalPrice: 100,
        name: NAMES[ticker],
      }),
    });
  });
  return stub;
}

async function signInViaForm(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('signin-screen')).toBeVisible();
  await page.getByTestId('test-signin-email').fill(email);
  await page.getByTestId('test-signin-secret').fill(SECRET);
  await page.getByTestId('test-signin-submit').click();
}

async function nodeSignIn(email: string): Promise<ConvexHttpClient> {
  const client = new ConvexHttpClient(convexUrl());
  const res: any = await client.action(anyApi.auth.signIn, {
    provider: 'test-login',
    params: { email, secret: SECRET },
  });
  const token = res?.tokens?.token;
  if (!token) {
    throw new Error(
      `test-login sign-in for ${email} returned no tokens.token: ` + JSON.stringify(res)
    );
  }
  client.setAuth(token);
  return client;
}

const SETTLE_MS = 750;
const ZERO_SETTLE_MS = 1500;

test.describe.configure({ mode: 'serial' });

let ctx: BrowserContext;
let page: Page;
let stub: Stub;
let ticker: Locator;
let nameField: Locator;
let tags: Locator;
let save: Locator;
let form: Locator;

async function openAdd(): Promise<number> {
  await page.getByTestId('add-stock-button').click();
  await expect(form).toBeVisible();
  await expect(form.locator('h1, h2, h3')).toHaveText('Add stock');
  return stub.log.length; // mark
}

async function closeForm(): Promise<void> {
  await form.getByRole('button', { name: 'Cancel' }).click();
  await expect(form).toHaveCount(0);
}

async function blur(): Promise<void> {
  await ticker.blur();
}

const stockRow = (t: string) =>
  page.locator(`[data-testid="stock-row"][data-ticker="${t}"]`);
const mrow = (t: string) =>
  page.locator(`[data-testid="manage-stocks-row"][data-ticker="${t}"]`);

test.describe('AF-E2E: Add-stock company-name autofill (stubbed /api/stock)', () => {
  test.beforeAll(async ({ browser }) => {
    const c = new ConvexHttpClient(convexUrl());
    await c.mutation(anyApi.testing.reset, { secret: SECRET });

    ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    stub = await installStub(ctx);
    page = await ctx.newPage();
    await signInViaForm(page, ADMIN);
    await expect(page.getByTestId('empty-state')).toBeVisible();

    ticker = page.getByTestId('stock-form-ticker');
    nameField = page.getByTestId('stock-form-name');
    tags = page.getByTestId('stock-form-tags');
    save = page.getByTestId('stock-form-save');
    form = page.getByTestId('stock-form');
  });

  test.afterAll(async () => {
    await ctx?.close();
  });

  test('AF-E2E-7 (criterion 7, D1): AAPL + Tab -> exactly one request, name becomes "Apple Inc."', async () => {
    const mark = await openAdd();
    await ticker.fill('AAPL');
    await ticker.press('Tab');
    await expect(nameField).toHaveValue('Apple Inc.');
    await page.waitForTimeout(SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual(['AAPL']);
    await closeForm();
  });

  test('AF-E2E-8 (criterion 8, D9): "aapl " + click-to-name -> request is ticker=AAPL; field text unchanged', async () => {
    const mark = await openAdd();
    await ticker.fill('aapl ');
    await nameField.click();
    await expect(nameField).toHaveValue('Apple Inc.');
    await page.waitForTimeout(SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual(['AAPL']);
    await expect(ticker).toHaveValue('aapl ');
    await closeForm();
  });

  test('AF-E2E-9 (criterion 9, D8): blur with empty / whitespace-only ticker -> zero requests', async () => {
    const mark = await openAdd();
    await ticker.focus();
    await blur();
    await ticker.fill('   ');
    await blur();
    await page.waitForTimeout(ZERO_SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual([]);
    await expect(nameField).toHaveValue('');
    await closeForm();
  });

  test('AF-E2E-10a (criterion 10, D3): BRK.B non-200 -> exactly one retry as BRK-B; second response name written', async () => {
    const mark = await openAdd();
    await ticker.fill('BRK.B');
    await blur();
    await expect(nameField).toHaveValue('Berkshire Hathaway Inc.');
    await page.waitForTimeout(SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual(['BRK.B', 'BRK-B']);
    await closeForm();
  });

  test('AF-E2E-10b (criterion 10): BRK-B first request 200 -> no second request', async () => {
    const mark = await openAdd();
    await ticker.fill('BRK-B');
    await blur();
    await expect(nameField).toHaveValue('Berkshire Hathaway Inc.');
    await page.waitForTimeout(SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual(['BRK-B']);
    await closeForm();
  });

  test('AF-E2E-10c (criterion 10): non-dot miss (ZZZZ) -> exactly one request, name blank', async () => {
    const mark = await openAdd();
    await ticker.fill('ZZZZ');
    await blur();
    await page.waitForTimeout(SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual(['ZZZZ']);
    await expect(nameField).toHaveValue('');
    await closeForm();
  });

  test('AF-E2E-11 (criterion 11, D6/D10): misses never write, render no error, do not affect Save; manual save works as today', async () => {
    await openAdd();
    for (const t of ['ZZZZ', 'FAIL', 'NETFAIL', 'NONAME']) {
      await ticker.fill(t);
      await blur();
      await page.waitForTimeout(SETTLE_MS);
      await expect(nameField, `after miss ${t}`).toHaveValue('');
      await expect(page.getByTestId('stock-form-error'), `after miss ${t}`).toHaveCount(0);
      await expect(save, `after miss ${t}`).toBeEnabled();
    }
    // Typed text stays typed across a miss.
    await nameField.fill('Zed Co');
    await ticker.fill('FAIL');
    await blur();
    await page.waitForTimeout(SETTLE_MS);
    await expect(nameField).toHaveValue('Zed Co');
    await expect(page.getByTestId('stock-form-error')).toHaveCount(0);
    await expect(save).toBeEnabled();

    // Save with a manual name and a tag succeeds exactly as today.
    await ticker.fill('ZZZZ');
    await tags.fill('Misc');
    await tags.press('Enter');
    await save.click();
    await expect(form).toHaveCount(0);
    await expect(stockRow('ZZZZ')).toBeVisible();
    await expect(stockRow('ZZZZ').getByTestId('stock-price')).toHaveText('—');
    await expect(stockRow('ZZZZ').getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'unavailable'
    );
  });

  test('AF-E2E-12 (criterion 12, D2): name typed first ("My Co") is never overwritten by a hit', async () => {
    const mark = await openAdd();
    await nameField.fill('My Co');
    await ticker.fill('AAPL');
    await blur();
    await page.waitForTimeout(SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual(['AAPL']);
    await expect(nameField).toHaveValue('My Co');
    await closeForm();
  });

  test('AF-E2E-13+14 (criteria 13, 14, D2): untouched autofill is replaceable; once edited it is human-authored', async () => {
    // 13
    await openAdd();
    await ticker.fill('AAPL');
    await blur();
    await expect(nameField).toHaveValue('Apple Inc.');
    await ticker.fill('MSFT');
    await blur();
    await expect(nameField).toHaveValue('Microsoft Corporation');
    await page.waitForTimeout(SETTLE_MS);

    // 14 (continuing in the same form)
    const mark = stub.log.length;
    await nameField.fill('MSFT Corp');
    await ticker.fill('AAPL');
    await blur();
    await page.waitForTimeout(SETTLE_MS);
    await expect(nameField).toHaveValue('MSFT Corp');
    expect(stub.log.slice(mark)).toEqual(['AAPL']);
    await closeForm();
  });

  test('AF-E2E-15 (criterion 15, D2): cleared and retyped identical text is human-authored', async () => {
    await openAdd();
    await ticker.fill('AAPL');
    await blur();
    await expect(nameField).toHaveValue('Apple Inc.');
    await nameField.clear();
    await expect(nameField).toHaveValue('');
    await nameField.pressSequentially('Apple Inc.');
    await expect(nameField).toHaveValue('Apple Inc.');
    const mark = stub.log.length;
    await ticker.fill('MSFT');
    await blur();
    await page.waitForTimeout(SETTLE_MS);
    await expect(nameField).toHaveValue('Apple Inc.');
    const delta = stub.log.slice(mark);
    expect(delta.length).toBeGreaterThan(0);
    expect(delta[delta.length - 1]).toBe('MSFT');
    await closeForm();
  });

  test('AF-E2E-16 (criterion 16, D6): a miss never writes, even over a stale untouched autofill', async () => {
    await openAdd();
    await ticker.fill('AAPL');
    await blur();
    await expect(nameField).toHaveValue('Apple Inc.');
    const mark = stub.log.length;
    await ticker.fill('ZZZZ');
    await blur();
    await page.waitForTimeout(SETTLE_MS);
    await expect(nameField).toHaveValue('Apple Inc.');
    const delta = stub.log.slice(mark);
    expect(delta.length).toBeGreaterThan(0);
    expect(delta[delta.length - 1]).toBe('ZZZZ');
    await closeForm();
  });

  test('AF-E2E-17a (criterion 17, D7): a delayed stale AAPL response never overwrites the MSFT autofill', async () => {
    stub.delays.AAPL = 1500;
    try {
      const mark = await openAdd();
      await ticker.fill('AAPL');
      await blur();
      await ticker.fill('MSFT');
      await blur();
      await expect(nameField).toHaveValue('Microsoft Corporation');
      const samples: string[] = [];
      const until = Date.now() + 2500;
      while (Date.now() < until) {
        samples.push(await nameField.inputValue());
        await page.waitForTimeout(100);
      }
      expect(samples.length).toBeGreaterThan(0);
      for (const s of samples) expect(s).toBe('Microsoft Corporation');
      expect(samples).not.toContain('Apple Inc.');
      await expect(nameField).toHaveValue('Microsoft Corporation');
      expect(stub.log.slice(mark)).toEqual(['AAPL', 'MSFT']);
      await closeForm();
    } finally {
      delete stub.delays.AAPL;
    }
  });

  test('AF-E2E-17b (criterion 17, D7): ticker changed without blur -> stale response discarded, field stays blank', async () => {
    stub.delays.AAPL = 1500;
    try {
      const mark = await openAdd();
      await ticker.fill('AAPL');
      await blur();
      await ticker.fill('MSFT'); // focus stays in the ticker; no blur
      await page.waitForTimeout(2500);
      await expect(nameField).toHaveValue('');
      expect(stub.log.slice(mark)).toEqual(['AAPL']);
      await closeForm();
    } finally {
      delete stub.delays.AAPL;
    }
  });

  test('AF-E2E-19 (criterion 19): autofilled name persists exactly through unchanged stocks.add; blank name still rejected', async () => {
    await openAdd();
    await ticker.fill('AAPL');
    await blur();
    await expect(nameField).toHaveValue('Apple Inc.');
    await tags.fill('Tech');
    await tags.press('Enter');
    await save.click();
    await expect(form).toHaveCount(0);
    await expect(stockRow('AAPL')).toBeVisible();

    const client = await nodeSignIn(ADMIN);
    const rows: any[] = await client.query(anyApi.stocks.list, {});
    const aapl = rows.find((r) => r.ticker === 'AAPL');
    expect(aapl).toBeTruthy();
    expect(aapl.name).toBe('Apple Inc.');

    await expect(
      client.mutation(anyApi.stocks.add, { ticker: 'GOOG', name: '', tags: ['Tech'] })
    ).rejects.toThrow(/Company name is required\./);
    const after: any[] = await client.query(anyApi.stocks.list, {});
    expect(after.find((r) => r.ticker === 'GOOG')).toBeUndefined();
  });

  test('AF-E2E-18 (criterion 18, D5): Edit mode issues no lookup on ticker blur and keeps the name', async () => {
    await page.getByTestId('manage-stocks-button').click();
    await expect(page.getByTestId('manage-stocks-modal')).toBeVisible();
    await mrow('AAPL').getByTestId('manage-stocks-edit').click();
    await expect(form).toBeVisible();
    await expect(form.locator('h1, h2, h3')).toHaveText('Edit AAPL');
    await expect(ticker).toHaveValue('AAPL');
    await expect(nameField).toHaveValue('Apple Inc.');

    const mark = stub.log.length;
    await ticker.focus();
    await blur();
    await ticker.focus();
    await ticker.press('Tab');
    await page.waitForTimeout(ZERO_SETTLE_MS);
    expect(stub.log.slice(mark)).toEqual([]);
    await expect(nameField).toHaveValue('Apple Inc.');
    await expect(ticker).toHaveValue('AAPL');

    await closeForm();
    const close = page.getByTestId('manage-stocks-close');
    if ((await close.count()) > 0) await close.click();
  });
});
