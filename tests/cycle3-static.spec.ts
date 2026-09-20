/**
 * T-S: Cycle-3 durable static check.
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 3, revision 2:
 * §4 P1, §9.3 T-S1) and .loopzai/spec-amendments.md (empty), implemented
 * before reading execution-log.md or the implementation diff.
 *
 * The single check here is a documentation promise (README mentions the
 * feature by name), not a snapshot — spec §9.0.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('T-S (cycle 3): static', () => {
  test('T-S1 (P1): README.md contains the literal "Manage Stocks"', async () => {
    const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');
    expect(readme, 'README.md must mention the Manage Stocks button').toContain(
      'Manage Stocks'
    );
  });
});
