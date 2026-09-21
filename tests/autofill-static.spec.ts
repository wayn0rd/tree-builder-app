/**
 * Cycle 1 (refreshed harness) — Static rows 6 and 23 of .loopzai/spec.md
 * "Success criteria".
 *
 * FROZEN — derived solely from .loopzai/spec.md + .loopzai/spec-amendments.md,
 * implemented BEFORE reading execution-log.md or the implementation diff.
 * Committed to git at Verification attempt 1; later attempts run this file
 * unchanged.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('AF-STATIC: source and documentation checks', () => {
  test('AF-STATIC-6 (criterion 6): app/api/stock/route.ts has no fs import/usage and no process.env read', async () => {
    const routePath = path.join(process.cwd(), 'app', 'api', 'stock', 'route.ts');
    const src = fs.readFileSync(routePath, 'utf8');
    expect(src).not.toMatch(
      /(from\s+['"](node:)?fs['"]|require\(\s*['"](node:)?fs['"]\s*\)|\bfs\.)/
    );
    expect(src).not.toMatch(/process\.env/);
  });

  test('AF-STATIC-23 (criterion 23): README.md describes the autofill and still contains "Manage Stocks"', async () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');
    expect(readme).toContain('Manage Stocks');
    expect(readme).toContain('Company name');
    expect(readme).toMatch(/auto-?fills?|autofill/i);
  });
});
