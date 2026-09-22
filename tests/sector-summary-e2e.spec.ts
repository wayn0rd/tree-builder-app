/**
 * SS-E: Cycle-2 durable E2E tests (Playwright, quote stub active).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 2, revision 2:
 * Behaviour changes, Decisions D1–D12, Success criteria 1–6, 8–10, 13)
 * and .loopzai/spec-amendments.md (empty), with the test plan in
 * .loopzai/implementation-plan.md as the non-authoritative row source,
 * implemented BEFORE reading execution-log.md or the implementation diff.
 *
 * Harness (identical to the frozen cycle-2/3 and autofill harness):
 * - testing.reset via ConvexHttpClient against NEXT_PUBLIC_CONVEX_URL
 *   read from .env.local (dev deployment, never prod).
 * - Test sign-in form (test-signin-email / -secret / -submit), shown
 *   under NEXT_PUBLIC_E2E_TEST_MODE=1 (Playwright webServer sets it).
 * - Node-client seeding: auth.signIn { provider: 'test-login' },
 *   client.setAuth(tokens.token), then stocks.add per stock in order.
 * - Quote stub with request counter on every context: AAPL +100,
 *   MSFT -10, NVDA 0, TINY +0.001; any other ticker (incl. FAIL) -> 404.
 * - Viewport 1280x720.
 *
 * Expected strings use MIDDLE DOT U+00B7, BLACK UP-POINTING TRIANGLE
 * U+25B2, BLACK DOWN-POINTING TRIANGLE U+25BC and EM DASH U+2014 —
 * exactly the code points the spec writes.
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import * as fs from 'fs';
import * as path from 'path';

const SECRET = 'loopzai-e2e-dev-secret';
const ADMIN = 'trixiematic415@gmail.com';
const VIEWPORT = { width: 1280, height: 720 };

const STUB: Record<
  string,
  { price: number; previousClose: number; changePercent: number }
> = {
  AAPL: { price: 200, previousClose: 100, changePercent: 100 },
  MSFT: { price: 90, previousClose: 100, changePercent: -10 },
  NVDA: { price: 100, previousClose: 100, changePercent: 0 },
  TINY: { price: 100.001, previousClose: 100, changePercent: 0.001 },
};

/** Board fixture (spec "Success criteria" preamble), seeded in this order. */
const FIXTURE: { ticker: string; name: string; tags: string[] }[] = [
  { ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
  { ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
  { ticker: 'NVDA', name: 'Nvidia', tags: ['Chips'] },
  { ticker: 'FAIL', name: 'FailCo', tags: ['Chips'] },
];

type Counter = { total: number; byTicker: Record<string, number> };

function convexUrl(): string {
  const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!m) throw new Error('NEXT_PUBLIC_CONVEX_URL not found in .env.local');
  const url = m[1].trim();
  if (/frugal-anaconda-225/.test(url)) {
    throw new Error('.env.local points at PROD — refusing to run tests');
  }
  return url;
}

/** Quote stub + request counter on a whole browser context. */
async function installStub(ctx: BrowserContext): Promise<Counter> {
  const counter: Counter = { total: 0, byTicker: {} };
  await ctx.route('**/api/stock*', async (route) => {
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    counter.total++;
    counter.byTicker[ticker] = (counter.byTicker[ticker] || 0) + 1;
    const q = STUB[ticker];
    if (!q) {
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
        price: q.price,
        previousClose: q.previousClose,
        changePercent: q.changePercent,
        historicalPrice: q.previousClose,
      }),
    });
  });
  return counter;
}

async function signInViaForm(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('signin-screen')).toBeVisible();
  await page.getByTestId('test-signin-email').fill(email);
  await page.getByTestId('test-signin-secret').fill(SECRET);
  await page.getByTestId('test-signin-submit').click();
  await expect(page.getByTestId('manage-stocks-button')).toBeVisible();
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

// ---- Locator conventions ----------------------------------------------
const card = (page: Page, tag: string) =>
  page.locator(`[data-testid="sector-card"][data-tag="${tag}"]`);
const summary = (page: Page, tag: string) =>
  card(page, tag).locator('header').getByTestId('sector-summary');
const row = (page: Page, ticker: string) =>
  page.locator(`[data-testid="stock-row"][data-ticker="${ticker}"]`);

type Attrs = {
  direction: string;
  up: string;
  down: string;
  flat: string;
  unavailable: string;
  mean: string | null;
};

