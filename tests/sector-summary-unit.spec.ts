/**
 * SS-U: Cycle-2 durable helper tests (direct calls, no browser, no server).
 *
 * FROZEN — derived solely from .loopzai/spec.md (cycle 2, revision 2:
 * Decisions D1, D2, D3, D5, D6, D9; Success criterion 7) and
 * .loopzai/spec-amendments.md (empty), with the test plan in
 * .loopzai/implementation-plan.md as the non-authoritative row source,
 * implemented BEFORE reading execution-log.md or the implementation diff.
 *
 * The helper must be importable outside React (spec "Architectural
 * constraints") — a plain relative import from lib/ is therefore itself
 * part of the contract: if this import fails, the row fails.
 */
import { test, expect } from '@playwright/test';
import { summarizeSector } from '../lib/sectorSummary';

test.describe('SS-U (cycle 2): summarizeSector helper', () => {
  test('SS-U-7a: [100, -10] → mean 45, up 1, down 1, flat 0, unavailable 0', () => {
    expect(summarizeSector([100, -10])).toEqual({
      mean: 45,
      up: 1,
      down: 1,
      flat: 0,
      unavailable: 0,
    });
  });

  test('SS-U-7b: [0, null] → mean 0, flat 1, unavailable 1 (null excluded, never 0)', () => {
    expect(summarizeSector([0, null])).toEqual({
      mean: 0,
      up: 0,
      down: 0,
      flat: 1,
      unavailable: 1,
    });
  });

  test('SS-U-7c: [null, null] → mean null (never NaN), unavailable 2', () => {
    const r = summarizeSector([null, null]);
    expect(r.mean).toBeNull();
    expect(Number.isNaN(r.mean as unknown as number)).toBe(false);
    expect(r.unavailable).toBe(2);
    expect(r.up).toBe(0);
    expect(r.down).toBe(0);
    expect(r.flat).toBe(0);
  });

  test('SS-U-7d: [] → mean null, every count 0', () => {
    expect(summarizeSector([])).toEqual({
      mean: null,
      up: 0,
      down: 0,
      flat: 0,
      unavailable: 0,
    });
  });

  test('SS-U-7e: [1, 2, 4] → mean within 1e-9 of 7/3, up 3', () => {
    const r = summarizeSector([1, 2, 4]);
    expect(r.mean).not.toBeNull();
    expect(Math.abs((r.mean as number) - 7 / 3)).toBeLessThan(1e-9);
    expect(r.up).toBe(3);
    expect(r.down).toBe(0);
    expect(r.flat).toBe(0);
    expect(r.unavailable).toBe(0);
  });

  test('SS-U-7f: [0.001, 0.001] → mean 0.001 exactly (unrounded, D3), up 2', () => {
    const r = summarizeSector([0.001, 0.001]);
    expect(r.mean).toBe(0.001);
    expect(r.up).toBe(2);
    expect(r.down).toBe(0);
    expect(r.flat).toBe(0);
    expect(r.unavailable).toBe(0);
  });

  test('SS-U-D6: bucket boundaries are exact — no tolerance band around zero', () => {
    // D6: |x| < 0.005 is still up / down, never flat.
    expect(summarizeSector([0.004])).toMatchObject({ up: 1, flat: 0 });
    expect(summarizeSector([-0.001])).toMatchObject({ down: 1, flat: 0 });
    expect(summarizeSector([0])).toMatchObject({ flat: 1, up: 0, down: 0 });
  });
});
