/**
 * SS-V: Cycle-2 cycle-scoped evidence (gated by LOOPZAI_CYCLE=2).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 2, revision 2:
 * "Cycle-scoped evidence" E1) and .loopzai/spec-amendments.md (empty),
 * implemented BEFORE reading execution-log.md or the implementation diff.
 *
 * Proves THIS cycle's diff stayed inside its scope boundary. The spec
 * forbids freezing these inventories as forever-closed sets, so every
 * test begins with
 *   test.skip(process.env.LOOPZAI_CYCLE !== '2', 'cycle-2 scoped evidence')
 * and the plain `npm test` run reports it SKIPPED, never failed.
 * BASE is cycle-scoped evidence only, never a durable test input.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';

const BASE = '2711221abc526eeb1074c67e4c989fa3214d0912'; // planning dispatch base

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
}
function gitLines(args: string[]): string[] {
  return git(args).split('\n').map((s) => s.trim()).filter(Boolean);
}

test.describe('SS-V (cycle 2): cycle-scoped evidence', () => {
  test('SS-V-E1: diff touches no convex/, app/api/, prior tests/, or package.json dependency', () => {
    test.skip(process.env.LOOPZAI_CYCLE !== '2', 'cycle-2 scoped evidence');

    const diffed = gitLines(['diff', '--name-only', BASE, '--', '.', ':!.loopzai']);
    const untracked = gitLines([
      'ls-files', '--others', '--exclude-standard', '--', '.', ':!.loopzai',
    ]);
    const changed = Array.from(new Set([...diffed, ...untracked]))
      .filter((p) => !/^tests\/sector-summary-/.test(p))
      .sort();

    console.log('E1 CHANGED = ' + JSON.stringify(changed));

    const violations = changed.filter(
      (p) => p.startsWith('convex/') || p.startsWith('app/api/') || p.startsWith('tests/')
    );
    expect(violations, 'E1: forbidden paths in the cycle-2 diff').toEqual([]);

    // "adds, removes or changes no package.json dependency"
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
    console.log(
      'E1 package-lock.json changed = ' + String(changed.includes('package-lock.json'))
    );
  });
});