async function expectSummary(
  page: Page,
  tag: string,
  text: string,
  attrs: Attrs
): Promise<void> {
  const s = summary(page, tag);
  await expect(s, `${tag}: exactly one summary in the header`).toHaveCount(1);
  await expect(s, `${tag}: summary text`).toHaveText(text);
  await expect(s).toHaveAttribute('data-direction', attrs.direction);
  await expect(s).toHaveAttribute('data-up', attrs.up);
  await expect(s).toHaveAttribute('data-down', attrs.down);
  await expect(s).toHaveAttribute('data-flat', attrs.flat);
  await expect(s).toHaveAttribute('data-unavailable', attrs.unavailable);
  if (attrs.mean === null) {
    await expect(s, `${tag}: data-mean must be absent`).not.toHaveAttribute('data-mean');
    expect(await s.getAttribute('data-mean')).toBeNull();
  } else {
    await expect(s).toHaveAttribute('data-mean', attrs.mean);
  }
}

const TECH: Attrs = { direction: 'up', up: '1', down: '1', flat: '0', unavailable: '0', mean: '45' };
const CLOUD: Attrs = { direction: 'down', up: '0', down: '1', flat: '0', unavailable: '0', mean: '-10' };
const CHIPS: Attrs = { direction: 'flat', up: '0', down: '0', flat: '1', unavailable: '1', mean: '0' };
const TECH_TEXT = '+45.00% · 1▲ 1▼';
const CLOUD_TEXT = '-10.00% · 0▲ 1▼';
const CHIPS_TEXT = '0.00% · 0▲ 0▼ 1 flat 1 n/a';

// -----------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

let adminCtx: BrowserContext;
let adminPage: Page;
let adminCounter: Counter;
let admin: ConvexHttpClient;

