/**
 * T-E: Cycle-3 durable E2E tests (Playwright, quote stub active).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 3, revision 2:
 * §2 D1–D14, §3 U1–U7, §9.1 Environment, §9.2 T-E1..T-E9) and
 * .loopzai/spec-amendments.md (empty), implemented before reading
 * execution-log.md or the implementation diff.
 *
 * Harness per spec §9.1 (identical to Cycle 2's):
 * - testing.reset via ConvexHttpClient against NEXT_PUBLIC_CONVEX_URL
 *   read from .env.local (dev deployment, never prod).
 * - Test sign-in form (test-signin-email / -secret / -submit), shown
 *   under NEXT_PUBLIC_E2E_TEST_MODE=1 (Playwright webServer sets it).
 * - Node-client seeding: api.auth.signIn { provider: "test-login" },
 *   client.setAuth(tokens.token), then stocks.add per stock in order.
 * - Quote stub on every context: AAPL/MSFT/NVDA fixed values; any other
 *   ticker -> HTTP 404 JSON. No cycle-3 test reaches the live quote API.
 * - Viewport 1280x720 for every cycle-3 e2e page (page.setViewportSize).
 *
 * Durable tier (spec §9.0): these assert only user-observable behavior
 * and product contract — no commit hash, no file inventory, no CSS class,
 * no z-index, no hard-coded viewport coordinate. Every click point that
 * targets a backdrop is computed from bounding boxes.
 */
import { test, expect, Page, BrowserContext, ElementHandle } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import * as fs from 'fs';
import * as path from 'path';

const SECRET = 'loopzai-e2e-dev-secret'; // frozen, spec §9.1
const ADMIN = 'trixiematic415@gmail.com';
const OUTSIDER = 'e2e-outsider@example.com';
const VIEWPORT = { width: 1280, height: 720 }; // frozen, spec §9.1
const GAP = 8; // D12 containment gap

const STUB: Record<
  string,
  { price: number; previousClose: number; changePercent: number }
> = {
  AAPL: { price: 200, previousClose: 100, changePercent: 100 },
  MSFT: { price: 90, previousClose: 100, changePercent: -10 },
  NVDA: { price: 100, previousClose: 100, changePercent: 0 },
};

/** Seed set A — inserted in exactly this (deliberately unsorted) order. */
const SEED_A: { ticker: string; name: string; tags: string[] }[] = [
  { ticker: 'MSFT', name: 'Microsoft', tags: ['Tech', 'Cloud'] },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', tags: ['Finance'] },
  { ticker: 'NVDA', name: 'NVIDIA', tags: ['Chips', 'Tech'] },
  { ticker: 'AAPL', name: 'Apple', tags: ['Tech'] },
  { ticker: 'A', name: 'Agilent', tags: ['Health'] },
];
const SORTED_A = ['A', 'AAPL', 'BRK.B', 'MSFT', 'NVDA']; // D4

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

