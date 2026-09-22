/**
 * WC-E: Cycle-3 (CSV) durable E2E tests (Playwright, /api/stock stubbed).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 3 "CSV export /
 * import": Behaviour changes, D1–D17, Success criteria 1, 7–20, 21 (server
 * leg)) and .loopzai/spec-amendments.md (empty), with the test plan in
 * .loopzai/implementation-plan.md as the non-authoritative row source,
 * implemented BEFORE reading execution-log.md or the implementation diff.
 *
 * Harness (identical to the frozen cycle-2/3, autofill and sector-summary
 * suites): dev Convex deployment from .env.local (refuses prod),
 * testing.reset, Node-client seeding as ADMIN, browser sign-in via the
 * test form, viewport 1280x720, one serial describe, one long-lived ADMIN
 * context. The stub answers NVDA (name "NVIDIA Corporation"), NONAME
 * (name null) with 200 and every other ticker with 404; `delays[T]` holds
 * T's response for that many ms (criteria 17–18 "delayed" = 6000 >= 5 s).
 * Requests are logged as raw `ticker` params and compared as multisets.
 */
import { test, expect, Page, BrowserContext, Download } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import * as fs from 'fs';
import * as path from 'path';

const SECRET = 'loopzai-e2e-dev-secret';
const ADMIN = 'trixiematic415@gmail.com';
const OUTSIDER = 'e2e-outsider@example.com';
const VIEWPORT = { width: 1280, height: 720 };

type Seed = { ticker: string; name: string; tags: string[] };
const FIXTURE: Seed[] = [
  { ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
  { ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
];

// File texts (spec "Success criteria"; \n and \r are real control characters).
const FILE_A =
  'ticker,name,tags\naapl,Apple Inc.,Tech\nNVDA,,"Chips,Tech"\nGOOG,Alphabet,\nBAD TICKER,Bad,Tech\nNVDA,NVIDIA dup,Chips\nNONAME,,Misc\n';
const FILE_12 = 'ticker,name,tags\nNVDA,NVIDIA,Chips\nNONAME,,Misc\n';
const FILE_15a = 'ticker,name,tags\nNVDA,NVIDIA,\nNVDA,NVIDIA,Chips\n';
const FILE_15b = 'ticker,name,tags\nNVDA,NVIDIA,Chips\nNVDA,NVIDIA,\n';
const FILE_16 = 'ticker,name\nNVDA,NVIDIA\n';
const FILE_X = 'ticker,name,tags\nNVDA,,Chips\n';
const FILE_Y = 'ticker,name,tags\nNONAME,,Misc\n';
const HEADER_ONLY = 'ticker,name,tags\n';
const UNREADABLE: { name: string; text: string; error: string }[] = [
  { name: 'empty.csv', text: '', error: 'The file is empty.' },
  { name: 'blank.csv', text: '  \n\t\n', error: 'The file is empty.' },
  { name: 'symbol.csv', text: 'symbol,name,tags\nAAPL,Apple,Tech\n', error: 'Missing required column: ticker.' },
  { name: 'open1.csv', text: 'ticker,name,tags\nX,"open,A\n', error: 'Could not parse the CSV: unterminated quoted field.' },
  { name: 'open2.csv', text: 'ticker,name,tags\nX,"open\nY,Yes,B\n', error: 'Could not parse the CSV: unterminated quoted field.' },
];

const MSG_TICKER = 'Ticker is required: 1–10 characters, letters/digits/. ^ - only.';
const MSG_TAGS = 'At least one tag is required.';
const MSG_MISS = 'name = ticker (lookup found nothing)';
const EXPORT_FIXTURE_BYTES = 'ticker,name,tags\nAAPL,Apple,Tech\nMSFT,Microsoft,"Tech,Cloud"\n';

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

// ---- /api/stock stub with request log and per-ticker delays -------------
const log: string[] = [];
const delays: Record<string, number> = {};

async function installStub(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/api/stock*', async (route) => {
    const url = new URL(route.request().url());
    const raw = url.searchParams.get('ticker') || '';
    const ticker = raw.toUpperCase();
    log.push(raw);
    const d = delays[ticker];
    if (d) await new Promise((r) => setTimeout(r, d));
    if (ticker === 'NVDA' || ticker === 'NONAME') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ticker,
          price: 100,
          previousClose: 100,
          changePercent: 0,
          historicalPrice: 100,
          name: ticker === 'NVDA' ? 'NVIDIA Corporation' : null,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'stubbed unknown ticker' }),
    });
  });
}