test.describe('SS-E (cycle 2): sector-header summary E2E (Playwright, stubbed quotes)', () => {
  test.beforeAll(async ({ browser }) => {
    const c = new ConvexHttpClient(convexUrl());
    await c.mutation(anyApi.testing.reset, { secret: SECRET });

    admin = await nodeSignIn(ADMIN);
    for (const s of FIXTURE) {
      await admin.mutation(anyApi.stocks.add, {
        ticker: s.ticker,
        name: s.name,
        tags: s.tags,
      });
    }

    adminCtx = await browser.newContext({ viewport: VIEWPORT });
    adminCounter = await installStub(adminCtx);
    adminPage = await adminCtx.newPage();
    await adminPage.setViewportSize(VIEWPORT);
    await signInViaForm(adminPage, ADMIN);
    await expect(card(adminPage, 'Tech')).toBeVisible();
    await adminPage.waitForTimeout(2000); // let load-triggered fetches settle
  });

  test.afterAll(async () => {
    await adminCtx?.close();
  });

  test('SS-E-1 (criterion 1): Tech summary "+45.00% · 1▲ 1▼", direction up, mean 45', async () => {
    await expectSummary(adminPage, 'Tech', TECH_TEXT, TECH);
  });

  test('SS-E-2 (criterion 2): Cloud summary "-10.00% · 0▲ 1▼", direction down, mean -10', async () => {
    await expectSummary(adminPage, 'Cloud', CLOUD_TEXT, CLOUD);
  });

  test('SS-E-3 (criterion 3): Chips summary "0.00% · 0▲ 0▼ 1 flat 1 n/a", direction flat, mean 0', async () => {
    await expectSummary(adminPage, 'Chips', CHIPS_TEXT, CHIPS);
  });

  test('SS-E-8 (criterion 8, D11): tag title and stock-count pill unchanged; summary inside the same header', async () => {
    const expected: Record<string, string> = {
      Tech: '2 stocks',
      Cloud: '1 stock',
      Chips: '2 stocks',
    };
    for (const tag of Object.keys(expected)) {
      const h = card(adminPage, tag).locator('header');
      await expect(h, `${tag}: exactly one header`).toHaveCount(1);
      await expect(h.locator('h2')).toHaveText(tag);
      await expect(h.getByText(/^\d+ stocks?$/)).toHaveText(expected[tag]);
      await expect(h.getByTestId('sector-summary')).toHaveCount(1);
    }
  });

  test('SS-E-9 (criterion 9, D10): page-wide row-scoped counts are unchanged by the header', async () => {
    await expect(adminPage.getByTestId('stock-row')).toHaveCount(5);
    await expect(adminPage.getByTestId('stock-change')).toHaveCount(5);
    await expect(adminPage.getByTestId('stock-price')).toHaveCount(5);
    await expect(adminPage.getByTestId('edit-stock')).toHaveCount(5);
    await expect(adminPage.getByTestId('delete-stock')).toHaveCount(5);
    await expect(adminPage.getByTestId('sector-summary')).toHaveCount(3);
    await expect(
      adminPage.locator('[data-testid="sector-summary"] [data-testid]')
    ).toHaveCount(0);
    // No summary borrows a row id (D10): nothing with a row id sits in a header.
    await expect(
      adminPage.locator(
        '[data-testid="sector-card"] header [data-testid="stock-change"], ' +
          '[data-testid="sector-card"] header [data-testid="stock-row"], ' +
          '[data-testid="sector-card"] header [data-testid="stock-price"]'
      )
    ).toHaveCount(0);
  });

  test('SS-E-10 (criterion 10, 13): refresh issues one request per distinct ticker; none on re-render or 30 s idle', async () => {
    const baselineTotal = adminCounter.total;
    const baselineBy = { ...adminCounter.byTicker };

    await adminPage.getByTestId('refresh-prices').click();
    await expect
      .poll(() => adminCounter.total, { timeout: 15_000 })
      .toBe(baselineTotal + 4);
    await adminPage.waitForTimeout(2000);
    expect(adminCounter.total, 'exactly +4 after refresh').toBe(baselineTotal + 4);
    for (const t of ['AAPL', 'MSFT', 'NVDA', 'FAIL']) {
      expect(
        (adminCounter.byTicker[t] || 0) - (baselineBy[t] || 0),
        `${t}: exactly one request on refresh`
      ).toBe(1);
    }
    // Summaries still correct after the refresh.
    await expectSummary(adminPage, 'Tech', TECH_TEXT, TECH);

    // Header re-renders via tag filter toggle: zero requests.
    const afterRefresh = adminCounter.total;
    await adminPage.locator('[data-testid="tag-chip"][data-tag="Cloud"]').click();
    await expect(card(adminPage, 'Cloud')).toBeVisible();
    await expect(card(adminPage, 'Tech')).toHaveCount(0);
    await expect(summary(adminPage, 'Cloud')).toHaveText(CLOUD_TEXT);
    await adminPage.getByTestId('clear-tag-filter').click();
    await expect(card(adminPage, 'Tech')).toBeVisible();
    await expect(summary(adminPage, 'Tech')).toHaveText(TECH_TEXT);
    expect(adminCounter.total, 'no request across the filter toggle').toBe(afterRefresh);

    // 30-second idle: no request.
    await adminPage.waitForTimeout(30_000);
    expect(adminCounter.total, 'no request during a 30 s idle').toBe(afterRefresh);
  });

  test('SS-E-6 (criterion 6): /shared/<token> shows identical summaries with no edit / delete controls', async ({
    browser,
  }) => {
    const token: string = await admin.mutation(anyApi.share.create, {});
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    const anonCtx = await browser.newContext({ viewport: VIEWPORT });
    const anonCounter = await installStub(anonCtx);
    const anon = await anonCtx.newPage();
    await anon.setViewportSize(VIEWPORT);
    await anon.goto('/shared/' + token);
    await expect(card(anon, 'Tech')).toBeVisible();
    await expect.poll(() => anonCounter.total, { timeout: 15_000 }).toBe(4);
    await anon.waitForTimeout(2000);

    await expectSummary(anon, 'Tech', TECH_TEXT, TECH);
    await expectSummary(anon, 'Cloud', CLOUD_TEXT, CLOUD);
    await expectSummary(anon, 'Chips', CHIPS_TEXT, CHIPS);
    await expect(anon.getByTestId('sector-summary')).toHaveCount(3);
    await expect(anon.getByTestId('stock-row')).toHaveCount(5);
    await expect(anon.getByTestId('stock-change')).toHaveCount(5);
    await expect(anon.getByTestId('edit-stock')).toHaveCount(0);
    await expect(anon.getByTestId('delete-stock')).toHaveCount(0);
    await expect(anon.getByTestId('add-stock-button')).toHaveCount(0);
    await expect(anon.locator('[data-testid^="manage-stocks-"]')).toHaveCount(0);
    await anonCtx.close();
  });

  test('SS-E-4 (criterion 4, D5, D8, 13): all-unavailable card shows "— · 0▲ 0▼ 1 n/a", no data-mean, no NaN, no %', async () => {
    const before = adminCounter.total;
    const list: any[] = await admin.query(anyApi.stocks.list, {});
    const fail = list.find((s) => s.ticker === 'FAIL');
    expect(fail, 'FAIL must exist in the fixture').toBeTruthy();

    await admin.mutation(anyApi.stocks.update, {
      id: fail._id,
      ticker: 'FAIL',
      name: 'FailCo',
      tags: ['Chips', 'Dead'],
    });
    await expect(card(adminPage, 'Dead')).toBeVisible();
    await expectSummary(adminPage, 'Dead', '— · 0▲ 0▼ 1 n/a', {
      direction: 'unavailable',
      up: '0',
      down: '0',
      flat: '0',
      unavailable: '1',
      mean: null,
    });
    const headerText = (await card(adminPage, 'Dead').locator('header').textContent()) ?? '';
    expect(headerText).not.toContain('NaN');
    expect(headerText).not.toContain('%');
    await expectSummary(adminPage, 'Chips', CHIPS_TEXT, CHIPS);
    expect(adminCounter.total, 'reactive re-render issues no request').toBe(before);

    // Restore the fixture.
    await admin.mutation(anyApi.stocks.update, {
      id: fail._id,
      ticker: 'FAIL',
      name: 'FailCo',
      tags: ['Chips'],
    });
    await expect(card(adminPage, 'Dead')).toHaveCount(0);
    await expectSummary(adminPage, 'Chips', CHIPS_TEXT, CHIPS);
    expect(adminCounter.total).toBe(before);
  });

  test('SS-E-5 (criterion 5, 13): add NVDA to Tech via Edit form → "+30.00% · 1▲ 1▼ 1 flat" without refresh; delete → back to "+45.00% · 1▲ 1▼"', async () => {
    const before = adminCounter.total;

    await row(adminPage, 'NVDA').first().getByTestId('edit-stock').click();
    await expect(adminPage.getByTestId('stock-form')).toBeVisible();
    await adminPage.getByTestId('stock-form-tags').fill('Tech');
    await adminPage.getByTestId('stock-form-tags').press('Enter');
    await adminPage.getByTestId('stock-form-save').click();
    await expect(adminPage.getByTestId('stock-form')).toHaveCount(0);

    await expect(card(adminPage, 'Tech').locator(row(adminPage, 'NVDA'))).toHaveCount(1);
    await expectSummary(adminPage, 'Tech', '+30.00% · 1▲ 1▼ 1 flat', {
      direction: 'up',
      up: '1',
      down: '1',
      flat: '1',
      unavailable: '0',
      mean: '30',
    });
    await expect(adminPage.getByTestId('stock-row')).toHaveCount(6);
    await expect(adminPage.getByTestId('stock-change')).toHaveCount(6);
    await adminPage.waitForTimeout(1000);
    expect(adminCounter.total, 'edit of an already-quoted ticker issues no request').toBe(before);

    // Delete NVDA from the Tech card; the stock is removed from the board.
    await card(adminPage, 'Tech').locator(row(adminPage, 'NVDA')).getByTestId('delete-stock').click();
    await expect(adminPage.getByTestId('confirm-delete')).toBeVisible();
    await adminPage.getByTestId('confirm-delete').click();
    await expect(row(adminPage, 'NVDA')).toHaveCount(0);

    await expectSummary(adminPage, 'Tech', TECH_TEXT, TECH);
    // Chips is now FAIL alone: all-unavailable (same rule as criterion 4).
    await expectSummary(adminPage, 'Chips', '— · 0▲ 0▼ 1 n/a', {
      direction: 'unavailable',
      up: '0',
      down: '0',
      flat: '0',
      unavailable: '1',
      mean: null,
    });
    await adminPage.waitForTimeout(1000);
    expect(adminCounter.total, 'delete issues no request').toBe(before);
  });

  test('SS-E-7g (criterion 7 board leg, D3): mean 0.001 renders "+0.00%" with direction up', async () => {
    await admin.mutation(anyApi.stocks.add, { ticker: 'TINY', name: 'Tiny', tags: ['Tiny'] });
    await expect(card(adminPage, 'Tiny')).toBeVisible();
    // A server-side add fetches nothing until a refresh (D8: unavailable).
    await expectSummary(adminPage, 'Tiny', '— · 0▲ 0▼ 1 n/a', {
      direction: 'unavailable',
      up: '0',
      down: '0',
      flat: '0',
      unavailable: '1',
      mean: null,
    });
    const before = adminCounter.total;
    await adminPage.getByTestId('refresh-prices').click();
    await expect.poll(() => adminCounter.total, { timeout: 15_000 }).toBe(before + 4);
    await expectSummary(adminPage, 'Tiny', '+0.00% · 1▲ 0▼', {
      direction: 'up',
      up: '1',
      down: '0',
      flat: '0',
      unavailable: '0',
      mean: '0.001',
    });
    // The row shows the same value the same way (D3).
    await expect(row(adminPage, 'TINY').getByTestId('stock-change')).toHaveText('+0.00%');
    await expect(row(adminPage, 'TINY').getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'up'
    );
  });
});
