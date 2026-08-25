// Server-side stock validation — spec F4 (mirror of Cycle-1 S2, enforced in
// mutations regardless of client behavior). Violations throw without
// mutating.

import type { Doc, Id } from '../_generated/dataModel';

export const TICKER_RE = /^[A-Za-z0-9.^-]+$/;

export interface ValidatedStock {
  ticker: string;
  name: string;
  tags: string[];
}

/**
 * F4: ticker required, 1–10 chars matching TICKER_RE, unique per-user
 * case-insensitively (`editingId` excludes the stock being edited); name
 * required non-empty after trim; ≥ 1 tag, each trimmed non-empty,
 * comma-free, deduplicated case-insensitively.
 */
export function validateStockInput(
  input: { ticker: string; name: string; tags: string[] },
  existing: Doc<'stocks'>[],
  editingId: Id<'stocks'> | null
): ValidatedStock {
  const ticker = input.ticker.trim().toUpperCase();
  if (ticker.length < 1 || ticker.length > 10 || !TICKER_RE.test(ticker)) {
    throw new Error(
      'Ticker is required: 1–10 characters, letters/digits/. ^ - only.'
    );
  }
  const duplicate = existing.some(
    (s) => s._id !== editingId && s.ticker.toUpperCase() === ticker
  );
  if (duplicate) {
    throw new Error(`${ticker} is already in the watchlist.`);
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error('Company name is required.');
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.tags) {
    const tag = raw.trim();
    if (!tag) continue;
    if (tag.includes(',')) {
      throw new Error('Tags may not contain commas.');
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length === 0) {
    throw new Error('At least one tag is required.');
  }

  return { ticker, name, tags };
}
