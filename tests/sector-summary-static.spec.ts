/**
 * SS-S: Cycle-2 durable static checks.
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 2, revision 2:
 * D9, Architectural constraints "importable outside React" / "purely
 * derived, nothing persisted"; Success criteria 13 (static leg) and 14)
 * and .loopzai/spec-amendments.md (empty), with the test plan in
 * .loopzai/implementation-plan.md as the non-authoritative row source,
 * implemented BEFORE reading execution-log.md or the implementation diff.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

test.describe('SS-S (cycle 2): static', () => {
  test('SS-S-13a (D9, 13): lib/sectorSummary.ts is pure and dependency-free', () => {
    const src = read('lib/sectorSummary.ts');
    expect(src, 'helper must not import anything').not.toMatch(/^\s*import\s/m);
    expect(src, 'helper must not require anything').not.toMatch(/require\(/);
    expect(src, 'helper must not fetch').not.toMatch(/\bfetch\(/);
    expect(src, 'helper must not read process.env').not.toMatch(/process\.env/);
    expect(src, 'helper must not be a client component').not.toMatch(/use client/);
    expect(src, 'helper must export summarizeSector').toMatch(
      /export\s+function\s+summarizeSector\b/
    );
  });

  test('SS-S-13b (13): SectorCard derives the summary from props — no request, no Convex', () => {
    const src = read('components/SectorCard.tsx');
    expect(src, 'card must not fetch').not.toMatch(/\bfetch\(/);
    expect(src, 'card must not import convex').not.toMatch(/from\s+['"]convex/);
    expect(src, 'card must not import ../convex').not.toMatch(/from\s+['"]\.\.\/convex/);
    expect(src, 'card must not use Convex hooks').not.toMatch(/useQuery|useMutation/);
    expect(src, 'card calls the shared helper (D9)').toMatch(/summarizeSector/);
  });

  test('SS-S-14 (14): README describes the header summary and still says "Manage Stocks"', () => {
    const readme = read('README.md');
    expect(readme).toContain('Manage Stocks');
    expect(readme).toMatch(/summary/i);
    expect(readme).toMatch(/\bmean\b/i);
  });
});
