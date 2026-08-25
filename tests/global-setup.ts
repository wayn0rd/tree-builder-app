/**
 * Cycle-2 e2e harness warm-up.
 *
 * Authorized by .loopzai/spec-amendments.md — escalation resolution
 * (2026-08-25T21:09:00Z): "the Playwright harness must issue a warm-up
 * navigation to `/` and wait for the route to compile [...] before any
 * e2e test executes, so no test's first navigation doubles as the dev
 * server's first-request compile."
 *
 * This changes harness timing only. No test's assertions, scope, or
 * pass criteria are altered; no frozen test file is modified.
 *
 * Mechanism: a real browser navigation (not a bare HTTP fetch) so the
 * on-demand-compiled `_next` chunks — the artifact that actually broke
 * in verification attempt 3 ("Invalid or unexpected token" pageerror on
 * the first request after a fresh dev-server start) — are fetched and
 * executed. The navigation is retried until the page loads with an OK
 * response and zero pageerrors, or the deadline passes.
 */
import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const DEADLINE_MS = 120_000;
const RETRY_PAUSE_MS = 2_000;

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const browser = await chromium.launch();
  const start = Date.now();
  try {
    const page = await browser.newPage();
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    let lastFailure: unknown = null;
    while (Date.now() - start < DEADLINE_MS) {
      pageErrors.length = 0;
      try {
        const response = await page.goto(`${BASE_URL}/`, {
          waitUntil: 'networkidle',
          timeout: 60_000,
        });
        if (response && response.ok() && pageErrors.length === 0) {
          // Route compiled; chunks fetched and executed cleanly.
          return;
        }
        lastFailure =
          pageErrors[0] ??
          new Error(`warm-up navigation got HTTP ${response?.status()}`);
      } catch (err) {
        lastFailure = err;
      }
      await page.waitForTimeout(RETRY_PAUSE_MS);
    }
    throw new Error(
      `e2e warm-up: "/" never loaded cleanly within ${DEADLINE_MS}ms; last failure: ${String(
        lastFailure,
      )}`,
    );
  } finally {
    await browser.close();
  }
}