const sortedUpper = (xs: string[]) => xs.map((s) => s.toUpperCase()).sort();

// ---- Convex helpers -------------------------------------------------------
async function resetDeployment(): Promise<void> {
  const c = new ConvexHttpClient(convexUrl());
  await c.mutation(anyApi.testing.reset, { secret: SECRET });
}

async function nodeSignIn(email: string): Promise<ConvexHttpClient> {
  const client = new ConvexHttpClient(convexUrl());
  const res: any = await client.action(anyApi.auth.signIn, {
    provider: 'test-login',
    params: { email, secret: SECRET },
  });
  const token = res?.tokens?.token;
  if (!token) {
    throw new Error(`test-login sign-in for ${email} returned no tokens.token: ${JSON.stringify(res)}`);
  }
  client.setAuth(token);
  return client;
}

let admin: ConvexHttpClient;

async function list(): Promise<Seed[]> {
  const rows: any[] = await admin.query(anyApi.stocks.list, {});
  return rows
    .map((r) => ({ ticker: String(r.ticker), name: String(r.name), tags: [...(r.tags as string[])] }))
    .sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0));
}

// ---- Browser helpers ------------------------------------------------------
async function signInViaForm(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('signin-screen')).toBeVisible();
  await page.getByTestId('test-signin-email').fill(email);
  await page.getByTestId('test-signin-secret').fill(SECRET);
  await page.getByTestId('test-signin-submit').click();
}

/** reset → Node sign-in → seed FIXTURE (+ extra) → fresh browser sign-in → settle. */
async function freshFixture(page: Page, extra: Seed[] = []): Promise<void> {
  await resetDeployment();
  admin = await nodeSignIn(ADMIN);
  for (const s of [...FIXTURE, ...extra]) {
    await admin.mutation(anyApi.stocks.add, { ticker: s.ticker, name: s.name, tags: s.tags });
  }
  // reset wipes sessions; drop the browser's stale token and sign in again.
  await page.goto('/');
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await signInViaForm(page, ADMIN);
  await expect(page.getByTestId('manage-stocks-button')).toBeVisible();
  await page.waitForTimeout(2000); // let load-triggered quote fetches settle
}

const backdrop = (page: Page) => page.getByTestId('manage-stocks-backdrop');
const modal = (page: Page) => page.getByTestId('manage-stocks-modal');
const mrows = (page: Page) => page.getByTestId('manage-stocks-row');
const mrow = (page: Page, t: string) => page.locator(`[data-testid="manage-stocks-row"][data-ticker="${t}"]`);
const card = (page: Page, tag: string) => page.locator(`[data-testid="sector-card"][data-tag="${tag}"]`);
const exportBtn = (page: Page) => page.getByTestId('manage-stocks-export');
const importBtn = (page: Page) => page.getByTestId('manage-stocks-import');
const fileInput = (page: Page) => page.getByTestId('manage-stocks-import-file');
const panel = (page: Page) => page.getByTestId('manage-stocks-import-panel');
const summary = (page: Page) => page.getByTestId('manage-stocks-import-summary');
const errorEl = (page: Page) => page.getByTestId('manage-stocks-import-error');
const irows = (page: Page) => page.getByTestId('manage-stocks-import-row');
const irow = (page: Page, n: number) =>
  page.locator(`[data-testid="manage-stocks-import-row"][data-row="${n}"]`);
const confirmBtn = (page: Page) => page.getByTestId('manage-stocks-import-confirm');
const cancelBtn = (page: Page) => page.getByTestId('manage-stocks-import-cancel');
const doneBtn = (page: Page) => page.getByTestId('manage-stocks-import-done');
/** Page-wide (not modal-scoped) confirm locator — criterion 17 "anywhere on the page". */
const anyConfirm = (page: Page) => page.locator('[data-testid="manage-stocks-import-confirm"]');

async function openModal(page: Page): Promise<void> {
  await expect(modal(page)).toHaveCount(0);
  await page.getByTestId('manage-stocks-button').click();
  await expect(modal(page)).toBeVisible();
  await expect(backdrop(page)).toBeVisible();
}

async function closeModalViaX(page: Page): Promise<void> {
  await page.getByTestId('manage-stocks-close').click();
  await expect(modal(page)).toHaveCount(0);
}

type Box = { x: number; y: number; width: number; height: number };
async function box(loc: ReturnType<Page['locator']>): Promise<Box> {
  const b = await loc.boundingBox();
  expect(b, 'boundingBox must be non-null').not.toBeNull();
  return b!;
}

