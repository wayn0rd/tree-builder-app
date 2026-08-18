import { defineConfig } from '@playwright/test';

/**
 * LoopzAI cycle 1 — frozen verification test config.
 * Derived from .loopzai/spec.md §10 ("Setup for all tests: npm install,
 * then npm run dev (default port 3000) — or Playwright's webServer
 * equivalent").
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
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
