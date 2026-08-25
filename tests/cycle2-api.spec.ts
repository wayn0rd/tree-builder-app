/**
 * T-A7 (D9): /api/stock stays unauthenticated. Cycle 2 addition to the
 * retained Cycle-1 T-A suite (tests/api.spec.ts, unmodified per D12).
 *
 * FROZEN — derived solely from .loopzai/spec.md §10, implemented before
 * reading execution-log.md or the implementation diff.
 *
 * Live-API flake rule (spec §10 T-A): on Yahoo-side failure (502/500),
 * retry up to 3x with >= 30s waits.
 */
import { test, expect, APIResponse } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('T-A7: /api/stock unauthenticated (live)', () => {
  test('T-A7 (D9): GET /api/stock?ticker=AAPL with no cookies and no auth headers -> 200', async ({
    playwright,
  }) => {
    // A brand-new request context: no cookies, no storage state, and no
    // extra headers beyond defaults — explicitly none auth-related.
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: {},
    });
    let res: APIResponse = await ctx.get(`${BASE}/api/stock?ticker=AAPL`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (res.status() !== 502 && res.status() !== 500) break;
      console.log(
        `Yahoo-side failure (HTTP ${res.status()}); flake-rule retry ` +
          `${attempt}/3 after 30s wait`
      );
      await new Promise((r) => setTimeout(r, 30_000));
      res = await ctx.get(`${BASE}/api/stock?ticker=AAPL`);
    }
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ticker).toBe('AAPL');
    await ctx.dispose();
  });
});
