<!-- ideation.md — Ideation phase output; durable input to the Specification phase. -->

# Cycle 2 — Sector Watchlist ideation (DIRECTION CHOSEN — NOT YET FROZEN)

**Status:** direction selected by Wayne (2026-09-21), decisions recorded below.
The artifact is NOT yet frozen: the Loop proceeds only through the normal
`ideation_approval` gate (`FREEZE_IDEATION` from the Web App).

## CHOSEN DIRECTION — Candidate A: sector-header summary stats

Each sector card's header gains a compact aggregate over that card's rows:

- the **mean of the rows' `changePercent`** — equal-weight, arithmetic mean;
- **counts** of rows by direction: up / down / flat / unavailable.

Recorded decisions (Wayne, 2026-09-21):

1. **Weighting: equal-weight, arithmetic mean.** Cap-weighting was raised and
   investigated — see "Explicitly out of scope" below — and **deferred**.
2. **Unavailable rows (`changePercent === null`) are EXCLUDED from the mean**
   and reported separately in the unavailable count. They are never treated
   as 0 and never contribute to the average's denominator.

Still for Specification to pin (small, mechanical):

- Exact header formatting (decimals, sign, spacing) and how the mean renders
  vs the existing `formatChange` conventions;
- Colour treatment of the mean (reuse `changeDirection`, or neutral);
- The zero-available-rows case (what the header shows when every row is
  unavailable) — must degrade to a clear "—", never `NaN`;
- The exact counting buckets; proposal: `up` = `> 0`, `down` = `< 0`,
  `flat` = exactly `0`, `unavailable` = `null`.

### Explicitly out of scope for Cycle 2

- **Market-capitalization weighting.** Our data source cannot supply it: the
  `v8/finance/chart` endpoint that `/api/stock` uses carries **no `marketCap`
  field** in `meta` (verified live against AAPL, ^GSPC, BRK-B, SPY, BTC-USD;
  all absent), and the endpoints that do (`v10 quoteSummary`, `v7 quote`) now
  return `401 / Invalid Crumb` without a signed-in session. Cap-weighting would
  therefore require a NEW authenticated data source — infrastructure, not a
  derivation — and is deferred to a future cycle as its own feature.
- Any schema change, migration, auth change, or new external dependency.
- Any change to the existing tag filter, `?tags=` behaviour, or share flow.

### Likely surface

- `components/SectorCard.tsx` (header render) plus one **pure helper** in
  `lib/` (e.g. a `summarizeSector(rows)` returning `{ mean, up, down, flat,
  unavailable }`), so the same computation is unit-testable and reusable by
  the shared page. Derived only from data already fetched — **no new network
  calls**, no route change.

### Why this fits the clean-cycle goal

Small, purely derived, visually obvious to verify, and it exercises the full
lifecycle (spec → plan → execution → verification) without touching schema,
infrastructure, or auth — exactly the risk profile Cycle 2 is meant to test.

---

## Original framing (kept for the record)

**Cycle 2's real purpose (stated up front):** complete ONE entire LoopzAI cycle
on this small external project *cleanly* — normal human gates allowed, **no
unexpected System Halts, no out-of-band harness repair**. So a good Cycle 2
candidate is judged on two axes at once: a genuinely useful product improvement,

**Cycle 2's real purpose (stated up front):** complete ONE entire LoopzAI cycle
on this small external project *cleanly* — normal human gates allowed, **no
unexpected System Halts, no out-of-band harness repair**. So a good Cycle 2
candidate is judged on two axes at once: a genuinely useful product improvement,
AND a shape that is unlikely to stress the harness (no infra, no auth redesign,
no migrations, no ambiguous external dependencies).

## Where the product is today (post–Cycle 1)

Sector Watchlist, as it actually exists now:

- Whitelist-gated sign-in (Convex Auth); signed-in owners see a board of
  **sector cards**, one card per **tag**, rows = stocks sorted by ticker.
- Each row shows price + signed % change, green/red/flat coloring, live Yahoo
  quotes via our own `/api/stock` route, **manual refresh only** (with a
  millisecond-precision "last refreshed" stamp).
- **Tag filter bar** whose selection round-trips through `?tags=` and works the
  same on the owner board and the read-only shared page.
