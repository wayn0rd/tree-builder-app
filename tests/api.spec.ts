/**
 * T-A: API tests (live Yahoo, ticker AAPL unless stated).
 * FROZEN — derived solely from .loopzai/spec.md §2 and §10 (T-A1..T-A6),
 * implemented before reading execution-log.md or the implementation.
 *
 * Live-API flake rule (spec §10): if Yahoo itself returns non-200 during
 * a T-A test, retry up to 3 times with >= 30s between attempts; still
 * failing after that = test failure. Yahoo-side failure surfaces from
 * our route as HTTP 502 (Yahoo non-OK) or 500 (network failure), per A5,
 * so those two statuses trigger the retry loop on tests that expect 200.
 *
 * Float comparisons: relative tolerance 1e-6 (spec §10).
 */
import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'http://localhost:3000';

async function getWithFlakeRetry(
  request: APIRequestContext,
  url: string
): Promise<APIResponse> {
  let res = await request.get(url);
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (res.status() !== 502 && res.status() !== 500) return res;
    console.log(
      `Yahoo-side failure (HTTP ${res.status()}) on ${url}; ` +
        `flake-rule retry ${attempt}/3 after 30s wait`
    );
    await new Promise((r) => setTimeout(r, 30_000));
    res = await request.get(url);
  }
  return res;
}

test.describe('T-A: API (live)', () => {
  test('T-A1 (A1): GET /api/stock?ticker=AAPL -> 200 with required keys', async ({
    request,
  }) => {
    const res = await getWithFlakeRetry(request, `${BASE}/api/stock?ticker=AAPL`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const key of [
      'ticker',
      'price',
      'previousClose',
      'changePercent',
      'historicalPrice',
    ]) {
      expect(body, `missing key ${key}`).toHaveProperty(key);
    }
    expect(body.ticker).toBe('AAPL');
    expect(typeof body.price).toBe('number');
    expect(body.price).toBeGreaterThan(0);
    expect(typeof body.previousClose).toBe('number');
    expect(body.previousClose).toBeGreaterThan(0);
  });

  test('T-A2 (A3): changePercent = ((price - previousClose) / previousClose) * 100', async ({
    request,
  }) => {
    const res = await getWithFlakeRetry(request, `${BASE}/api/stock?ticker=AAPL`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.price).toBe('number');
    expect(typeof body.previousClose).toBe('number');
    expect(typeof body.changePercent).toBe('number');
    const expected =
      ((body.price - body.previousClose) / body.previousClose) * 100;
    // relative tolerance 1e-6 (guard for expected === 0: fall back to absolute)
    const tol = Math.max(Math.abs(expected) * 1e-6, 1e-9);
    expect(Math.abs(body.changePercent - expected)).toBeLessThanOrEqual(tol);
  });

  test('T-A3 (A4): missing ticker param -> 400 with JSON error string', async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/stock`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('T-A4 (A5): garbage ticker -> {404, 502} with JSON error string', async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/stock?ticker=ZZZZZZZZ99`);
    expect([404, 502]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  test('T-A5 (D6 regression): interval=year still returns numeric historicalPrice', async ({
    request,
  }) => {
    const res = await getWithFlakeRetry(
      request,
      `${BASE}/api/stock?ticker=AAPL&interval=year`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.historicalPrice).toBe('number');
  });

  test('T-A6 (A6): route has no fs import/usage and reads no process.env', async () => {
    const routePath = path.join(
      process.cwd(),
      'app',
      'api',
      'stock',
      'route.ts'
    );
    const src = fs.readFileSync(routePath, 'utf8');
    // no fs import/usage
    expect(src).not.toMatch(
      /(from\s+['"](node:)?fs['"]|require\(\s*['"](node:)?fs['"]\s*\)|\bfs\.)/
    );
    // reads no process.env key
    expect(src).not.toMatch(/process\.env/);
  });
});
