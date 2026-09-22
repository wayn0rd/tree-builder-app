// Pure, dependency-free sector aggregate — Cycle 2 spec D9. No React, no
// Next, no fetch, no env: importable from anywhere (including a test
// runner) so the owner board and the shared page cannot diverge.

export interface SectorSummary {
  /** Equal-weight arithmetic mean of the available values, unrounded (D3);
   *  `null` when no value is available (D5) — never `NaN`. */
  mean: number | null;
  /** `changePercent > 0` (D6). */
  up: number;
  /** `changePercent < 0` (D6). */
  down: number;
  /** `changePercent === 0` exactly — no tolerance band (D6). */
  flat: number;
  /** `null` / no quote: excluded from the mean, never coerced to `0` (D2). */
  unavailable: number;
}

export function summarizeSector(
  values: ReadonlyArray<number | null>
): SectorSummary {
  let sum = 0;
  let available = 0;
  let up = 0;
  let down = 0;
  let flat = 0;
  let unavailable = 0;

  for (const value of values) {
    if (value == null) {
      unavailable++;
      continue;
    }
    sum += value;
    available++;
    if (value > 0) up++;
    else if (value < 0) down++;
    else flat++;
  }

  return {
    mean: available > 0 ? sum / available : null,
    up,
    down,
    flat,
    unavailable,
  };
}
