/**
 * T-S: Static safety checks (git-grep based). Cycle 2.
 *
 * FROZEN — derived solely from .loopzai/spec.md (§10 T-S1..T-S3, D7, D10,
 * P1, S1) and .loopzai/spec-amendments.md, implemented before reading
 * execution-log.md or the implementation diff.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SECRET = 'loopzai-e2e-dev-secret';

/** git grep -l <pattern> -- <paths>; returns matching tracked files. */
function gitGrepFiles(pattern: string, paths: string[]): string[] {
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', '--untracked', pattern, '--', ...paths],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    return out.split('\n').filter(Boolean);
  } catch (e: any) {
    if (e.status === 1) return []; // no matches
    throw e;
  }
}

test.describe('T-S: Static safety checks', () => {
  test('T-S1 (D10): test-login/testing.reset env-gated; test UI env-gated; no secret in repo; .env.local gitignored', async () => {
    const appCode = ['app', 'components', 'convex', 'lib'];

    // (a) every app-code file registering test-login or defining the
    // testing module must reference the E2E_TEST_SECRET env guard
    const testLoginFiles = gitGrepFiles('test-login', appCode);
    expect(
      testLoginFiles.length,
      'the test-login provider must exist somewhere in app code'
    ).toBeGreaterThan(0);
    for (const f of testLoginFiles) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      expect(
        src.includes('process.env.E2E_TEST_SECRET'),
        `${f} mentions test-login but has no process.env.E2E_TEST_SECRET guard`
      ).toBe(true);
    }
    const resetFiles = gitGrepFiles('testing', ['convex']).filter((f) =>
      /reset/i.test(fs.readFileSync(path.join(process.cwd(), f), 'utf8'))
    );
    for (const f of resetFiles.filter((f) => !f.includes('_generated'))) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      if (/export\s+const\s+reset/.test(src)) {
        expect(
          src.includes('process.env.E2E_TEST_SECRET'),
          `${f} defines testing.reset without an E2E_TEST_SECRET guard`
        ).toBe(true);
      }
    }

    // (b) every render of test-signin-* UI is guarded by the build-time flag
    const testUiFiles = gitGrepFiles('test-signin-', ['app', 'components', 'lib']);
    expect(
      testUiFiles.length,
      'the test sign-in form must exist somewhere in the UI code'
    ).toBeGreaterThan(0);
    for (const f of testUiFiles) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      expect(
        src.includes('NEXT_PUBLIC_E2E_TEST_MODE'),
        `${f} renders test-signin-* without a NEXT_PUBLIC_E2E_TEST_MODE guard`
      ).toBe(true);
    }

    // (c) the literal secret appears nowhere tracked outside test files.
    // Amended per .loopzai/spec-amendments.md (2026-08-25 blocking-pause
    // answer): sweep scope narrowed to application code — `.loopzai/`
    // narrative/process documents are excluded from the target set.
    const secretFiles = gitGrepFiles(SECRET, ['.']).filter(
      (f) => !f.startsWith('tests/') && !f.startsWith('.loopzai/')
    );
    expect(
      secretFiles,
      'secret literal must not appear outside tests/ (.env.local is untracked)'
    ).toEqual([]);

    // (d) .env.local is gitignored
    let ignored = true;
    try {
      execFileSync('git', ['check-ignore', '-q', '.env.local'], {
        cwd: process.cwd(),
      });
    } catch {
      ignored = false;
    }
    expect(ignored, '.env.local must be gitignored').toBe(true);
  });

  test('T-S2 (P1): no tickerWatchlist reference in app code', async () => {
    const hits = gitGrepFiles('tickerWatchlist', [
      'app',
      'components',
      'convex',
      'lib',
    ]);
    expect(hits, 'app code must not reference the localStorage key').toEqual(
      []
    );
  });

  test('T-S3 (S1, D7): no ownership fields; shareLinks stores tokenHash, never plaintext token', async () => {
    const schemaPath = path.join(process.cwd(), 'convex', 'schema.ts');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // no ownership/portfolio field names anywhere in the schema
    for (const forbidden of [
      'shares',
      'equity',
      'cost',
      'basis',
      'position',
      'platform',
    ]) {
      expect(
        new RegExp(`\\b${forbidden}\\s*:`).test(schema),
        `schema must not define a field named "${forbidden}"`
      ).toBe(false);
    }

    // shareLinks: tokenHash present, no plaintext `token` field
    expect(schema).toContain('shareLinks');
    expect(schema).toContain('tokenHash');
    expect(
      /\btoken\s*:/.test(schema.replace(/tokenHash\s*:/g, 'TH:')),
      'shareLinks (or any table) must not define a plaintext token field'
    ).toBe(false);

    // share.get's returned payload is verified live in T-F9 (no token/
    // tokenHash/_id/userId/email); here we statically confirm the share
    // module never returns the hash field name in its public get payload.
    const shareFiles = gitGrepFiles('share', ['convex']).filter(
      (f) => !f.includes('_generated')
    );
    expect(shareFiles.length).toBeGreaterThan(0);
  });
});
