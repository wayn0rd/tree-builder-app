import { defineConfig } from '@playwright/test';

/**
 * LoopzAI verification test config (cycle 1, updated for cycle 2's frozen
 * environment: .loopzai/spec.md §10 — "Web server:
 * NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev on port 3000 (or Playwright
 * webServer equivalent). Tests run serially (shared backend state).")
 *
 * retries: 0 — the spec's flake rule (live-API retry with >= 30s waits)
 * is implemented explicitly inside the T-A tests; nothing else may be
 * silently retried.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 240_000, // T-A flake rule allows up to 3 retries x 30s waits
  retries: 0,
  workers: 1, // tests share localStorage/origin state; run serially
  reporter: [['list']],
  expect: { timeout: 15_000 }, // Next dev-server first-compile latency
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    // §10: the E2E web server runs with the test sign-in form enabled.
    // (T-A api tests are unaffected; production builds never set this.)
    env: { ...process.env, NEXT_PUBLIC_E2E_TEST_MODE: '1' },
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