/** Backdrop click computed from bounding boxes (frozen cycle-3 convention). */
async function clickManageBackdrop(page: Page): Promise<void> {
  const bb = await box(backdrop(page));
  const mb = await box(modal(page));
  const x = (bb.x + mb.x) / 2;
  const y = mb.y + mb.height / 2;
  expect(x < mb.x, 'backdrop click point must be left of the panel').toBe(true);
  await page.mouse.click(x, y);
}

async function chooseFile(page: Page, name: string, text: string | Buffer): Promise<void> {
  const buffer = typeof text === 'string' ? Buffer.from(text, 'utf8') : text;
  await fileInput(page).setInputFiles({ name, mimeType: 'text/csv', buffer });
}

async function exportBytes(page: Page): Promise<{ download: Download; buf: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download'), exportBtn(page).click()]);
  const p = await download.path();
  expect(p, 'download must have a path').not.toBeNull();
  return { download, buf: fs.readFileSync(p!) };
}

async function expectRow(page: Page, n: number, ticker: string, outcome: string, ...contains: string[]): Promise<void> {
  const r = irow(page, n);
  await expect(r, `row ${n} present`).toHaveCount(1);
  await expect(r).toHaveAttribute('data-ticker', ticker);
  await expect(r).toHaveAttribute('data-outcome', outcome);
  for (const s of contains) await expect(r).toContainText(s);
}

