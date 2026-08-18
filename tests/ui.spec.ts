/**
 * T-U: UI tests (Playwright, /api/stock stubbed).
 * FROZEN — derived solely from .loopzai/spec.md §3, §4, §10 (T-U1..T-U9),
 * implemented before reading execution-log.md or the implementation.
 *
 * Stub (spec §10): AAPL -> {price: 200, previousClose: 100,
 * changePercent: 100}, MSFT -> {price: 90, previousClose: 100,
 * changePercent: -10}, NVDA -> {price: 100, previousClose: 100,
 * changePercent: 0}, FAIL -> HTTP 502. Selectors are the
 * data-testid/data-* attributes committed in spec §4 — their presence is
 * itself under test.
 *
 * localStorage seeding uses the frozen S1 schema (key tickerWatchlist.v1).
 * Tag entry in the form (a freeform multi-tag input, U1) is exercised as:
 * fill the tags input with the tag text, press Enter.
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const KEY = 'tickerWatchlist.v1';

const STUB: Record<
  string,
  { price: number; previousClose: number; changePercent: number }
> = {
  AAPL: { price: 200, previousClose: 100, changePercent: 100 },
  MSFT: { price: 90, previousClose: 100, changePercent: -10 },
  NVDA: { price: 100, previousClose: 100, changePercent: 0 },
};

/** Install the /api/stock stub. Returns a live request counter. */
async function installStub(page: Page): Promise<{ count: number }> {
  const counter = { count: 0 };
  await page.route('**/api/stock*', async (route) => {
    counter.count++;
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
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

type SeedStock = { id: string; ticker: string; name: string; tags: string[] };

/** Seed localStorage with the frozen S1 schema, then reload. */
async function seed(page: Page, stocks: SeedStock[]): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([key, data]) => localStorage.setItem(key as string, data as string),
    [KEY, JSON.stringify({ version: 1, stocks })]
  );
  await page.reload();
}

async function clearStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function storedStockCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.stocks) ? parsed.stocks.length : 0;
    } catch {
      return 0;
    }
  }, KEY);
}

/** Open the add form and fill it. Tags are entered one-by-one with Enter. */
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