- **Add / Edit / Delete** stocks; **Manage Stocks** modal; **Share panel**
  issuing read-only token links; a small **admin** page.
- **Cycle 1 (shipped, deployed):** Add-Stock form autofills the company name
  from `/api/stock` (longName → shortName → null), with provenance and a stale
  guard.

So: the *read* surface is mature and visually stable; the biggest remaining gaps
are around **how information is summarized, filtered, and persisted**, not
around adding new data sources.

## Candidate ideas (6)

Each is meant to be shippable on its own in one clean cycle.

### A. Sector-header summary stats *(rows → sector insight)*
- **User gets:** each card header shows a compact aggregate for that sector —
  e.g. average % change, and an up/down/unavailable count (e.g. `+0.8% · 3▲ 1▼`).
- **Why useful:** turns a pile of tickers into a glanceable read of which
  sectors are moving — the whole point of a *sector* watchlist.
- **Surface:** `components/SectorCard.tsx` (+ small pure helper in `lib/`, reused
  by the shared page). Pure derivation over existing quotes.
- **Complexity:** **small.**
- **Decision for Wayne:** what the aggregate should be (mean vs median? count
  only?) and whether unavailable rows are excluded or shown as a count.

### B. Watchlist search / quick-filter box
- **User gets:** a text box that instantly filters visible rows (and/or cards)
  by ticker or company name.
- **Why useful:** as the list grows, tag filters alone are coarse; finding one
  ticker should not require scanning every card.
- **Surface:** `components/WatchlistBoard.tsx` + `TagFilterBar` area; purely
  client-side.
- **Complexity:** **small.**
- **Decision for Wayne:** interacts with the existing tag filter how (AND? does
  search reset tags?), and whether it should persist.

### C. Remember the last tag filter (default view)
- **User gets:** reopening the dashboard lands on the sector(s) he was last
  looking at, instead of everything.
- **Why useful:** removes a repeated manual step for a daily-use tool.
- **Surface:** small — persist one value; read on mount.
- **Complexity:** **small.**
- **Decision for Wayne:** where the preference lives — localStorage (session,
  no schema change) vs a per-user field in Convex (survives across devices,
  adds an optional field). This is the one real fork.

### D. Sort controls (cards by movement, rows by price/change)
- **User gets:** a toggle to order sector cards by average change (biggest
  movers first) and rows by price or % change, in addition to ticker.
- **Why useful:** pairs naturally with A; a trader wants "what's moving." 
- **Surface:** `WatchlistBoard.tsx` / `SectorCard.tsx`; client-side only.
- **Complexity:** **small–medium** (interaction with the `?tags=` URL state and
  with A's aggregate).
- **Decision for Wayne:** when A and D are both wanted, which ships first.

### E. Position tracking (shares + cost basis → gain/loss)
- **User gets:** optional per-stock share count and cost basis, giving per-row
  and per-sector unrealized P/L alongside the day change.
- **Why useful:** this is the single most "real trader" upgrade available — it
  turns a watchlist into a light portfolio view.
- **Surface:** additive **optional** fields on the `stocks` Convex doc, form
  fields, and derived math. Bigger than the others.
- **Complexity:** **medium.**
- **Decision for Wayne:** scope (do we do P/L now or a later cycle?), and whether
  cost basis is per-share.
- **Caveat for the *proving run*:** touches schema + forms + maths — the largest
  blast radius here, so the most likely to brush the harness. Buildable, but
  least "clean-cycle-shaped."

### F. CSV export / import of the watchlist
- **User gets:** download the watchlist as CSV; optionally bulk-add from CSV.
- **Why useful:** backup, sharing outside the app, fast setup on a new account.
- **Surface:** client-side export (easy) + a new import path (form + validation
  + the same dedup rules as `validateStock`).
- **Complexity:** **medium.**
- **Decision for Wayne:** export-only vs import too, and import merge semantics
  (skip duplicates vs error).

## Strongest candidates for a *clean-cycle proving run*

(Historical — the selection is recorded at the top of this document.)

1. **A — Sector-header summary stats.** ← **CHOSEN.**
2. **B — Search / quick-filter.**
3. **C — Remember last filter.**

*(This document is the ideation artifact. It is frozen only by `FREEZE_IDEATION`
from the Web App, then approved/redirected at the gate — neither of which Trixie
performs on Wayne's behalf.)*
