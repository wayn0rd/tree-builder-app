// Watchlist client-side types + validation. Persistence lives in Convex
// (Cycle-2 spec D1/S1); the Cycle-1 localStorage layer was removed (P1).
// Server-side validation (F4, convex/lib/validate.ts) is authoritative;
// this mirror exists for immediate form UX.

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  tags: string[];
}

export const TICKER_RE = /^[A-Za-z0-9.^-]+$/;

export interface StockInput {
  ticker: string;
  name: string;
  /** Raw candidate tags (chips + any pending text), pre-validation. */
  tags: string[];
}

export type ValidationResult =
  | { ok: true; stock: Omit<Stock, 'id'> }
  | { ok: false; error: string };

/**
 * F4 mirror. `editingId` excludes the stock being edited from the
 * duplicate-ticker check.
 */
export function validateStock(
  input: StockInput,
  existing: Stock[],
  editingId: string | null
): ValidationResult {
  const ticker = input.ticker.trim().toUpperCase();
  if (ticker.length < 1 || ticker.length > 10 || !TICKER_RE.test(ticker)) {
    return {
      ok: false,
      error:
        'Ticker is required: 1–10 characters, letters/digits/. ^ - only.',
    };
  }
  const duplicate = existing.some(
    (s) => s.id !== editingId && s.ticker.toUpperCase() === ticker
  );
  if (duplicate) {
    return { ok: false, error: `${ticker} is already in the watchlist.` };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: 'Company name is required.' };
  }

  // Tags: trimmed, non-empty, comma-free, deduplicated case-insensitively.
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.tags) {
    const tag = raw.trim();
    if (!tag) continue;
    if (tag.includes(',')) {
      return { ok: false, error: 'Tags may not contain commas.' };
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length === 0) {
    return { ok: false, error: 'At least one tag is required.' };
  }

  return { ok: true, stock: { ticker, name, tags } };
}

/** Distinct tags across the watchlist, case-insensitively deduped (first
 *  spelling wins), sorted case-insensitively ascending. */
export function distinctTags(stocks: Stock[]): string[] {
  const seen = new Map<string, string>();
  for (const s of stocks) {
    for (const tag of s.tags) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0
  );
}
