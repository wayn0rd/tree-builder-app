/**
 * WC-V: Cycle-3 (CSV) cycle-scoped evidence (gated by
 * LOOPZAI_EVIDENCE=watchlist-csv — NEVER by LOOPZAI_CYCLE, which the spec
 * forbids re-arming because tests/cycle3-scoped.spec.ts shares the number).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 3 "CSV export /
 * import": Cycle-scoped evidence E1, Scope boundary) and
 * .loopzai/spec-amendments.md (empty), implemented BEFORE reading
 * execution-log.md or the implementation diff.
 *
 * Proves THIS cycle's diff stayed inside its scope boundary. The spec
 * forbids freezing these inventories as forever-closed sets, so the test
 * skips unless LOOPZAI_EVIDENCE === 'watchlist-csv'; the plain `npm test`
 * run reports it SKIPPED, never failed. BASE is evidence only.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';

const BASE = '8868bcedbb6534c6bbe4ae81d2f09e016cfbf2a1'; // spec approved (cycle 3 planning base)

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
}
function gitLines(args: string[]): string[] {
  return git(args).split('\n').map((s) => s.trim()).filter(Boolean);
}

test.describe('WC-V (cycle 3, csv): cycle-scoped evidence', () => {
  test('WC-V-E1: product diff confined to the six allowed files; no convex/, app/api/, app/shared/, app/admin/, prior tests/, or dependency change', () => {
    test.skip(process.env.LOOPZAI_EVIDENCE !== 'watchlist-csv', 'cycle-3 (csv) scoped evidence');

    const diffed = gitLines(['diff', '--name-only', BASE, '--', '.', ':!.loopzai']);
    const untracked = gitLines(['ls-files', '--others', '--exclude-standard', '--', '.', ':!.loopzai']);
    const changed = Array.from(new Set([...diffed, ...untracked]))
      .filter((p) => !/^tests\/watchlist-csv-/.test(p))
      .sort();

    console.log('E1 CHANGED = ' + JSON.stringify(changed));

    const allowed = new Set([
      'lib/watchlistCsv.ts',
      'lib/watchlistImport.ts',
      'components/ManageStocksModal.tsx',
      'components/ImportCsvPanel.tsx',
      'app/page.tsx',
      'README.md',
    ]);
    const outside = changed.filter((p) => !allowed.has(p));
    expect(outside, 'E1: files outside the allowed set').toEqual([]);

    const forbidden = changed.filter(
      (p) =>
        p.startsWith('convex/') ||
        p.startsWith('app/api/') ||
        p.startsWith('app/shared/') ||
        p.startsWith('app/admin/') ||
        p.startsWith('tests/')
    );
    expect(forbidden, 'E1: forbidden paths in the cycle-3 diff').toEqual([]);
    expect(changed.includes('package.json')).toBe(false);
    expect(changed.includes('package-lock.json')).toBe(false);

    // At most one new lib/ module beyond the codec, at most one new components/ file.
    const newLib = changed.filter((p) => p.startsWith('lib/') && p !== 'lib/watchlistCsv.ts');
    expect(newLib.length).toBeLessThanOrEqual(1);
    const newComponents = changed.filter(
      (p) => p.startsWith('components/') && p !== 'components/ManageStocksModal.tsx'
    );
    expect(newComponents.length).toBeLessThanOrEqual(1);

    const depsOf = (rev: string) => {
      const pkg = JSON.parse(git(['show', `${rev}:package.json`]));
      return {
        dependencies: pkg.dependencies ?? {},
        devDependencies: pkg.devDependencies ?? {},
        peerDependencies: pkg.peerDependencies ?? {},
        optionalDependencies: pkg.optionalDependencies ?? {},
      };
    };
    expect(depsOf('HEAD')).toEqual(depsOf(BASE));
  });
});
