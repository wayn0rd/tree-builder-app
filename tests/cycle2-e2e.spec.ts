/**
 * T-E: E2E tests (Playwright, quote stub active). Cycle 2.
 *
 * FROZEN — derived solely from .loopzai/spec.md (§1 D1–D11, §4 U1–U6,
 * §10 T-E1..T-E9) and .loopzai/spec-amendments.md, implemented before
 * reading execution-log.md or the implementation diff.
 *
 * Quote stub (spec §10): AAPL -> {price: 200, previousClose: 100,
 * changePercent: 100}, MSFT -> {price: 90, previousClose: 100,
 * changePercent: -10}, NVDA -> {price: 100, previousClose: 100,
 * changePercent: 0}, FAIL -> HTTP 502. Route interception works for
 * owner and shared pages alike (D9).
 *
 * The web server must run with NEXT_PUBLIC_E2E_TEST_MODE=1 (the
 * Playwright webServer config does this) so the test sign-in form
 * (D10/U1) exists. Tests are serial and build state in spec order,
 * sharing long-lived browser contexts per identity.
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import * as fs from 'fs';
import * as path from 'path';

const SECRET = 'loopzai-e2e-dev-secret'; // frozen, spec §10
const ADMIN = 'trixiematic415@gmail.com';
const INVITED = 'e2e-invited@example.com';
const OUTSIDER = 'e2e-outsider@example.com';

const STUB: Record<
  string,
  { price: number; previousClose: number; changePercent: number }
> = {
  AAPL: { price: 200, previousClose: 100, changePercent: 100 },
  MSFT: { price: 90, previousClose: 100, changePercent: -10 },
  NVDA: { price: 100, previousClose: 100, changePercent: 0 },
};

function convexUrl(): string {
  const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!m) throw new Error('NEXT_PUBLIC_CONVEX_URL not found in .env.local');
  return m[1].trim();
}

type Counter = { total: number; byTicker: Record<string, number> };

/** Install the /api/stock stub on a whole context; returns request counter. */
async function installStub(ctx: BrowserContext): Promise<Counter> {
  const counter: Counter = { total: 0, byTicker: {} };
  await ctx.route('**/api/stock*', async (route) => {
    counter.total++;
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
    counter.byTicker[ticker] = (counter.byTicker[ticker] || 0) + 1;
    if (ticker === 'FAIL') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'stubbed upstream failure' }),
      });
      return;
    }
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

/** Sign in via the env-gated test form (D10/U1). */
async function signInViaForm(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('signin-screen')).toBeVisible();
  await page.getByTestId('test-signin-email').fill(email);
  await page.getByTestId('test-signin-secret').fill(SECRET);
  await page.getByTestId('test-signin-submit').click();
}

/** Open the add form and fill it (Cycle-1 interaction semantics, D11). */
async function fillForm(
  page: Page,
  opts: { ticker: string; name: string; tags: string[] }
): Promise<void> {
  await page.getByTestId('add-stock-button').click();
  await expect(page.getByTestId('stock-form')).toBeVisible();
  await page.getByTestId('stock-form-ticker').fill(opts.ticker);
  await page.getByTestId('stock-form-name').fill(opts.name);
  for (const tag of opts.tags) {
    await page.getByTestId('stock-form-tags').fill(tag);
    await page.getByTestId('stock-form-tags').press('Enter');
  }
}

const card = (page: Page, tag: string) =>
  page.locator(`[data-testid="sector-card"][data-tag="${tag}"]`);
const row = (page: Page, ticker: string) =>
  page.locator(`[data-testid="stock-row"][data-ticker="${ticker}"]`);

const ABSENT_ON_SHARED = [
  'add-stock-button',
  'edit-stock',
  'delete-stock',
  'stock-form',
  'share-button',
  'admin-link',
  'signout-button',
];

test.describe.configure({ mode: 'serial' });

let adminCtx: BrowserContext;
let adminPage: Page;
let adminCounter: Counter;
let invitedCtx: BrowserContext;
let invitedPage: Page;
let sharedUrlPath: string; // captured in T-E7