test.describe('T-U: UI (stubbed /api/stock)', () => {
  test.beforeEach(async ({ page }) => {
    await installStub(page);
  });

  test('T-U1 (U1, S3): add AAPL via the form; card+row appear and survive reload', async ({
    page,
  }) => {
    await clearStorage(page);
    await fillForm(page, { ticker: 'AAPL', name: 'Apple', tags: ['Tech'] });
    await page.getByTestId('stock-form-save').click();
    await expect(card(page, 'Tech')).toBeVisible();
    await expect(card(page, 'Tech').locator(row(page, 'AAPL'))).toBeVisible();
    await page.reload();
    await expect(card(page, 'Tech')).toBeVisible();
    await expect(card(page, 'Tech').locator(row(page, 'AAPL'))).toBeVisible();
  });

  test('T-U2 (S2): five invalid saves each show stock-form-error and change nothing', async ({
    page,
  }) => {
    await seed(page, [
      { id: 'AAPL', ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
    ]);

    const cases: { label: string; ticker: string; name: string; tags: string[] }[] =
      [
        { label: '(a) empty ticker', ticker: '', name: 'Apple', tags: ['Tech'] },
        { label: '(b) empty name', ticker: 'MSFT', name: '', tags: ['Tech'] },
        { label: '(c) zero tags', ticker: 'MSFT', name: 'Microsoft', tags: [] },
        {
          label: '(d) tag containing a comma',
          ticker: 'MSFT',
          name: 'Microsoft',
          tags: ['Bad,Tag'],
        },
        {
          label: '(e) duplicate ticker aapl',
          ticker: 'aapl',
          name: 'Apple Again',
          tags: ['Tech'],
        },
      ];

    for (const c of cases) {
      await page.reload(); // reset form state between cases
      const before = await storedStockCount(page);
      await fillForm(page, { ticker: c.ticker, name: c.name, tags: c.tags });
      await page.getByTestId('stock-form-save').click();
      await expect(
        page.getByTestId('stock-form-error'),
        `${c.label}: stock-form-error should be visible`
      ).toBeVisible();
      const after = await storedStockCount(page);
      expect(after, `${c.label}: stored stock count must be unchanged`).toBe(
        before
      );
    }
  });

  test('T-U3 (U4, U6): price/change formatting, direction attributes, FAIL isolation', async ({
    page,
  }) => {
    await seed(page, [
      { id: 'AAPL', ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
      { id: 'MSFT', ticker: 'MSFT', name: 'Microsoft', tags: ['Tech'] },
      { id: 'NVDA', ticker: 'NVDA', name: 'Nvidia', tags: ['Tech'] },
      { id: 'FAIL', ticker: 'FAIL', name: 'FailCo', tags: ['Tech'] },
    ]);

    const aapl = row(page, 'AAPL').first();
    await expect(aapl.getByTestId('stock-price')).toHaveText('$200.00');
    await expect(aapl.getByTestId('stock-change')).toHaveText('+100.00%');
    await expect(aapl.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'up'
    );

    const msft = row(page, 'MSFT').first();
    await expect(msft.getByTestId('stock-change')).toHaveText('-10.00%');
    await expect(msft.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'down'
    );

    const nvda = row(page, 'NVDA').first();
    await expect(nvda.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'flat'
    );

    const fail = row(page, 'FAIL').first();
    await expect(fail.getByTestId('stock-price')).toHaveText('—');
    await expect(fail.getByTestId('stock-change')).toHaveText('—');
    await expect(fail.getByTestId('stock-change')).toHaveAttribute(
      'data-direction',
      'unavailable'
    );

    // U6 isolation: the other rows still render alongside the failed one
    await expect(aapl.getByTestId('stock-price')).toHaveText('$200.00');
    await expect(msft.getByTestId('stock-change')).toHaveText('-10.00%');
  });

  test('T-U4 (U3, D5): multi-tag stock on every matching card; card and row ordering', async ({
    page,
  }) => {
    await seed(page, [
      { id: 'AAPL', ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
    ]);
    await fillForm(page, {
      ticker: 'MSFT',
      name: 'Microsoft',
      tags: ['Tech', 'Cloud'],
    });
    await page.getByTestId('stock-form-save').click();

    await expect(card(page, 'Tech').locator(row(page, 'MSFT'))).toBeVisible();
    await expect(card(page, 'Cloud').locator(row(page, 'MSFT'))).toBeVisible();

    // cards sorted case-insensitively ascending: Cloud before Tech
    const cardTags = await page
      .locator('[data-testid="sector-card"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-tag')));
    expect(cardTags).toEqual(['Cloud', 'Tech']);

    // within the Tech card, rows sorted ascending by ticker: AAPL before MSFT
    const techTickers = await card(page, 'Tech')
      .locator('[data-testid="stock-row"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-ticker')));
    expect(techTickers).toEqual(['AAPL', 'MSFT']);
  });

  test('T-U5 (U5, D4): tag chip filtering syncs with URL; deep link restores; clear resets', async ({
    page,
  }) => {
    await seed(page, [
      { id: 'AAPL', ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
      { id: 'MSFT', ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
    ]);

    await page.locator('[data-testid="tag-chip"][data-tag="Cloud"]').click();
    await expect(card(page, 'Cloud')).toBeVisible();
    await expect(card(page, 'Tech')).toBeHidden();
    await expect(page).toHaveURL(/tags=Cloud/);

    // fresh navigation directly to the deep link
    await page.goto('/?tags=Cloud');
    await expect(card(page, 'Cloud')).toBeVisible();
    await expect(card(page, 'Tech')).toBeHidden();

    await page.getByTestId('clear-tag-filter').click();
    await expect(card(page, 'Cloud')).toBeVisible();
    await expect(card(page, 'Tech')).toBeVisible();
    await expect(page).not.toHaveURL(/[?&]tags=/);
  });

  test('T-U6 (U2): edit updates in place; delete requires confirm, empties Cloud card, survives reload', async ({
    page,
  }) => {
    await seed(page, [
      { id: 'AAPL', ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
      { id: 'MSFT', ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
    ]);

    // edit MSFT: change its name
    await row(page, 'MSFT').first().getByTestId('edit-stock').click();
    await expect(page.getByTestId('stock-form')).toBeVisible();
    await page.getByTestId('stock-form-name').fill('Microsoft Corp');
    await page.getByTestId('stock-form-save').click();
    await expect(row(page, 'MSFT').first()).toContainText('Microsoft Corp');

    // delete MSFT with confirmation
    await row(page, 'MSFT').first().getByTestId('delete-stock').click();
    await page.getByTestId('confirm-delete').click();
    await expect(row(page, 'MSFT')).toHaveCount(0);
    await expect(card(page, 'Cloud')).toBeHidden();

    await page.reload();
    await expect(row(page, 'MSFT')).toHaveCount(0);
    await expect(card(page, 'Cloud')).toBeHidden();
  });

  test('T-U7 (U7, S4): empty state on no data; corrupt localStorage does not crash', async ({
    page,
  }) => {
    // (i) cleared localStorage -> empty-state
    await clearStorage(page);
    await expect(page.getByTestId('empty-state')).toBeVisible();

    // (ii) unparseable stored JSON -> loads without page error, empty-state
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    await page.evaluate(
      (key) => localStorage.setItem(key, 'not json{'),
      KEY
    );
    await page.reload();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    expect(
      pageErrors.map((e) => String(e)),
      'no uncaught page errors with corrupt localStorage'
    ).toEqual([]);
  });

  test('T-U8 (D2, U6): refresh fetches exactly once per ticker; no auto-polling over 30s', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    // beforeEach installed a stub without exposing its counter; replace it.
    await page.unroute('**/api/stock*');
    const counter = await installStub(page);

    await seed(page, [
      { id: 'AAPL', ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
      { id: 'MSFT', ticker: 'MSFT', name: 'Microsoft', tags: ['Tech'] },
    ]);

    // wait for the load-triggered fetch to settle (prices rendered)
    await expect(
      row(page, 'AAPL').first().getByTestId('stock-price')
    ).toHaveText('$200.00');
    await page.waitForTimeout(2000); // flush any trailing load fetches; ensure timestamp will differ

    const baseline = counter.count;
    const lastRefreshedBefore = await page
      .getByTestId('last-refreshed')
      .textContent();

    await page.getByTestId('refresh-prices').click();

    // exactly one new fetch per stored ticker (2 stocks)
    await expect
      .poll(() => counter.count, { timeout: 15_000 })
      .toBe(baseline + 2);
    await page.waitForTimeout(2000);
    expect(counter.count, 'no extra fetches beyond one per ticker').toBe(
      baseline + 2
    );

    // last-refreshed changed
    await expect(page.getByTestId('last-refreshed')).not.toHaveText(
      lastRefreshedBefore ?? ''
    );

    // 30-second idle: zero additional /api/stock requests
    const afterRefresh = counter.count;
    await page.waitForTimeout(30_000);
    expect(counter.count, 'no auto-polling during 30s idle').toBe(afterRefresh);
  });

  test('T-U9 (P1): no TreeBuilder UI reachable; no app/ file references it', async ({
    page,
  }) => {
    await clearStorage(page);
    // no canvas/node/connector UI on the rendered page
    expect(await page.locator('canvas').count()).toBe(0);

    // static check: app/page.tsx does not import TreeBuilder, and no file
    // under app/ references it
    const appDir = path.join(process.cwd(), 'app');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
          if (fs.readFileSync(full, 'utf8').includes('TreeBuilder')) {
            offenders.push(full);
          }
        }
      }
    };
    walk(appDir);
    expect(offenders, 'app/ files referencing TreeBuilder').toEqual([]);
  });
});
