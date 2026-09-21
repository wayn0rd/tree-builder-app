/**
 * Cycle 1 (refreshed harness) — Route rows 1–5 of .loopzai/spec.md
 * "Success criteria": `/api/stock` 200 bodies gain `name`
 * (longName → shortName → null); every error path is unchanged.
 *
 * FROZEN — derived solely from .loopzai/spec.md + .loopzai/spec-amendments.md
 * (test-plan rows taken from .loopzai/implementation-plan.md, which is
 * non-authoritative), implemented BEFORE reading execution-log.md or the
 * implementation diff. Committed to git at Verification attempt 1; later
 * attempts run this file unchanged.
 *
 * Live-API flake rule (copied verbatim from the frozen tests/api.spec.ts —
 * never imported from a frozen file): on 502/500, retry up to 3× with a
 * 30 s wait, for rows that expect 200. Rows that expect a non-200 retry
 * only on 500 (route-side network failure), never on 502.
 */
import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';

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

/** For rows expecting a non-200: retry only when our route reports a network failure (500). */
async function getRetryOn500(
  request: APIRequestContext,
  url: string
): Promise<APIResponse> {
  let res = await request.get(url);
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (res.status() !== 500) return res;
    console.log(
      `Route network failure (HTTP 500) on ${url}; ` +
        `flake-rule retry ${attempt}/3 after 30s wait`
    );
    await new Promise((r) => setTimeout(r, 30_000));
    res = await request.get(url);
  }
  return res;
}

const REQUIRED_KEYS = [
  'ticker',
  'price',
  'previousClose',
  'changePercent',
  'historicalPrice',
  'name',
];

test.describe('AF-API: /api/stock name key (live Yahoo)', () => {
  test('AF-API-1 (criterion 1): AAPL -> 200, all keys incl. name === "Apple Inc."', async ({
    request,
  }) => {
    const res = await getWithFlakeRetry(request, `${BASE}/api/stock?ticker=AAPL`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const key of REQUIRED_KEYS) {
      expect(body, `missing key ${key}`).toHaveProperty(key);
    }
    expect(body.ticker).toBe('AAPL');
    expect(typeof body.price).toBe('number');
    expect(body.name).toBe('Apple Inc.');
  });

  test('AF-API-2 (criterion 2): ^GSPC -> 200 with name === "S&P 500"', async ({
    request,
  }) => {
    const res = await getWithFlakeRetry(request, `${BASE}/api/stock?ticker=%5EGSPC`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('S&P 500');
  });

  test('AF-API-3 (criterion 3): BRK-B -> 200 with longName preferred ("Berkshire Hathaway Inc.")', async ({
    request,
  }) => {
    const res = await getWithFlakeRetry(request, `${BASE}/api/stock?ticker=BRK-B`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Berkshire Hathaway Inc.');
    expect(body.name).not.toBe('Berkshire Hathaway Inc. New');
  });

  test('AF-API-4 (criterion 4): meta without longName/shortName -> name === null (key present); existing keys unchanged', async () => {
    // Route-handler harness, no network: call the route module directly
    // with global fetch replaced by a fixture server.
    const { GET } = await import('../app/api/stock/route');
    const { NextRequest } = await import('next/server');

    const realFetch = globalThis.fetch;
    const withMeta = (extraMeta: Record<string, unknown>) => ({
      chart: {
        result: [
          {
            meta: {
              symbol: 'NONAME',
              regularMarketPrice: 10,
              previousClose: 8,
              ...extraMeta,
            },
            indicators: { quote: [{ close: [9] }] },
          },
        ],
      },
    });
    async function callRoute(fixture: unknown): Promise<{ status: number; body: any }> {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify(fixture), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })) as typeof fetch;
      const res = await GET(
        new NextRequest('http://localhost:3000/api/stock?ticker=NONAME')
      );
      return { status: res.status, body: await res.json() };
    }

    try {
      // Main check: neither longName nor shortName.
      const r = await callRoute(withMeta({}));
      expect(r.status).toBe(200);
      expect(Object.prototype.hasOwnProperty.call(r.body, 'name')).toBe(true);
      expect(r.body.name).toBeNull();
      expect(r.body).toEqual({
        ticker: 'NONAME',
        price: 10,
        previousClose: 8,
        changePercent: 25,
        historicalPrice: 9,
        name: null,
      });

      // Preference order (D4): longName → shortName → null.
      const onlyShort = await callRoute(withMeta({ shortName: 'Only Short' }));
      expect(onlyShort.status).toBe(200);
      expect(onlyShort.body.name).toBe('Only Short');

      const both = await callRoute(withMeta({ longName: 'Long', shortName: 'Short' }));
      expect(both.status).toBe(200);
      expect(both.body.name).toBe('Long');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test('AF-API-5a (criterion 5): GET /api/stock -> 400, { error: string }, no name key', async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/stock`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect('name' in body).toBe(false);
  });

  test('AF-API-5b (criterion 5): ZZZZZZZZ99 -> 404 or 502, { error: string }, no name key', async ({
    request,
  }) => {
    const res = await getRetryOn500(request, `${BASE}/api/stock?ticker=ZZZZZZZZ99`);
    expect([404, 502]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect('name' in body).toBe(false);
  });

  test('AF-API-5c (criterion 5, D3): BRK.B -> still non-200 (404 or 502), { error: string }, no name key', async ({
    request,
  }) => {
    const res = await getRetryOn500(request, `${BASE}/api/stock?ticker=BRK.B`);
    expect([404, 502]).toContain(res.status());
    const body = await res.json();
    expect(typeof body.error).toBe('string');
    expect('name' in body).toBe(false);
  });
});
