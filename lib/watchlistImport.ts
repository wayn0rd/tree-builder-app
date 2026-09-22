// Watchlist CSV import planner — Cycle-3 spec .loopzai/spec.md D7 (skip-if-
// exists, first eligible occurrence wins), D8 (check order per row), D9
// (bounded blank-name lookup, ticker fallback), D16 (fixed strings).
//
// Pure and importable outside React: no 'use client', no React / Next /
// Convex import, no fetch. The lookup is a plain function the caller hands
// in, so the planner itself never touches the network (criterion 24).

import { validateStock } from './watchlist';
import type { CsvStock } from './watchlistCsv';

export type ImportOutcome = 'added' | 'skipped' | 'rejected' | 'failed';

export interface ImportRow {
  /** 1-based data-row number, file order. */
  row: number;
  /** Trimmed, upper-cased ticker (display and `data-ticker`). */
  ticker: string;
  /** Decided at preview; only `added` → `failed` may change at apply. */
  outcome: ImportOutcome;
  /** Skip reason / validator message / server message; null for added. */
  reason: string | null;
  /** The name that will be stored (added rows); null while a lookup is
   *  pending and for every other outcome. */
  name: string | null;
  /** Normalised tags for added rows (trimmed, case-insensitively deduped);
   *  [] otherwise. */
  tags: string[];
  /** An added row whose name is blank and whose lookup has not resolved. */
  lookupPending: boolean;
  /** NOTE_LOOKUP_MISS after a miss, else null. */
  note: string | null;
}

export interface ImportCounts {
  added: number;
  skipped: number;
  rejected: number;
  failed: number;
}

export const LOOKUP_CONCURRENCY = 4;
export const REASON_IN_WATCHLIST = 'already in the watchlist';
export const NOTE_LOOKUP_MISS = 'name = ticker (lookup found nothing)';

export function duplicateOfRow(n: number): string {
  return `duplicate of row ${n}`;
}

/** Placeholders that satisfy the name / tag rules so a single
 *  `validateStock` call exercises exactly one rule (ticker or tags). */
const PLACEHOLDER = '-';

/** D7 / D8: one synchronous pass in file order. A ticker is claimed only by
 *  the first row that ends up `added`; skipped and rejected rows claim
 *  nothing. Outcomes are fixed here and never re-planned. */
export function planImport(
  rows: ReadonlyArray<CsvStock>,
  existing: ReadonlyArray<{ ticker: string }>
): ImportRow[] {
  const existingSet = new Set<string>();
  for (let i = 0; i < existing.length; i++) {
    existingSet.add(existing[i].ticker.toUpperCase());
  }
  const claimed = new Map<string, number>();
  const plan: ImportRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const src = rows[i];
    const n = i + 1;
    const base: ImportRow = {
      row: n,
      ticker: src.ticker.trim().toUpperCase(),
      outcome: 'added',
      reason: null,
      name: null,
      tags: [],
      lookupPending: false,
      note: null,
    };

    // 1. Ticker validity — the Add form's own rule and message.
    const tickerCheck = validateStock(
      { ticker: src.ticker, name: PLACEHOLDER, tags: [PLACEHOLDER] },
      [],
      null
    );
    if (!tickerCheck.ok) {
      plan.push({ ...base, outcome: 'rejected', reason: tickerCheck.error });
      continue;
    }
    const ticker = tickerCheck.stock.ticker;

    // 2. Already in the watchlist.
    if (existingSet.has(ticker)) {
      plan.push({ ...base, ticker, outcome: 'skipped', reason: REASON_IN_WATCHLIST });
      continue;
    }

    // 3. Claimed by an earlier row headed for `added`.
    const claimant = claimed.get(ticker);
    if (claimant !== undefined) {
      plan.push({ ...base, ticker, outcome: 'skipped', reason: duplicateOfRow(claimant) });
      continue;
    }

    // 4. Tags — the same trimming, comma rule and dedupe the form applies.
    const tagCheck = validateStock(
      { ticker, name: PLACEHOLDER, tags: src.tags },
      [],
      null
    );
    if (!tagCheck.ok) {
      plan.push({ ...base, ticker, outcome: 'rejected', reason: tagCheck.error });
      continue;
    }

    // 5. Added: claim the ticker; a blank name is looked up, never rejected.
    claimed.set(ticker, n);
    const name = src.name.trim();
    plan.push({
      ...base,
      ticker,
      outcome: 'added',
      tags: tagCheck.stock.tags,
      name: name === '' ? null : name,
      lookupPending: name === '',
    });
  }
  return plan;
}

/** D9: look up the blank names of rows headed for `added`, once per
 *  distinct ticker, at most LOOKUP_CONCURRENCY in flight. A miss (null,
 *  blank, or a throw) stores the ticker as the name with NOTE_LOOKUP_MISS.
 *  Returns a new array; the input plan is never mutated. `onResolved` is
 *  called after each ticker settles with the number still pending. */
export async function resolveNames(
  plan: ReadonlyArray<ImportRow>,
  lookup: (ticker: string) => Promise<string | null>,
  onResolved?: (remaining: number) => void
): Promise<ImportRow[]> {
  const out: ImportRow[] = plan.map((r) => ({ ...r, tags: r.tags.slice() }));
  const queue: string[] = [];
  const queued = new Set<string>();
  for (let i = 0; i < out.length; i++) {
    const r = out[i];
    if (r.lookupPending && !queued.has(r.ticker)) {
      queued.add(r.ticker);
      queue.push(r.ticker);
    }
  }
  if (queue.length === 0) return out;

  let next = 0;
  let remaining = queue.length;

  async function worker(): Promise<void> {
    while (next < queue.length) {
      const ticker = queue[next];
      next += 1;
      let found: string | null = null;
      try {
        found = await lookup(ticker);
      } catch {
        found = null;
      }
      const hit = typeof found === 'string' && found.trim() !== '';
      for (let i = 0; i < out.length; i++) {
        const r = out[i];
        if (r.lookupPending && r.ticker === ticker) {
          r.name = hit ? (found as string).trim() : ticker;
          r.note = hit ? null : NOTE_LOOKUP_MISS;
          r.lookupPending = false;
        }
      }
      remaining -= 1;
      if (onResolved) onResolved(remaining);
    }
  }

  const workers: Promise<void>[] = [];
  const count = Math.min(LOOKUP_CONCURRENCY, queue.length);
  for (let i = 0; i < count; i++) workers.push(worker());
  await Promise.all(workers);
  return out;
}

export function countOutcomes(plan: ReadonlyArray<ImportRow>): ImportCounts {
  const c: ImportCounts = { added: 0, skipped: 0, rejected: 0, failed: 0 };
  for (let i = 0; i < plan.length; i++) c[plan[i].outcome] += 1;
  return c;
}

// D16 strings (U+00B7 MIDDLE DOT, U+2026 HORIZONTAL ELLIPSIS).

export function previewSummary(c: ImportCounts): string {
  return `Add ${c.added} · Skip ${c.skipped} · Reject ${c.rejected}`;
}

export function reportSummary(c: ImportCounts): string {
  const base = `Added ${c.added} · Skipped ${c.skipped} · Rejected ${c.rejected}`;
  return c.failed > 0 ? `${base} · Failed ${c.failed}` : base;
}

export function confirmLabel(n: number): string {
  return n === 1 ? 'Import 1 stock' : `Import ${n} stocks`;
}

export function lookingUpLabel(n: number): string {
  return n === 1 ? 'Looking up 1 name…' : `Looking up ${n} names…`;
}

export function importingLabel(index: number, total: number): string {
  return `Importing ${index} of ${total}…`;
}