/** Quote stub (spec §9.1) on a whole browser context. */
async function installStub(ctx: BrowserContext): Promise<void> {
  await ctx.route('**/api/stock*', async (route) => {
    const url = new URL(route.request().url());
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();
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
}

/** Sign in via the env-gated test form (spec §9.1 Identities). */
async function signInViaForm(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('signin-screen')).toBeVisible();
  await page.getByTestId('test-signin-email').fill(email);
  await page.getByTestId('test-signin-secret').fill(SECRET);
  await page.getByTestId('test-signin-submit').click();
}

/** Node-client sign-in (spec §9.1 Node-client seeding). */
async function nodeSignIn(email: string): Promise<ConvexHttpClient> {
  const client = new ConvexHttpClient(convexUrl());
  const res: any = await client.action(anyApi.auth.signIn, {
    provider: 'test-login',
    params: { email, secret: SECRET },
  });
  const token = res?.tokens?.token;
  if (!token) {
    throw new Error(
      `test-login sign-in for ${email} returned no tokens.token: ` +
        JSON.stringify(res)
    );
  }
  client.setAuth(token);
  return client;
}

async function seedAsAdmin(
  stocks: { ticker: string; name: string; tags: string[] }[]
): Promise<void> {
  const client = await nodeSignIn(ADMIN);
  for (const s of stocks) {
    await client.mutation(anyApi.stocks.add, {
      ticker: s.ticker,
      name: s.name,
      tags: s.tags,
    });
  }
}

// ---- Locator conventions (spec §9.1) ----------------------------------
const backdrop = (page: Page) => page.getByTestId('manage-stocks-backdrop');
const modal = (page: Page) => page.getByTestId('manage-stocks-modal');
const mrow = (page: Page, t: string) =>
  page.locator(`[data-testid="manage-stocks-row"][data-ticker="${t}"]`);
const brow = (page: Page, t: string) =>
  page.locator(`[data-testid="stock-row"][data-ticker="${t}"]`);
const card = (page: Page, tag: string) =>
  page.locator(`[data-testid="sector-card"][data-tag="${tag}"]`);
const mrows = (page: Page) => page.getByTestId('manage-stocks-row');
const stockForm = (page: Page) => page.getByTestId('stock-form');
const confirmDelete = (page: Page) => page.getByTestId('confirm-delete');

type Box = { x: number; y: number; width: number; height: number };

async function box(loc: ReturnType<Page['locator']>): Promise<Box> {
  const b = await loc.boundingBox();
  expect(b, 'boundingBox must be non-null').not.toBeNull();
  return b!;
}

function insideViewport(b: Box, gap: number): boolean {
  return (
    b.x >= gap &&
    b.y >= gap &&
    b.x + b.width <= VIEWPORT.width - gap &&
    b.y + b.height <= VIEWPORT.height - gap
  );
}

function boxContains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * overlayOf(el): nearest ancestor whose computed position is `fixed`.
 * panelOf(el): the child of overlayOf(el) that contains el.
 * Evaluated in the page; returns ElementHandles.
 */
async function overlayAndPanelOf(
  page: Page,
  testId: string
): Promise<{ overlay: ElementHandle<Element>; panel: ElementHandle<Element> }> {
  const el = page.getByTestId(testId);
  await expect(el).toBeVisible();
  const overlay = (await el.evaluateHandle((node) => {
    let p: Element | null = (node as Element).parentElement;
    while (p && getComputedStyle(p).position !== 'fixed') p = p.parentElement;
    if (!p) throw new Error('overlayOf: no position:fixed ancestor');
    return p;
  })) as ElementHandle<Element>;
  const panel = (await el.evaluateHandle((node) => {
    let p: Element | null = (node as Element).parentElement;
    while (p && getComputedStyle(p).position !== 'fixed') p = p.parentElement;
    if (!p) throw new Error('panelOf: no position:fixed ancestor');
    let c: Element = node as Element;
    while (c.parentElement && c.parentElement !== p) c = c.parentElement;
    return c;
  })) as ElementHandle<Element>;
  return { overlay, panel };
}

async function handleBox(h: ElementHandle<Element>): Promise<Box> {
  const b = await h.boundingBox();
  expect(b, 'boundingBox must be non-null').not.toBeNull();
  return b!;
}

/** Backdrop click (Manage Stocks) — spec §9.1, computed from boxes. */
async function clickManageBackdrop(page: Page): Promise<void> {
  const bb = await box(backdrop(page));
  const mb = await box(modal(page));
  const x = (bb.x + mb.x) / 2;
  const y = mb.y + mb.height / 2;
  expect(
    x < mb.x,
    'computed Manage Stocks backdrop click point must be left of the panel'
  ).toBe(true);
  await page.mouse.click(x, y);
}

/** Backdrop click (child X) — spec §9.1, computed from panelOf(X). */
async function clickChildBackdrop(page: Page, childTestId: string): Promise<void> {
  const { panel } = await overlayAndPanelOf(page, childTestId);
  const pb = await handleBox(panel);
  const x = pb.x / 2;
  const y = pb.y + pb.height / 2;
  await page.mouse.click(x, y);
}

/**
 * Stacked-above check for child X (spec §9.1, used by T-E6):
 * (i) hitAt(center(panelOf(X))) is panelOf(X) or a descendant;
 * (ii) hitAt(center(modal)) is NOT modal and not a descendant of modal.
 */
async function assertStackedAbove(page: Page, childTestId: string): Promise<void> {
  const { panel } = await overlayAndPanelOf(page, childTestId);
  const pb = await handleBox(panel);
  const mb = await box(modal(page));
  const result = await page.evaluate(
    ({ panelEl, pc, mc }) => {
      const modalEl = document.querySelector(
        '[data-testid="manage-stocks-modal"]'
      );
      const hitPanel = document.elementFromPoint(pc.x, pc.y);
      const hitModal = document.elementFromPoint(mc.x, mc.y);
      const describe = (e: Element | null) =>
        e
          ? `${e.tagName.toLowerCase()}[data-testid=${e.getAttribute('data-testid')}]`
          : 'null';
      return {
        childOnTopAtOwnCenter:
          !!hitPanel && (hitPanel === panelEl || panelEl.contains(hitPanel)),
        modalCoveredAtItsCenter:
          !!hitModal &&
          !!modalEl &&
          !(hitModal === modalEl || modalEl.contains(hitModal)),
        hitPanel: describe(hitPanel),
        hitModal: describe(hitModal),
      };
    },
    {
      panelEl: panel,
      pc: { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 },
      mc: { x: mb.x + mb.width / 2, y: mb.y + mb.height / 2 },
    }
  );
  expect(
    result.childOnTopAtOwnCenter,
    `(i) ${childTestId}'s panel must be hit at its own center; hit ${result.hitPanel}`
  ).toBe(true);
  expect(
    result.modalCoveredAtItsCenter,
    `(ii) Manage Stocks panel must be covered at its center; hit ${result.hitModal}`
  ).toBe(true);
}

/** Click the `Cancel` button inside overlayOf(confirm-delete). */
async function clickDeleteConfirmCancel(page: Page): Promise<void> {
  const { overlay } = await overlayAndPanelOf(page, 'confirm-delete');
  const buttons = await overlay.$$('button');
  const cancels: ElementHandle<Element>[] = [];
  for (const b of buttons) {
    const t = ((await b.textContent()) ?? '').trim();
    if (t === 'Cancel') cancels.push(b);
  }
  expect(cancels.length, 'exactly one Cancel in the delete-confirm overlay').toBe(1);
  await cancels[0].click();
}

async function tickersInOrder(page: Page): Promise<string[]> {
  return mrows(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-ticker') ?? '')
  );
}

async function tagsOf(page: Page, ticker: string): Promise<string[]> {
  return mrow(page, ticker)
    .getByTestId('manage-stocks-tag')
    .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
}

async function openModal(page: Page): Promise<void> {
  await expect(modal(page)).toHaveCount(0);
  await page.getByTestId('manage-stocks-button').click();
  await expect(modal(page)).toBeVisible();
  await expect(backdrop(page)).toBeVisible();
}

async function closeModalViaX(page: Page): Promise<void> {
  await page.getByTestId('manage-stocks-close').click();
  await expect(modal(page)).toHaveCount(0);
  await expect(backdrop(page)).toHaveCount(0);
}

async function assertAllLayersClosed(page: Page): Promise<void> {
  await expect(modal(page)).toHaveCount(0);
  await expect(backdrop(page)).toHaveCount(0);
  await expect(stockForm(page)).toHaveCount(0);
  await expect(confirmDelete(page)).toHaveCount(0);
}

// -----------------------------------------------------------------------

test.describe.configure({ mode: 'serial' });

let adminCtx: BrowserContext;
let adminPage: Page;
let recordedPathname: string;

test.describe('T-E (cycle 3): Manage Stocks E2E (Playwright, stubbed quotes)', () => {
  test.beforeAll(async ({ browser }) => {
    // Reset (spec §9.1) so runs are repeatable.
    const c = new ConvexHttpClient(convexUrl());
    await c.mutation(anyApi.testing.reset, { secret: SECRET });

    adminCtx = await browser.newContext({ viewport: VIEWPORT });
    await installStub(adminCtx);
    adminPage = await adminCtx.newPage();
    await adminPage.setViewportSize(VIEWPORT);
  });

  test.afterAll(async () => {
    await adminCtx?.close();
  });

  test('T-E1 (U1, U7, D2, D7): owner-only surface; button text, tag, DOM order', async () => {
    // Unauthenticated /
    await adminPage.goto('/');
    await expect(adminPage.getByTestId('signin-screen')).toBeVisible();
    await expect(adminPage.getByTestId('manage-stocks-button')).toHaveCount(0);

    // Sign in as ADMIN
    await signInViaForm(adminPage, ADMIN);
    await expect(adminPage.getByTestId('empty-state')).toBeVisible();

    const btn = adminPage.getByTestId('manage-stocks-button');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Manage Stocks');
    expect(await btn.evaluate((el) => el.tagName)).toBe('BUTTON');

    // DOM order: after add-stock-button, before share-button
    const order = await adminPage.evaluate(() => {
      const add = document.querySelector('[data-testid="add-stock-button"]');
      const manage = document.querySelector('[data-testid="manage-stocks-button"]');
      const share = document.querySelector('[data-testid="share-button"]');
      if (!add || !manage || !share) return { ok: false, why: 'missing element' };
      const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
      return {
        ok:
          !!(add.compareDocumentPosition(manage) & FOLLOWING) &&
          !!(manage.compareDocumentPosition(share) & FOLLOWING),
        why: '',
      };
    });
    expect(order.ok, `manage-stocks-button must sit between add-stock-button and share-button ${order.why}`).toBe(true);

    await expect(modal(adminPage)).toHaveCount(0);
    await expect(backdrop(adminPage)).toHaveCount(0);
  });

  test('T-E2 (U2, U5, D1, D8, D12): opens in-document; empty state; close via ✕', async () => {
    recordedPathname = await adminPage.evaluate(() => location.pathname);
    expect(recordedPathname).toBe('/');

    await adminPage.getByTestId('manage-stocks-button').click();
    await expect(backdrop(adminPage)).toBeVisible();
    await expect(modal(adminPage)).toBeVisible();
    expect(await adminPage.evaluate(() => location.pathname)).toBe(recordedPathname);

    const heading = modal(adminPage).locator('h1, h2, h3');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText('Manage Stocks');

    expect(insideViewport(await box(modal(adminPage)), GAP)).toBe(true);

    const empty = adminPage.getByTestId('manage-stocks-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText('No stocks yet.');
    await expect(mrows(adminPage)).toHaveCount(0);
    await expect(modal(adminPage).getByTestId('add-stock-button')).toHaveCount(0);
    const modalText = (await modal(adminPage).textContent()) ?? '';
    expect(modalText).not.toContain('Add stock');

    await expect(adminPage.getByTestId('manage-stocks-close')).toHaveAttribute(
      'aria-label',
      'Close Manage Stocks'
    );

    await adminPage.getByTestId('manage-stocks-close').click();
    await expect(modal(adminPage)).toHaveCount(0);
    await expect(backdrop(adminPage)).toHaveCount(0);
    await expect(adminPage.getByTestId('empty-state')).toBeVisible();
    expect(await adminPage.evaluate(() => location.pathname)).toBe(recordedPathname);
  });

  test('T-E3 (U3, D3, D4, D13): list contents and ticker order', async () => {
    await seedAsAdmin(SEED_A);
    await adminPage.reload();
    await expect(brow(adminPage, 'MSFT').first()).toBeVisible();

    await openModal(adminPage);
    await expect(mrows(adminPage)).toHaveCount(5);
    expect(await tickersInOrder(adminPage)).toEqual(SORTED_A);

    await expect(mrow(adminPage, 'MSFT')).toContainText('MSFT');
    await expect(mrow(adminPage, 'MSFT')).toContainText('Microsoft');
    expect(await tagsOf(adminPage, 'MSFT')).toEqual(['Tech', 'Cloud']);
    expect(await tagsOf(adminPage, 'NVDA')).toEqual(['Chips', 'Tech']);

    for (const t of SORTED_A) {
      const edit = mrow(adminPage, t).getByTestId('manage-stocks-edit');
      const del = mrow(adminPage, t).getByTestId('manage-stocks-delete');
      await expect(edit, `${t} has exactly one Edit`).toHaveCount(1);
      await expect(edit).toHaveText('Edit');
      await expect(del, `${t} has exactly one Delete`).toHaveCount(1);
      await expect(del).toHaveText('Delete');
    }
    await expect(
      mrow(adminPage, 'BRK.B').getByTestId('manage-stocks-edit')
    ).toHaveAttribute('aria-label', 'Edit BRK.B');
    await expect(
      mrow(adminPage, 'BRK.B').getByTestId('manage-stocks-delete')
    ).toHaveAttribute('aria-label', 'Delete BRK.B');

    await expect(modal(adminPage).getByTestId('stock-price')).toHaveCount(0);
    await expect(modal(adminPage).getByTestId('stock-change')).toHaveCount(0);
    await expect(adminPage.getByTestId('manage-stocks-empty')).toHaveCount(0);

    await closeModalViaX(adminPage);
  });

  test('T-E4 (U4 edit, D6, D9, R2): Edit reuses the existing form; reactive; persisted', async () => {
    await openModal(adminPage);
    await mrow(adminPage, 'MSFT').getByTestId('manage-stocks-edit').click();

    // Stacked: the same StockForm, pre-filled
    await expect(stockForm(adminPage)).toBeVisible();
    await expect(stockForm(adminPage).locator('h1, h2, h3')).toHaveText('Edit MSFT');
    await expect(adminPage.getByTestId('stock-form-ticker')).toHaveValue('MSFT');
    await expect(adminPage.getByTestId('stock-form-name')).toHaveValue('Microsoft');
    await expect(
      stockForm(adminPage).locator('button[aria-label="Remove tag Tech"]')
    ).toHaveCount(1);
    await expect(
      stockForm(adminPage).locator('button[aria-label="Remove tag Cloud"]')
    ).toHaveCount(1);
    await expect(modal(adminPage)).toBeAttached();
    await expect(modal(adminPage)).toBeVisible();

    // Edit and save
    await adminPage.getByTestId('stock-form-name').fill('Microsoft Corp');
    await adminPage.getByTestId('stock-form-tags').fill('AI');
    await adminPage.getByTestId('stock-form-tags').press('Enter');
    await adminPage.getByTestId('stock-form-save').click();

    // After save, no reload
    await expect(stockForm(adminPage)).toHaveCount(0);
    await expect(modal(adminPage)).toBeVisible();
    await expect(mrow(adminPage, 'MSFT')).toContainText('Microsoft Corp');
    await expect
      .poll(() => tagsOf(adminPage, 'MSFT'))
      .toEqual(['Tech', 'Cloud', 'AI']);
    await expect(brow(adminPage, 'MSFT').first()).toContainText('Microsoft Corp');
    expect(await card(adminPage, 'AI').count()).toBeGreaterThanOrEqual(1);
    expect(await tickersInOrder(adminPage)).toEqual(SORTED_A);

    // Persisted server-side through the existing update path
    await adminPage.reload();
    await expect(brow(adminPage, 'MSFT').first()).toBeVisible();
    await openModal(adminPage);
    await expect(mrow(adminPage, 'MSFT')).toContainText('Microsoft Corp');
    await closeModalViaX(adminPage);
  });

  test('T-E5 (U4 delete, D6, D9, R2): Delete reuses the existing confirm; reactive; persisted', async () => {
    await openModal(adminPage);
    await mrow(adminPage, 'NVDA').getByTestId('manage-stocks-delete').click();

    // Stacked: the same delete-confirm, naming the ticker
    await expect(confirmDelete(adminPage)).toBeVisible();
    const { panel } = await overlayAndPanelOf(adminPage, 'confirm-delete');
    expect((await panel.textContent()) ?? '').toContain('NVDA');
    await expect(modal(adminPage)).toBeAttached();
    await expect(modal(adminPage)).toBeVisible();

    await confirmDelete(adminPage).click();

    // No reload
    await expect(confirmDelete(adminPage)).toHaveCount(0);
    await expect(modal(adminPage)).toBeVisible();
    await expect(mrow(adminPage, 'NVDA')).toHaveCount(0);
    await expect(mrows(adminPage)).toHaveCount(4);
    expect(await tickersInOrder(adminPage)).toEqual(['A', 'AAPL', 'BRK.B', 'MSFT']);
    await expect(brow(adminPage, 'NVDA')).toHaveCount(0);
    await expect(card(adminPage, 'Chips')).toHaveCount(0);
    expect(await card(adminPage, 'Tech').count()).toBeGreaterThanOrEqual(1);

    // Persisted through the existing remove path
    await adminPage.reload();
    await expect(brow(adminPage, 'MSFT').first()).toBeVisible();
    await openModal(adminPage);
    await expect(mrows(adminPage)).toHaveCount(4);
    await closeModalViaX(adminPage);
  });

  test('T-E6a (D9, D10): Escape with no child closes only Manage Stocks', async () => {
    await openModal(adminPage);
    await adminPage.keyboard.press('Escape');
    await assertAllLayersClosed(adminPage);
  });

  test('T-E6b (D9, D12): Manage Stocks backdrop click dismisses it', async () => {
    await openModal(adminPage);
    await clickManageBackdrop(adminPage);
    await expect(modal(adminPage)).toHaveCount(0);
    await expect(backdrop(adminPage)).toHaveCount(0);
  });

  test('T-E6c (D9, D10, D12): Edit child stacked above; Escape closes only the form', async () => {
    await openModal(adminPage);
    await mrow(adminPage, 'AAPL').getByTestId('manage-stocks-edit').click();
    await expect(stockForm(adminPage)).toBeVisible();
    await assertStackedAbove(adminPage, 'stock-form');

    await adminPage.keyboard.press('Escape'); // no typing first (R4)
    await expect(stockForm(adminPage)).toHaveCount(0);
    await expect(modal(adminPage)).toBeVisible();
    await expect(backdrop(adminPage)).toBeVisible();
    await expect(mrow(adminPage, 'AAPL')).toContainText('Apple');
    await expect(mrows(adminPage)).toHaveCount(4);
  });

  test('T-E6d (D9, D10, D12): Delete child stacked above; Escape closes only the confirm', async () => {
    await expect(modal(adminPage)).toBeVisible(); // still open from (c)
    await mrow(adminPage, 'AAPL').getByTestId('manage-stocks-delete').click();
    await expect(confirmDelete(adminPage)).toBeVisible();
    await assertStackedAbove(adminPage, 'confirm-delete');

    await adminPage.keyboard.press('Escape');
    await expect(confirmDelete(adminPage)).toHaveCount(0);
    await expect(modal(adminPage)).toBeVisible();
    await expect(mrow(adminPage, 'AAPL')).toHaveCount(1);
  });

  test('T-E6e (D9, D12): child backdrop click dismisses only the form', async () => {
    await expect(modal(adminPage)).toBeVisible(); // still open
    await mrow(adminPage, 'AAPL').getByTestId('manage-stocks-edit').click();
    await expect(stockForm(adminPage)).toBeVisible();
    await clickChildBackdrop(adminPage, 'stock-form');
    await expect(stockForm(adminPage)).toHaveCount(0);
    await expect(modal(adminPage)).toBeVisible();
  });

  test('T-E6f (D9, D10): confirm Cancel returns to the modal; Escape then closes it', async () => {
    await expect(modal(adminPage)).toBeVisible(); // still open
    await mrow(adminPage, 'AAPL').getByTestId('manage-stocks-delete').click();
    await expect(confirmDelete(adminPage)).toBeVisible();
    await clickDeleteConfirmCancel(adminPage);
    await expect(confirmDelete(adminPage)).toHaveCount(0);
    await expect(modal(adminPage)).toBeVisible();
    await expect(mrow(adminPage, 'AAPL')).toHaveCount(1);

    await adminPage.keyboard.press('Escape');
    await expect(modal(adminPage)).toHaveCount(0);
    await expect(backdrop(adminPage)).toHaveCount(0);
  });

  test('T-E7 (U5, R2): reactive empty state after deleting every stock via the modal', async () => {
    await openModal(adminPage);
    for (const t of ['A', 'AAPL', 'BRK.B', 'MSFT']) {
      await mrow(adminPage, t).getByTestId('manage-stocks-delete').click();
      await expect(confirmDelete(adminPage)).toBeVisible();
      await confirmDelete(adminPage).click();
      await expect(mrow(adminPage, t), `${t} removed from the modal`).toHaveCount(0);
    }
    await expect(modal(adminPage)).toBeVisible();
    await expect(mrows(adminPage)).toHaveCount(0);
    const empty = adminPage.getByTestId('manage-stocks-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText('No stocks yet.');
    await expect(adminPage.getByTestId('sector-card')).toHaveCount(0);
    await expect(adminPage.getByTestId('empty-state')).toBeVisible();

    await closeModalViaX(adminPage);
    await expect(adminPage.getByTestId('empty-state')).toBeVisible();
  });

  test('T-E8 (D4, D12, A1): 30-row list scrolls inside the panel; last row reachable', async () => {
    const bulk: { ticker: string; name: string; tags: string[] }[] = [];
    for (let i = 30; i >= 1; i--) {
      const nn = String(i).padStart(2, '0');
      bulk.push({ ticker: `T${nn}`, name: `Test ${nn}`, tags: ['Bulk'] });
    }
    await seedAsAdmin(bulk);
    await adminPage.reload();
    await expect(brow(adminPage, 'T01').first()).toBeVisible();

    await openModal(adminPage);
    await expect(mrows(adminPage)).toHaveCount(30);
    const expected = Array.from({ length: 30 }, (_, i) =>
      `T${String(i + 1).padStart(2, '0')}`
    );
    expect(await tickersInOrder(adminPage)).toEqual(expected);
    expect(insideViewport(await box(modal(adminPage)), GAP)).toBe(true);
    expect(await adminPage.evaluate(() => window.scrollY)).toBe(0);

    await mrow(adminPage, 'T30').scrollIntoViewIfNeeded();
    expect(await adminPage.evaluate(() => window.scrollY)).toBe(0);
    const mb = await box(modal(adminPage));
    expect(insideViewport(mb, GAP)).toBe(true);
    const rb = await box(mrow(adminPage, 'T30'));
    expect(
      boxContains(mb, rb),
      `T30 row box ${JSON.stringify(rb)} must lie inside modal box ${JSON.stringify(mb)}`
    ).toBe(true);

    await mrow(adminPage, 'T30').getByTestId('manage-stocks-edit').click();
    await expect(stockForm(adminPage)).toBeVisible();
    await expect(stockForm(adminPage).locator('h1, h2, h3')).toHaveText('Edit T30');
    await adminPage.keyboard.press('Escape');
    await expect(stockForm(adminPage)).toHaveCount(0);
    await expect(modal(adminPage)).toBeVisible();

    await closeModalViaX(adminPage);
  });

  test('T-E9 (U7, D2): absent on the shared page, the not-invited wall and /admin', async ({
    browser,
  }) => {
    // ADMIN creates a share link (stocks from T-E8 present)
    await adminPage.getByTestId('share-button').click();
    await expect(adminPage.getByTestId('share-panel')).toBeVisible();
    await adminPage.getByTestId('share-create').click();
    const urlEl = adminPage.getByTestId('share-created-url');
    await expect(urlEl).toBeVisible();
    const urlText = (await urlEl.textContent()) ?? '';
    const m = urlText.match(/\/shared\/([A-Za-z0-9_-]{32,})/);
    expect(m, 'share-created-url must contain /shared/<token>').not.toBeNull();
    const sharedPath = `/shared/${m![1]}`;

    // Fresh unauthenticated context
    const anonCtx = await browser.newContext({ viewport: VIEWPORT });
    await installStub(anonCtx);
    const anonPage = await anonCtx.newPage();
    await anonPage.setViewportSize(VIEWPORT);
    await anonPage.goto(sharedPath);
    // Amended (spec-amendments.md, cycle 3): retrying presence checks (>= 1)
    // within the frozen 15 s expect timeout instead of a 0 ms count() snapshot.
    await expect(anonPage.getByTestId('sector-card')).not.toHaveCount(0);
    await expect(anonPage.getByTestId('stock-row')).not.toHaveCount(0);
    await expect(anonPage.getByTestId('stock-row').first()).toBeVisible();
    await expect(anonPage.locator('[data-testid^="manage-stocks-"]')).toHaveCount(0);
    await expect(anonPage.getByTestId('edit-stock')).toHaveCount(0);
    await expect(anonPage.getByTestId('delete-stock')).toHaveCount(0);
    await expect(anonPage.getByTestId('add-stock-button')).toHaveCount(0);
    await anonCtx.close();

    // Fresh OUTSIDER context
    const outCtx = await browser.newContext({ viewport: VIEWPORT });
    await installStub(outCtx);
    const outPage = await outCtx.newPage();
    await outPage.setViewportSize(VIEWPORT);
    await signInViaForm(outPage, OUTSIDER);
    await expect(outPage.getByTestId('not-invited')).toBeVisible();
    await expect(outPage.locator('[data-testid^="manage-stocks-"]')).toHaveCount(0);
    await outPage.goto('/admin');
    await expect(outPage.locator('[data-testid^="manage-stocks-"]')).toHaveCount(0);
    await outCtx.close();
  });
});
