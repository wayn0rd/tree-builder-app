/**
 * V: Cycle-3 cycle-scoped evidence (gated by LOOPZAI_CYCLE=3).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 3, revision 2:
 * §2 D10, D11, D14; §9.5 V1, V2) and .loopzai/spec-amendments.md (empty),
 * implemented before reading execution-log.md or the implementation diff.
 *
 * These prove that THIS cycle's implementation stayed inside its fence.
 * Per D14 every test begins with
 *   test.skip(process.env.LOOPZAI_CYCLE !== '3', 'cycle-3 scoped evidence')
 * so a run without LOOPZAI_CYCLE=3 reports them SKIPPED, never failed.
 * BASE is cycle-scoped evidence only, never a durable test input.
 */
import { test, expect, BrowserContext } from '@playwright/test';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BASE = '3be145036f2c35f644a1fe0b895b39a784cca29c'; // spec §9.5
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
};

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

function git(args: string[]): string[] {
  const out = execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

test.describe('V (cycle 3): cycle-scoped evidence', () => {
  test('V1 (D1, D5, D6, D11, P2, P3): execution diff stays inside the fence', async () => {
    test.skip(process.env.LOOPZAI_CYCLE !== '3', 'cycle-3 scoped evidence');

    const diffed = git(['diff', '--name-only', BASE, '--', '.', ':!.loopzai']);
    const untracked = git([
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
      '.',
      ':!.loopzai',
    ]);
    const changed = Array.from(new Set([...diffed, ...untracked]))
      .filter((p) => !/^tests\/cycle3-/.test(p))
      .filter((p) => !p.startsWith('convex/_generated/'))
      .sort();

    // Evidence for the verification report (spec §9.5).
    console.log('V1 CHANGED = ' + JSON.stringify(changed));

    const forbiddenPrefixes = [
      'convex/',
      'lib/',
      'app/shared/',
      'app/api/',
      'app/admin/',
      'tests/',
    ];
    const forbiddenExact = [
      'components/StockForm.tsx',
      'components/SectorCard.tsx',
      'components/WatchlistBoard.tsx',
      'components/SharePanel.tsx',
      'playwright.config.ts',
      'package.json',
    ];
    const violations = changed.filter(
      (p) =>
        forbiddenPrefixes.some((pre) => p.startsWith(pre)) ||
        forbiddenExact.includes(p) ||
        (/^app\/.*page\.tsx$/.test(p) && p !== 'app/page.tsx')
    );
    expect(
      violations,
      `paths outside the D11 fence (full CHANGED: ${JSON.stringify(changed)})`
    ).toEqual([]);
  });

  test('V2 (D10): no Escape semantics added outside the Manage Stocks flow', async ({
    browser,
  }) => {
    test.skip(process.env.LOOPZAI_CYCLE !== '3', 'cycle-3 scoped evidence');

    // Own reset + ADMIN sign-in + Node-client seed of AAPL.
    const http = new ConvexHttpClient(convexUrl());
    await http.mutation(anyApi.testing.reset, { secret: SECRET });
    const res: any = await http.action(anyApi.auth.signIn, {
      provider: 'test-login',
      params: { email: ADMIN, secret: SECRET },
    });
    const token = res?.tokens?.token;
    if (!token) throw new Error('test-login sign-in returned no token');
    http.setAuth(token);
    await http.mutation(anyApi.stocks.add, {
      ticker: 'AAPL',
      name: 'Apple',
      tags: ['Tech'],
    });

    const ctx = await browser.newContext({ viewport: VIEWPORT });
    await installStub(ctx);
    const page = await ctx.newPage();
    await page.setViewportSize(VIEWPORT);
    await page.goto('/');
    await expect(page.getByTestId('signin-screen')).toBeVisible();
    await page.getByTestId('test-signin-email').fill(ADMIN);
    await page.getByTestId('test-signin-secret').fill(SECRET);
    await page.getByTestId('test-signin-submit').click();
    await page.reload();

    const modal = page.getByTestId('manage-stocks-modal');
    const backdrop = page.getByTestId('manage-stocks-backdrop');
    const brow = page.locator('[data-testid="stock-row"][data-ticker="AAPL"]');
    const stockForm = page.getByTestId('stock-form');
    const confirmDelete = page.getByTestId('confirm-delete');
    const cancelIn = (scope: ReturnType<typeof page.locator>) =>
      scope.getByRole('button', { name: 'Cancel', exact: true });

    await expect(brow.first()).toBeVisible();
    await expect(modal).toHaveCount(0);
    await expect(backdrop).toHaveCount(0);

    // (a) card-opened Edit does not react to Escape
    await brow.first().getByTestId('edit-stock').click();
    await expect(stockForm).toBeVisible();
    await expect(stockForm.locator('h1, h2, h3')).toHaveText('Edit AAPL');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(stockForm).toHaveCount(1);
    await expect(stockForm).toBeVisible();
    await cancelIn(stockForm).click();
    await expect(stockForm).toHaveCount(0);
    await expect(modal).toHaveCount(0);
    await expect(backdrop).toHaveCount(0);

    // (b) card-opened Delete does not react to Escape
    await brow.first().getByTestId('delete-stock').click();
    await expect(confirmDelete).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(confirmDelete).toBeVisible();
    // its Cancel: the Cancel button inside confirm-delete's fixed overlay
    const overlay = await confirmDelete.evaluateHandle((node) => {
      let p: Element | null = (node as Element).parentElement;
      while (p && getComputedStyle(p).position !== 'fixed') p = p.parentElement;
      if (!p) throw new Error('overlayOf: no position:fixed ancestor');
      return p;
    });
    const buttons = await overlay.asElement()!.$$('button');
    let clicked = false;
    for (const b of buttons) {
      if (((await b.textContent()) ?? '').trim() === 'Cancel') {
        await b.click();
        clicked = true;
        break;
      }
    }
    expect(clicked, 'delete-confirm must have a Cancel button').toBe(true);
    await expect(confirmDelete).toHaveCount(0);
    expect(await brow.count()).toBeGreaterThanOrEqual(1);
    await expect(modal).toHaveCount(0);
    await expect(backdrop).toHaveCount(0);

    // (c) + Add stock does not react to Escape
    await page.getByTestId('add-stock-button').click();
    await expect(stockForm).toBeVisible();
    await expect(stockForm.locator('h1, h2, h3')).toHaveText('Add stock');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(stockForm).toHaveCount(1);
    await expect(stockForm).toBeVisible();
    await cancelIn(stockForm).click();
    await expect(stockForm).toHaveCount(0);
    await expect(modal).toHaveCount(0);
    await expect(backdrop).toHaveCount(0);

    await ctx.close();
  });
});