async function mrowTickers(page: Page): Promise<string[]> {
  return mrows(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-ticker') ?? ''));
}

/** Criterion 19: modal shape while the panel is showing. */
async function assertModalShape(page: Page): Promise<void> {
  const m = modal(page);
  await expect(m.locator('h1, h2, h3')).toHaveCount(1);
  await expect(m.locator('h1, h2, h3')).toHaveText('Manage Stocks');
  await expect(m).not.toContainText('Add stock');
  await expect(m.getByTestId('add-stock-button')).toHaveCount(0);
  await expect(m.getByTestId('stock-price')).toHaveCount(0);
  await expect(m.getByTestId('stock-change')).toHaveCount(0);
}

async function waitUntil(t0: number, ms: number, page: Page): Promise<void> {
  const left = ms - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
}

/** Leave the panel and return to the list (Cancel when offered, else ✕ + reopen). */
async function leavePanel(page: Page): Promise<void> {
  if ((await cancelBtn(page).count()) > 0) {
    await cancelBtn(page).click();
  } else {
    await closeModalViaX(page);
    await openModal(page);
  }
  await expect(panel(page)).toHaveCount(0);
}

// -----------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

let adminCtx: BrowserContext;
let adminPage: Page;
let l0: Seed[];

test.describe('WC-E (cycle 3): CSV export / import E2E (Playwright, stubbed /api/stock)', () => {
  test.beforeAll(async ({ browser }) => {
    await resetDeployment();
    admin = await nodeSignIn(ADMIN);
    adminCtx = await browser.newContext({ viewport: VIEWPORT });
    await installStub(adminCtx);
    adminPage = await adminCtx.newPage();
    await adminPage.setViewportSize(VIEWPORT);
    await signInViaForm(adminPage, ADMIN);
    await expect(adminPage.getByTestId('manage-stocks-button')).toBeVisible();
    await adminPage.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    await adminCtx?.close();
  });

  test('WC-E-20e/1e (criteria 20, 1): empty watchlist — both buttons, no panel, export is the header line alone', async () => {
    await openModal(adminPage);
    await expect(adminPage.getByTestId('manage-stocks-empty')).toHaveText('No stocks yet.');
    await expect(exportBtn(adminPage)).toBeVisible();
    await expect(exportBtn(adminPage)).toHaveText('Export CSV');
    await expect(importBtn(adminPage)).toBeVisible();
    await expect(importBtn(adminPage)).toHaveText('Import CSV');
    await expect(panel(adminPage)).toHaveCount(0);
    const { download, buf } = await exportBytes(adminPage);
    expect(download.suggestedFilename()).toBe('sector-watchlist.csv');
    expect(buf.equals(Buffer.from('ticker,name,tags\n')), `bytes: ${JSON.stringify(buf.toString('utf8'))}`).toBe(true);
    await closeModalViaX(adminPage);
  });

  test('WC-E-20/1 (criteria 20, 1, D2, D3): fixture export bytes; no request, no write', async () => {
    await freshFixture(adminPage);
    await openModal(adminPage);
    await expect(mrows(adminPage)).toHaveCount(2);
    await expect(exportBtn(adminPage)).toBeVisible();
    await expect(importBtn(adminPage)).toBeVisible();
    await expect(panel(adminPage)).toHaveCount(0);

    const base = log.length;
    l0 = await list();
    expect(l0.map((s) => s.ticker)).toEqual(['AAPL', 'MSFT']);

    const { download, buf } = await exportBytes(adminPage);
    expect(download.suggestedFilename()).toBe('sector-watchlist.csv');
    expect(buf.equals(Buffer.from(EXPORT_FIXTURE_BYTES)), `bytes: ${JSON.stringify(buf.toString('utf8'))}`).toBe(true);
    expect([buf[0], buf[1], buf[2]], 'no BOM: first bytes are "tic"').toEqual([0x74, 0x69, 0x63]);
    expect(buf.includes(0x0d), 'no CR').toBe(false);

    await adminPage.waitForTimeout(1500);
    expect(log.length, 'export issues no /api/stock request').toBe(base);
    expect(await list()).toEqual(l0);
  });

  test('WC-E-7/8/19a (criteria 7, 8, 19, D7–D9): File A preview — summary, six rows, two lookups, write-free', async () => {
    const base = log.length;
    await chooseFile(adminPage, 'file-a.csv', FILE_A);
    await expect(panel(adminPage)).toBeVisible();
    await expect(panel(adminPage)).toHaveAttribute('data-phase', 'preview');
    await expect(summary(adminPage)).toHaveText('Add 2 · Skip 2 · Reject 2');
    await expect(irows(adminPage)).toHaveCount(6);
    await expectRow(adminPage, 1, 'AAPL', 'skipped', 'already in the watchlist');
    await expectRow(adminPage, 2, 'NVDA', 'added', 'NVIDIA Corporation');
    await expectRow(adminPage, 3, 'GOOG', 'rejected', MSG_TAGS);
    await expectRow(adminPage, 4, 'BAD TICKER', 'rejected', MSG_TICKER);
    await expectRow(adminPage, 5, 'NVDA', 'skipped', 'duplicate of row 2');
    await expectRow(adminPage, 6, 'NONAME', 'added', 'NONAME', MSG_MISS);
    await expect(confirmBtn(adminPage)).toHaveText('Import 2 stocks');
    await adminPage.waitForTimeout(1000);
    expect(sortedUpper(log.slice(base)), 'exactly one lookup each for NVDA and NONAME').toEqual(['NONAME', 'NVDA']);
    expect(await list()).toEqual(l0);
    await assertModalShape(adminPage);
  });

  test('WC-E-9 (criterion 9): Cancel returns to the two-row list; no request, no write', async () => {
    const base = log.length;
    await cancelBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
    await expect(mrows(adminPage)).toHaveCount(2);
    expect(await mrowTickers(adminPage)).toEqual(['AAPL', 'MSFT']);
    await adminPage.waitForTimeout(1000);
    expect(log.length).toBe(base);
    expect(await list()).toEqual(l0);
  });

  test('WC-E-16 (criterion 16, D6): no tags column → rejected, only Cancel, no lookup', async () => {
    const base = log.length;
    await chooseFile(adminPage, 'no-tags.csv', FILE_16);
    await expect(summary(adminPage)).toHaveText('Add 0 · Skip 0 · Reject 1');
    await expect(irows(adminPage)).toHaveCount(1);
    await expectRow(adminPage, 1, 'NVDA', 'rejected', MSG_TAGS);
    await expect(confirmBtn(adminPage)).toHaveCount(0);
    await expect(cancelBtn(adminPage)).toBeVisible();
    await adminPage.waitForTimeout(1000);
    expect(log.length).toBe(base);
    expect(await list()).toEqual(l0);
    await cancelBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
  });

  test('WC-E-15c (criterion 15 contrast, D8): duplicate of an eligible row is skipped even with bad tags', async () => {
    const base = log.length;
    await chooseFile(adminPage, 'dup-first.csv', FILE_15b);
    await expect(summary(adminPage)).toHaveText('Add 1 · Skip 1 · Reject 0');
    await expect(irows(adminPage)).toHaveCount(2);
    await expectRow(adminPage, 1, 'NVDA', 'added', 'NVIDIA');
    await expectRow(adminPage, 2, 'NVDA', 'skipped', 'duplicate of row 1');
    await expect(confirmBtn(adminPage)).toHaveText('Import 1 stock');
    await adminPage.waitForTimeout(1000);
    expect(log.length, 'non-blank name → no lookup').toBe(base);
    await cancelBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
    expect(await list()).toEqual(l0);
  });

  test('WC-E-13 (criteria 13, 4): header-only file and the five unreadable files', async () => {
    await chooseFile(adminPage, 'header.csv', HEADER_ONLY);
    await expect(panel(adminPage)).toBeVisible();
    await expect(summary(adminPage)).toHaveText('Add 0 · Skip 0 · Reject 0');
    await expect(irows(adminPage)).toHaveCount(0);
    await expect(confirmBtn(adminPage)).toHaveCount(0);
    await expect(cancelBtn(adminPage)).toBeVisible();
    expect(await list()).toEqual(l0);

    for (const f of UNREADABLE) {
      await chooseFile(adminPage, f.name, f.text);
      await expect(panel(adminPage)).toBeVisible();
      await expect(errorEl(adminPage), f.name).toHaveText(f.error);
      await expect(summary(adminPage), f.name).toHaveCount(0);
      await expect(irows(adminPage), f.name).toHaveCount(0);
      await expect(confirmBtn(adminPage), f.name).toHaveCount(0);
      expect(await list(), f.name).toEqual(l0);
    }
    await leavePanel(adminPage);
    await expect(mrows(adminPage)).toHaveCount(2);
    expect(await list()).toEqual(l0);
  });

  test('WC-E-17 (criterion 17, D17): stale lookup after Cancel, Escape and backdrop dismissal', async () => {
    delays.NVDA = 6000;
    try {
      // Cancel variant
      let t0 = Date.now();
      await chooseFile(adminPage, 'x.csv', FILE_X);
      await expect(panel(adminPage)).toContainText('Looking up 1 name…');
      await expect(confirmBtn(adminPage)).toHaveCount(0);
      await cancelBtn(adminPage).click();
      await expect(panel(adminPage)).toHaveCount(0);
      await expect(mrows(adminPage)).toHaveCount(2);
      await waitUntil(t0, 7000, adminPage);
      await expect(panel(adminPage)).toHaveCount(0);
      await expect(anyConfirm(adminPage)).toHaveCount(0);
      await expect(mrows(adminPage)).toHaveCount(2);
      expect(await list()).toEqual(l0);

      // Escape variant
      t0 = Date.now();
      await chooseFile(adminPage, 'x.csv', FILE_X);
      await expect(panel(adminPage)).toContainText('Looking up 1 name…');
      await expect(confirmBtn(adminPage)).toHaveCount(0);
      await adminPage.keyboard.press('Escape');
      await expect(modal(adminPage)).toHaveCount(0);
      await waitUntil(t0, 7000, adminPage);
      await expect(modal(adminPage)).toHaveCount(0);
      await expect(anyConfirm(adminPage)).toHaveCount(0);
      await openModal(adminPage);
      await expect(mrows(adminPage)).toHaveCount(2);
      await expect(panel(adminPage)).toHaveCount(0);
      await expect(confirmBtn(adminPage)).toHaveCount(0);
      expect(await list()).toEqual(l0);

      // Backdrop variant
      t0 = Date.now();
      await chooseFile(adminPage, 'x.csv', FILE_X);
      await expect(panel(adminPage)).toContainText('Looking up 1 name…');
      await expect(confirmBtn(adminPage)).toHaveCount(0);
      await clickManageBackdrop(adminPage);
      await expect(modal(adminPage)).toHaveCount(0);
      await waitUntil(t0, 7000, adminPage);
      await expect(modal(adminPage)).toHaveCount(0);
      await expect(anyConfirm(adminPage)).toHaveCount(0);
      await openModal(adminPage);
      await expect(mrows(adminPage)).toHaveCount(2);
      await expect(panel(adminPage)).toHaveCount(0);
      await expect(confirmBtn(adminPage)).toHaveCount(0);
    } finally {
      delete delays.NVDA;
    }
    expect(await list()).toEqual(l0);
  });

  test('WC-E-18 (criterion 18, D17): stale lookup after a replacement file never reaches the panel or stocks.add', async () => {
    await expect(modal(adminPage)).toBeVisible();
    await expect(panel(adminPage)).toHaveCount(0);
    delays.NVDA = 6000;
    try {
      const t0 = Date.now();
      await chooseFile(adminPage, 'x.csv', FILE_X);
      await expect(panel(adminPage)).toContainText('Looking up 1 name…');
      await chooseFile(adminPage, 'y.csv', FILE_Y);
      await expect(summary(adminPage)).toHaveText('Add 1 · Skip 0 · Reject 0');
      await expect(irows(adminPage)).toHaveCount(1);
      await expectRow(adminPage, 1, 'NONAME', 'added', 'NONAME', MSG_MISS);
      await expect(confirmBtn(adminPage)).toHaveText('Import 1 stock');

      await waitUntil(t0, 7000, adminPage);
      await expect(irows(adminPage)).toHaveCount(1);
      await expect(summary(adminPage)).toHaveText('Add 1 · Skip 0 · Reject 0');
      await expect(confirmBtn(adminPage)).toHaveText('Import 1 stock');
      await expect(panel(adminPage)).not.toContainText('NVDA');
      await expectRow(adminPage, 1, 'NONAME', 'added', 'NONAME', MSG_MISS);

      await confirmBtn(adminPage).click();
      await expect(panel(adminPage)).toHaveAttribute('data-phase', 'report');
      await expect(summary(adminPage)).toHaveText('Added 1 · Skipped 0 · Rejected 0');
      const after = await list();
      expect(after.map((s) => s.ticker)).toEqual(['AAPL', 'MSFT', 'NONAME']);
      expect(after.some((s) => s.ticker === 'NVDA')).toBe(false);
      await doneBtn(adminPage).click();
      await expect(panel(adminPage)).toHaveCount(0);
      expect(await mrowTickers(adminPage)).toEqual(['AAPL', 'MSFT', 'NONAME']);
    } finally {
      delete delays.NVDA;
    }
    await closeModalViaX(adminPage);
  });

  test('WC-E-21s (criterion 21, D4): stocks.add rejects a comma inside a tag and writes nothing', async () => {
    const before = await list();
    await expect(
      admin.mutation(anyApi.stocks.add, { ticker: 'ZZZ', name: 'Z', tags: ['A,B'] })
    ).rejects.toThrow(/Tags may not contain commas\./);
    const after = await list();
    expect(after.some((s) => s.ticker === 'ZZZ')).toBe(false);
    expect(after).toEqual(before);
  });

  test('WC-E-10/19b (criteria 10, 19, D11, D12): confirm File A — report, writes, cards, one quote fetch per added ticker, persistence', async () => {
    await freshFixture(adminPage);
    l0 = await list();
    await openModal(adminPage);
    await chooseFile(adminPage, 'file-a.csv', FILE_A);
    await expect(summary(adminPage)).toHaveText('Add 2 · Skip 2 · Reject 2');
    await expect(confirmBtn(adminPage)).toHaveText('Import 2 stocks');
    await adminPage.waitForTimeout(500);
    const base = log.length;

    await confirmBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveAttribute('data-phase', 'report');
    await expect(summary(adminPage)).toHaveText('Added 2 · Skipped 2 · Rejected 2');
    await expect(summary(adminPage)).not.toContainText('Failed');
    await expect(irows(adminPage)).toHaveCount(6);
    await expectRow(adminPage, 1, 'AAPL', 'skipped', 'already in the watchlist');
    await expectRow(adminPage, 2, 'NVDA', 'added', 'NVIDIA Corporation');
    await expectRow(adminPage, 3, 'GOOG', 'rejected', MSG_TAGS);
    await expectRow(adminPage, 4, 'BAD TICKER', 'rejected', MSG_TICKER);
    await expectRow(adminPage, 5, 'NVDA', 'skipped', 'duplicate of row 2');
    await expectRow(adminPage, 6, 'NONAME', 'added', 'NONAME');

    await expect.poll(() => list().then((l) => l.length), { timeout: 15_000 }).toBe(4);
    const after = await list();
    expect(after.map((s) => s.ticker)).toEqual(['AAPL', 'MSFT', 'NONAME', 'NVDA']);
    expect(after.find((s) => s.ticker === 'NVDA')).toEqual({
      ticker: 'NVDA',
      name: 'NVIDIA Corporation',
      tags: ['Chips', 'Tech'],
    });
    expect(after.find((s) => s.ticker === 'NONAME')).toEqual({ ticker: 'NONAME', name: 'NONAME', tags: ['Misc'] });
    expect(after.filter((s) => s.ticker === 'AAPL' || s.ticker === 'MSFT')).toEqual(l0);

    await expect(card(adminPage, 'Chips')).not.toHaveCount(0);
    await expect(card(adminPage, 'Misc')).not.toHaveCount(0);

    await expect
      .poll(() => sortedUpper(log.slice(base)), { timeout: 15_000 })
      .toEqual(['NONAME', 'NVDA']);
    await adminPage.waitForTimeout(10_000);
    expect(log.length, 'no further /api/stock request within 10 s').toBe(base + 2);

    await assertModalShape(adminPage);

    await doneBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
    await expect(mrows(adminPage)).toHaveCount(4);
    expect(await mrowTickers(adminPage)).toEqual(['AAPL', 'MSFT', 'NONAME', 'NVDA']);
    for (const t of ['AAPL', 'MSFT', 'NONAME', 'NVDA']) {
      await expect(mrow(adminPage, t).getByTestId('manage-stocks-edit')).toHaveCount(1);
      await expect(mrow(adminPage, t).getByTestId('manage-stocks-delete')).toHaveCount(1);
    }
    await closeModalViaX(adminPage);

    await adminPage.reload();
    await expect(adminPage.getByTestId('manage-stocks-button')).toBeVisible();
    await expect(card(adminPage, 'Chips')).not.toHaveCount(0);
    await expect(card(adminPage, 'Misc')).not.toHaveCount(0);
    await adminPage.waitForTimeout(2000);
    await openModal(adminPage);
    await expect(mrows(adminPage)).toHaveCount(4);
    expect(await mrowTickers(adminPage)).toEqual(['AAPL', 'MSFT', 'NONAME', 'NVDA']);
  });

  test('WC-E-11 (criterion 11, D7): re-importing File A is a no-op — Add 0, no confirm, no request', async () => {
    const before = await list();
    expect(before.map((s) => s.ticker)).toEqual(['AAPL', 'MSFT', 'NONAME', 'NVDA']);
    const base = log.length;
    await chooseFile(adminPage, 'file-a.csv', FILE_A);
    await expect(summary(adminPage)).toHaveText('Add 0 · Skip 4 · Reject 2');
    await expect(irows(adminPage)).toHaveCount(6);
    await expect(confirmBtn(adminPage)).toHaveCount(0);
    await expect(cancelBtn(adminPage)).toBeVisible();
    await adminPage.waitForTimeout(1000);
    expect(log.length, 'zero /api/stock requests').toBe(base);
    await cancelBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
    expect(await list()).toEqual(before);
    await closeModalViaX(adminPage);
  });

  test('WC-E-14 (criterion 14, D3, D4): export then import of the download → Add 0 · Skip 3 · Reject 0', async () => {
    await freshFixture(adminPage, [{ ticker: 'FOO', name: 'Foo, Inc.', tags: ['A', 'B'] }]);
    await openModal(adminPage);
    await expect(mrows(adminPage)).toHaveCount(3);
    const { download, buf } = await exportBytes(adminPage);
    expect(download.suggestedFilename()).toBe('sector-watchlist.csv');
    expect(
      buf.equals(Buffer.from('ticker,name,tags\nAAPL,Apple,Tech\nFOO,"Foo, Inc.","A,B"\nMSFT,Microsoft,"Tech,Cloud"\n')),
      `bytes: ${JSON.stringify(buf.toString('utf8'))}`
    ).toBe(true);
    const before = await list();
    await chooseFile(adminPage, 'sector-watchlist.csv', buf);
    await expect(summary(adminPage)).toHaveText('Add 0 · Skip 3 · Reject 0');
    await expect(irows(adminPage)).toHaveCount(3);
    await expect(confirmBtn(adminPage)).toHaveCount(0);
    await cancelBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
    expect(await list()).toEqual(before);
    await closeModalViaX(adminPage);
  });

  test('WC-E-12 (criterion 12, D11): apply-time refusal — failed row reported, the rest applied, nothing fetched for the failed row', async () => {
    await freshFixture(adminPage);
    await openModal(adminPage);
    await chooseFile(adminPage, 'race.csv', FILE_12);
    await expect(summary(adminPage)).toHaveText('Add 2 · Skip 0 · Reject 0');
    await expect(confirmBtn(adminPage)).toHaveText('Import 2 stocks');

    const second = await nodeSignIn(ADMIN);
    await second.mutation(anyApi.stocks.add, { ticker: 'NVDA', name: 'NVIDIA', tags: ['Chips'] });
    await expect
      .poll(() => list().then((l) => l.some((s) => s.ticker === 'NVDA')), { timeout: 15_000 })
      .toBe(true);
    await adminPage.waitForTimeout(2000);
    // Outcomes are fixed at preview: the panel still reads Add 2.
    await expect(summary(adminPage)).toHaveText('Add 2 · Skip 0 · Reject 0');
    const base = log.length;

    await confirmBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveAttribute('data-phase', 'report');
    await expect(summary(adminPage)).toHaveText('Added 1 · Skipped 0 · Rejected 0 · Failed 1');
    await expectRow(adminPage, 1, 'NVDA', 'failed', 'NVDA is already in the watchlist.');
    await expectRow(adminPage, 2, 'NONAME', 'added');
    const after = await list();
    expect(after.filter((s) => s.ticker === 'NVDA')).toHaveLength(1);
    expect(after.filter((s) => s.ticker === 'NONAME')).toHaveLength(1);
    expect(after.map((s) => s.ticker)).toEqual(['AAPL', 'MSFT', 'NONAME', 'NVDA']);
    await expect.poll(() => sortedUpper(log.slice(base)), { timeout: 15_000 }).toEqual(['NONAME']);
    await adminPage.waitForTimeout(1500);
    expect(sortedUpper(log.slice(base)), 'nothing fetched for the failed row').toEqual(['NONAME']);
    await doneBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
    await closeModalViaX(adminPage);
  });

  test('WC-E-15 (criterion 15, D7, D8): first eligible occurrence wins — preview, confirm, stored row', async () => {
    await freshFixture(adminPage);
    await openModal(adminPage);
    const base = log.length;
    await chooseFile(adminPage, 'first-eligible.csv', FILE_15a);
    await expect(summary(adminPage)).toHaveText('Add 1 · Skip 0 · Reject 1');
    await expect(irows(adminPage)).toHaveCount(2);
    await expectRow(adminPage, 1, 'NVDA', 'rejected', MSG_TAGS);
    await expectRow(adminPage, 2, 'NVDA', 'added', 'NVIDIA');
    await expect(confirmBtn(adminPage)).toHaveText('Import 1 stock');
    await adminPage.waitForTimeout(1000);
    expect(log.length, 'non-blank name → zero /api/stock requests').toBe(base);

    await confirmBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveAttribute('data-phase', 'report');
    await expect(summary(adminPage)).toHaveText('Added 1 · Skipped 0 · Rejected 1');
    const after = await list();
    expect(after.filter((s) => s.ticker === 'NVDA')).toEqual([{ ticker: 'NVDA', name: 'NVIDIA', tags: ['Chips'] }]);
    expect(after.map((s) => s.ticker)).toEqual(['AAPL', 'MSFT', 'NVDA']);
    await doneBtn(adminPage).click();
    await expect(panel(adminPage)).toHaveCount(0);
    expect(await mrowTickers(adminPage)).toEqual(['AAPL', 'MSFT', 'NVDA']);
    await closeModalViaX(adminPage);
  });

  test('WC-E-20x (criterion 20): no manage-stocks-* element on the shared page, the not-invited wall or /admin', async ({
    browser,
  }) => {
    await adminPage.getByTestId('share-button').click();
    await expect(adminPage.getByTestId('share-panel')).toBeVisible();
    await adminPage.getByTestId('share-create').click();
    const urlEl = adminPage.getByTestId('share-created-url');
    await expect(urlEl).toBeVisible();
    const urlText = (await urlEl.textContent()) ?? '';
    const m = urlText.match(/\/shared\/([A-Za-z0-9_-]{32,})/);
    expect(m, 'share-created-url must contain /shared/<token>').not.toBeNull();
    const sharedPath = `/shared/${m![1]}`;

    const anonCtx = await browser.newContext({ viewport: VIEWPORT });
    await installStub(anonCtx);
    const anonPage = await anonCtx.newPage();
    await anonPage.setViewportSize(VIEWPORT);
    await anonPage.goto(sharedPath);
    await expect(anonPage.getByTestId('sector-card')).not.toHaveCount(0);
    await expect(anonPage.locator('[data-testid^="manage-stocks-"]')).toHaveCount(0);
    await anonCtx.close();

    const outCtx = await browser.newContext({ viewport: VIEWPORT });
    await installStub(outCtx);
    const outPage = await outCtx.newPage();
    await outPage.setViewportSize(VIEWPORT);
    await signInViaForm(outPage, OUTSIDER);
    await expect(outPage.getByTestId('not-invited')).toBeVisible();
    await expect(outPage.locator('[data-testid^="manage-stocks-"]')).toHaveCount(0);
    await outPage.goto('/admin');
    await outPage.waitForLoadState('networkidle');
    await expect(outPage.locator('[data-testid^="manage-stocks-"]')).toHaveCount(0);
    await outCtx.close();
  });
});