test.describe('T-E: E2E (Playwright, stubbed quotes)', () => {
  test.beforeAll(async ({ browser }) => {
    // Reset (spec §10 Environment) so runs are repeatable.
    const c = new ConvexHttpClient(convexUrl());
    await c.mutation(anyApi.testing.reset, { secret: SECRET });

    adminCtx = await browser.newContext();
    adminCounter = await installStub(adminCtx);
    adminPage = await adminCtx.newPage();
    invitedCtx = await browser.newContext();
    await installStub(invitedCtx);
    invitedPage = await invitedCtx.newPage();
  });

  test.afterAll(async () => {
    await adminCtx?.close();
    await invitedCtx?.close();
  });

  test('T-E1 (D2, U1): unauthenticated / shows only the sign-in screen', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await installStub(ctx);
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByTestId('signin-screen')).toBeVisible();
    await expect(page.getByTestId('signin-google')).toBeVisible();
    await expect(page.getByTestId('sector-card')).toHaveCount(0);
    await expect(page.getByTestId('stock-row')).toHaveCount(0);
    await expect(page.getByTestId('add-stock-button')).toHaveCount(0);
    await ctx.close();
  });

  test('T-E2 (D4, U2): OUTSIDER hits the not-invited wall; sign-out returns to sign-in', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await installStub(ctx);
    const page = await ctx.newPage();
    await signInViaForm(page, OUTSIDER);
    await expect(page.getByTestId('not-invited')).toBeVisible();
    await expect(page.getByTestId('signout-button')).toBeVisible();
    await expect(page.getByTestId('add-stock-button')).toHaveCount(0);
    await expect(page.getByTestId('sector-card')).toHaveCount(0);
    await page.getByTestId('signout-button').click();
    await expect(page.getByTestId('signin-screen')).toBeVisible();
    await ctx.close();
  });

  test('T-E3 (D1, U3): ADMIN fresh account; add AAPL; persists to a second browser', async ({
    browser,
  }) => {
    await signInViaForm(adminPage, ADMIN);
    await expect(adminPage.getByTestId('empty-state')).toBeVisible();
    await expect(adminPage.getByTestId('user-email')).toContainText(ADMIN);
    await expect(adminPage.getByTestId('admin-link')).toBeVisible();

    await fillForm(adminPage, { ticker: 'AAPL', name: 'Apple', tags: ['Tech'] });
    await adminPage.getByTestId('stock-form-save').click();
    await expect(card(adminPage, 'Tech')).toBeVisible();
    await expect(
      card(adminPage, 'Tech').locator(row(adminPage, 'AAPL'))
    ).toBeVisible();

    // Second browser context, same identity: cloud persistence (D1).
    const ctx2 = await browser.newContext();
    await installStub(ctx2);
    const page2 = await ctx2.newPage();
    await signInViaForm(page2, ADMIN);
    await expect(card(page2, 'Tech')).toBeVisible();
    await expect(card(page2, 'Tech').locator(row(page2, 'AAPL'))).toBeVisible();
    await ctx2.close();
  });

  test('T-E4 (D5, U4): admin whitelists INVITED; INVITED sees own empty list, no admin access', async () => {
    await adminPage.goto('/admin');
    await adminPage.getByTestId('whitelist-email-input').fill(INVITED);
    await adminPage.getByTestId('whitelist-add').click();
    await expect(
      adminPage.locator(
        `[data-testid="whitelist-row"][data-email="${INVITED}"]`
      )
    ).toBeVisible();

    await signInViaForm(invitedPage, INVITED);
    await expect(invitedPage.getByTestId('empty-state')).toBeVisible();
    await expect(invitedPage.getByTestId('stock-row')).toHaveCount(0); // not ADMIN's AAPL
    await expect(invitedPage.getByTestId('admin-link')).toHaveCount(0);
    await invitedPage.goto('/admin');
    await expect(invitedPage.getByTestId('admin-denied')).toBeVisible();
    await expect(invitedPage.getByTestId('whitelist-row')).toHaveCount(0);
    await invitedPage.goto('/');
  });

  test('T-E5 (D11): parity — formatting, ordering, filtering, refresh, validation', async () => {
    test.setTimeout(240_000);
    await adminPage.goto('/');
    // AAPL(Tech) exists from T-E3; add the rest.
    for (const s of [
      { ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
      { ticker: 'NVDA', name: 'Nvidia', tags: ['Chips'] },
      { ticker: 'FAIL', name: 'FailCo', tags: ['Chips'] },
    ]) {
      await fillForm(adminPage, s);
      await adminPage.getByTestId('stock-form-save').click();
      await expect(row(adminPage, s.ticker).first()).toBeVisible();
    }

    // Formatting + directions
    const aapl = row(adminPage, 'AAPL').first();
    await expect(aapl.getByTestId('stock-price')).toHaveText('$200.00');
    await expect(aapl.getByTestId('stock-change')).toHaveText('+100.00%');
    await expect(aapl.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'up'
    );
    const msft = row(adminPage, 'MSFT').first();
    await expect(msft.getByTestId('stock-change')).toHaveText('-10.00%');
    await expect(msft.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'down'
    );
    const nvda = row(adminPage, 'NVDA').first();
    await expect(nvda.getByTestId('stock-change')).toHaveText('0.00%'); // unsigned
    await expect(nvda.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'flat'
    );
    const fail = row(adminPage, 'FAIL').first();
    await expect(fail.getByTestId('stock-price')).toHaveText('—');
    await expect(fail.getByTestId('stock-change')).toHaveText('—');
    await expect(fail.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'unavailable'
    );
    await expect(aapl.getByTestId('stock-price')).toHaveText('$200.00'); // others render

    // MSFT on both cards; ordering
    await expect(card(adminPage, 'Tech').locator(row(adminPage, 'MSFT'))).toBeVisible();
    await expect(card(adminPage, 'Cloud').locator(row(adminPage, 'MSFT'))).toBeVisible();
    const cardTags = await adminPage
      .locator('[data-testid="sector-card"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-tag')));
    expect(cardTags).toEqual(['Chips', 'Cloud', 'Tech']);
    const techTickers = await card(adminPage, 'Tech')
      .locator('[data-testid="stock-row"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-ticker')));
    expect(techTickers).toEqual(['AAPL', 'MSFT']);

    // Tag filter + URL sync
    await adminPage
      .locator('[data-testid="tag-chip"][data-tag="Cloud"]')
      .click();
    await expect(card(adminPage, 'Cloud')).toBeVisible();
    await expect(card(adminPage, 'Tech')).toBeHidden();
    await expect(card(adminPage, 'Chips')).toBeHidden();
    await expect(adminPage).toHaveURL(/tags=Cloud/);
    await adminPage.goto('/?tags=Cloud'); // direct load, same signed-in context
    await expect(card(adminPage, 'Cloud')).toBeVisible();
    await expect(card(adminPage, 'Tech')).toBeHidden();
    await adminPage.getByTestId('clear-tag-filter').click();
    await expect(card(adminPage, 'Tech')).toBeVisible();
    await expect(card(adminPage, 'Cloud')).toBeVisible();
    await expect(card(adminPage, 'Chips')).toBeVisible();
    await expect(adminPage).not.toHaveURL(/[?&]tags=/);
    await adminPage.goto('/?tags=Nonexistent');
    await expect(adminPage).toHaveURL(/tags=Nonexistent/);
    await expect(adminPage.getByTestId('sector-card')).toHaveCount(0);
    await adminPage.goto('/');
    await expect(card(adminPage, 'Tech')).toBeVisible();

    // last-refreshed format; manual refresh = one request per distinct ticker
    await expect(adminPage.getByTestId('last-refreshed')).toHaveText(
      /\d{2}:\d{2}:\d{2}\.\d{3}/
    );
    await adminPage.waitForTimeout(2000); // let load-triggered fetches settle
    const baseline = { ...adminCounter.byTicker };
    const baselineTotal = adminCounter.total;
    const before = await adminPage.getByTestId('last-refreshed').textContent();
    await adminPage.getByTestId('refresh-prices').click();
    await expect
      .poll(() => adminCounter.total, { timeout: 15_000 })
      .toBe(baselineTotal + 4); // AAPL, MSFT, NVDA, FAIL — one each
    await adminPage.waitForTimeout(2000);
    expect(adminCounter.total).toBe(baselineTotal + 4);
    for (const t of ['AAPL', 'MSFT', 'NVDA', 'FAIL']) {
      expect(
        (adminCounter.byTicker[t] || 0) - (baseline[t] || 0),
        `exactly one refresh fetch for ${t}`
      ).toBe(1);
    }
    await expect(adminPage.getByTestId('last-refreshed')).not.toHaveText(
      before ?? ''
    );
    // 30-second idle: zero further /api/stock requests (no polling)
    const idleBase = adminCounter.total;
    await adminPage.waitForTimeout(30_000);
    expect(adminCounter.total, 'no auto-polling during 30s idle').toBe(
      idleBase
    );

    // Validation UX: comma tag
    await fillForm(adminPage, {
      ticker: 'GOOG',
      name: 'Alphabet',
      tags: ['Bad,Tag'],
    });
    await adminPage.getByTestId('stock-form-save').click();
    await expect(adminPage.getByTestId('stock-form-error')).toBeVisible();
    await adminPage.reload();
    await expect(row(adminPage, 'GOOG')).toHaveCount(0); // did not save

    // Validation UX: duplicate ticker aapl
    await fillForm(adminPage, {
      ticker: 'aapl',
      name: 'Apple Again',
      tags: ['Tech'],
    });
    await adminPage.getByTestId('stock-form-save').click();
    await expect(adminPage.getByTestId('stock-form-error')).toBeVisible();
    await adminPage.reload();
    await expect(row(adminPage, 'AAPL')).toHaveCount(1); // still exactly one

    // Enter creates a tag chip in the form
    await adminPage.getByTestId('add-stock-button').click();
    await expect(adminPage.getByTestId('stock-form')).toBeVisible();
    await adminPage.getByTestId('stock-form-tags').fill('Growth');
    await adminPage.getByTestId('stock-form-tags').press('Enter');
    await expect(adminPage.getByTestId('stock-form')).toContainText('Growth');
    await expect(adminPage.getByTestId('stock-form-tags')).toHaveValue('');
    await adminPage.reload(); // discard the open form
  });

  test('T-E6 (D11, F3): edit and delete persist server-side across reload', async () => {
    await adminPage.goto('/');
    await row(adminPage, 'MSFT').first().getByTestId('edit-stock').click();
    await expect(adminPage.getByTestId('stock-form')).toBeVisible();
    await adminPage.getByTestId('stock-form-name').fill('Microsoft Corp');
    await adminPage.getByTestId('stock-form-save').click();
    await expect(row(adminPage, 'MSFT').first()).toContainText(
      'Microsoft Corp'
    );

    await row(adminPage, 'NVDA').first().getByTestId('delete-stock').click();
    await adminPage.getByTestId('confirm-delete').click();
    await expect(row(adminPage, 'NVDA')).toHaveCount(0);

    await adminPage.reload();
    await expect(row(adminPage, 'MSFT').first()).toContainText(
      'Microsoft Corp'
    );
    await expect(row(adminPage, 'NVDA')).toHaveCount(0);
  });

  test('T-E7 (D7, D8, U5, U6): copy-on-create share link; anonymous read-only page; revoke', async ({
    browser,
  }) => {
    // INVITED adds AAPL + MSFT
    await invitedPage.goto('/');
    for (const s of [
      { ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
      { ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
    ]) {
      await fillForm(invitedPage, s);
      await invitedPage.getByTestId('stock-form-save').click();
      await expect(row(invitedPage, s.ticker).first()).toBeVisible();
    }

    await invitedPage.getByTestId('share-button').click();
    await expect(invitedPage.getByTestId('share-panel')).toBeVisible();
    await invitedPage.getByTestId('share-create').click();
    const urlEl = invitedPage.getByTestId('share-created-url');
    await expect(urlEl).toBeVisible();
    const urlText = (await urlEl.textContent()) ?? '';
    const m = urlText.match(/\/shared\/([A-Za-z0-9_-]{32,})/);
    expect(m, 'share-created-url must contain /shared/<token>').not.toBeNull();
    const token = m![1];
    sharedUrlPath = `/shared/${token}`;

    // Persistent list: shortened id only, never the full token
    const linkRow = invitedPage.getByTestId('share-link-row');
    await expect(linkRow).toHaveCount(1);
    await expect(linkRow.getByTestId('share-link-id')).toHaveText(
      token.slice(0, 8)
    );
    expect(await linkRow.textContent()).not.toContain(token);

    // Fresh unauthenticated context (stub active)
    const anonCtx = await browser.newContext();
    await installStub(anonCtx);
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(sharedUrlPath);
    await expect(anonPage.getByTestId('signin-screen')).toHaveCount(0); // no redirect
    expect(anonPage.url()).toContain('/shared/');
    await expect(card(anonPage, 'Tech')).toBeVisible();
    await expect(
      card(anonPage, 'Tech').locator(row(anonPage, 'AAPL'))
    ).toBeVisible();
    const aapl = row(anonPage, 'AAPL').first();
    await expect(aapl.getByTestId('stock-price')).toHaveText('$200.00');
    await expect(aapl.getByTestId('stock-change')).toHaveText('+100.00%');
    await expect(aapl.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'up'
    );
    const msft = row(anonPage, 'MSFT').first();
    await expect(msft.getByTestId('stock-change')).toHaveText('-10.00%');

    // refresh works and updates last-refreshed
    await expect(anonPage.getByTestId('last-refreshed')).toHaveText(
      /\d{2}:\d{2}:\d{2}\.\d{3}/
    );
    await anonPage.waitForTimeout(1100); // ensure the timestamp will differ
    const before = await anonPage.getByTestId('last-refreshed').textContent();
    await anonPage.getByTestId('refresh-prices').click();
    await expect(anonPage.getByTestId('last-refreshed')).not.toHaveText(
      before ?? ''
    );

    // tag filtering with ?tags= sync on the /shared/<token> URL
    await anonPage.locator('[data-testid="tag-chip"][data-tag="Cloud"]').click();
    await expect(card(anonPage, 'Cloud')).toBeVisible();
    await expect(card(anonPage, 'Tech')).toBeHidden();
    expect(anonPage.url()).toContain('/shared/');
    await expect(anonPage).toHaveURL(/tags=Cloud/);
    await anonPage.getByTestId('clear-tag-filter').click();
    await expect(card(anonPage, 'Tech')).toBeVisible();

    // strictly read-only: zero mutating/management controls
    for (const id of ABSENT_ON_SHARED) {
      await expect(
        anonPage.getByTestId(id),
        `${id} must be absent on the shared page`
      ).toHaveCount(0);
    }

    // Revoke back as INVITED; the shared URL goes dark
    await invitedPage.getByTestId('share-revoke').click();
    await expect(invitedPage.getByTestId('share-link-row')).toHaveCount(0);
    await anonPage.goto(sharedUrlPath);
    await expect(anonPage.getByTestId('share-invalid')).toBeVisible();
    await expect(anonPage.getByTestId('sector-card')).toHaveCount(0);
    await expect(anonPage.getByTestId('stock-row')).toHaveCount(0);
    await anonCtx.close();
  });

  test('T-E8 (D4, U4): whitelist removal walls INVITED off on next load', async () => {
    await adminPage.goto('/admin');
    const invitedRow = adminPage.locator(
      `[data-testid="whitelist-row"][data-email="${INVITED}"]`
    );
    await expect(invitedRow).toBeVisible();
    await invitedRow.getByTestId('whitelist-remove').click();
    await expect(invitedRow).toHaveCount(0);

    await invitedPage.goto('/');
    await expect(invitedPage.getByTestId('not-invited')).toBeVisible();
    await expect(invitedPage.getByTestId('sector-card')).toHaveCount(0);
    await expect(invitedPage.getByTestId('stock-row')).toHaveCount(0);
  });

  test('T-E9 (D8): unknown share token renders share-invalid without crashing', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    await installStub(ctx);
    const page = await ctx.newPage();
    const pageErrors: Error[] = [];
    page.on('pageerror', (e) => pageErrors.push(e));
    await page.goto('/shared/nope-000000000000000000000000000000');
    await expect(page.getByTestId('share-invalid')).toBeVisible();
    await expect(page.getByTestId('sector-card')).toHaveCount(0);
    expect(pageErrors.map(String)).toEqual([]);
    await ctx.close();
  });
});
