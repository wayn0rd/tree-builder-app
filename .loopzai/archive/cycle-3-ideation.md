<!-- ideation.md — Ideation phase output; durable input to the Specification phase. -->

# Cycle 3 — Sector Watchlist ideation (DIRECTION CHOSEN — NOT YET FROZEN)

**Status:** direction selected by Wayne (2026-09-21), decisions recorded below.
The artifact is NOT yet frozen: the Loop proceeds only through the normal
`ideation_approval` gate (`FREEZE_IDEATION` from the Web App).

## CHOSEN DIRECTION — Candidate F: CSV export / import of the watchlist

The watchlist becomes portable: **Export** downloads the owner's stocks as a
CSV, and **Import** reads a CSV back in — with validation, deduplication, a
preview-before-apply step, and optional company-name lookup. Both actions live
in the **Manage Stocks** modal (the existing "one place to maintain entries");
the header is deliberately left alone.

Scope for this cycle is **merge-skip only**. Replace (wipe-and-restore) is
explicitly deferred (see rejected directions).

### Export (the easy half)

- Downloads `sector-watchlist.csv` entirely **client-side** (a `Blob` +
  object URL) from the stocks already loaded on the page — no new request, no
  server round-trip, no route change.
- Columns: `ticker,name,tags` — exactly the three the import reads back, so
  export → import round-trips losslessly.
- Rows sorted by ticker (same comparison the Manage Stocks modal uses) so the
  file is stable and diff-friendly.

### Import (the real half)

Reads a CSV of `ticker,name,tags` rows and adds them to the owner's watchlist.

**Tags codec — comma inside a quoted CSV field (LOCKED).**

`validateStock` **forbids commas inside a tag** (a validation *error*, never a
split), so a comma is a character guaranteed absent from every valid tag. That
invariant makes the standard RFC-4180 encoding lossless:

```
ticker,name,tags
AAPL,Apple Inc.,"Tech,AI Infra"
```

The `tags` field is one quoted field containing comma-separated tags. Parse the
field → split on `,` → trim each. This also handles a **company name containing
a comma** (`"Foo, Inc."`) through the same quoting rule.

> **LOAD-BEARING INVARIANT (must be stated in the spec):** the tag schema
> forbids commas. If a future cycle ever permits a comma in a tag, this codec
> silently breaks. Specification must record this dependency, and Verification
> should assert the invariant holds.

**Merge semantics — skip-if-exists, preview-then-apply, partial (LOCKED).**

- **Duplicate = same uppercased ticker** as an existing stock (or an earlier
  accepted row in the same file). Duplicates are **skipped**, not an error.
  Rationale: makes export → import **idempotent** — re-importing the same file
  is a no-op, which is exactly what a backup/restore loop needs.
- **Per-row outcome:** `added` / `skipped (already present)` /
  `rejected (reason)`. One bad row never fails the whole import.
- **Preview before commit:** show "will add N, skip M, reject K (reasons…)"
  and require confirmation. Cheaper and safer than an Undo.
- **Partial apply:** valid rows are written; rejected rows are reported with
  their validation reason and nothing else about them changes.

**Writes go through the existing `stocks.add` mutation** — which re-validates
server-side (F4) and enforces whitelist/ownership (`requireWhitelisted`). No
new Convex function, no schema change, no new dependency. Server validation is
authoritative; the client-side `validateStock` mirror is used for the preview.

### Company-name lookup for blank names (LOCKED — Wayne, 2026-09-21)

A row may supply only `ticker` + `tags`, leaving `name` blank.

- **Blank name → look it up** via the existing `fetchCompanyName` helper
  (`lib/quotes.ts`) over the existing `/api/stock` route (longName →
  shortName → null; dot-class retry `BRK.B` → `BRK-B`). **No new route, no new
  data source.**
- **Non-blank name → used verbatim, never overwritten** (mirrors cycle-1's
  `fromAutofill` provenance rule: a typed name is human-authored).
- **Lookup miss (`null`) → fall back to the ticker as the name.** F4 requires a
  non-empty name, so a miss must never be a row-killer; the fallback keeps the
  row importable and the preview **reports** it ("name = ticker; lookup found
  nothing").
- **Bounded concurrency** for lookups (not an unbounded `Promise.all`); resolve
  once per distinct ticker and reuse within the file.
- **Lookups run at preview time**, so resolved names are visible before apply.
- Only *blank* names trigger a lookup.

### Parser (small but real)

A hand-rolled, dependency-free **RFC-4180** parser in `lib/`, unit-testable as
a pure function: strip a UTF-8 BOM (Excel writes one), handle CRLF, quoted
fields with escaped `""`, skip blank lines, match header names
case-insensitively, ignore unknown columns.

## Constraints surfaced

- **No schema change, no new Convex function, no new dependency, no auth
  change, no new data source.** Import reuses `stocks.add`; lookup reuses
  `/api/stock`.
- **Carry cycle 2's lesson — "freeze the promise, not the snapshot."** The spec
  must separate DURABLE CONTRACTS (round-trip fidelity, no new persistence
  dependency, prior frozen tests stay green) from CYCLE-SCOPED EVIDENCE (the
  current route set / test-file inventory / this cycle's diff not touching
  `convex/schema`, `app/api/`, or dependencies). Verification may use exactness
  to prove *this* cycle's scope, but must not freeze current inventories as
  forever-closed sets.
- **This cycle is also the live acceptance test of the Planning/Start Execution
  guard repair.** During Implementation Planning the console should report the
  planning sub-dispatch as the active worker and disable Start Execution; if
  pressed anyway it must refuse rather than silently evaporate. Seeing that is
  the repair working, **not** a bug to report.
- Standard floor: no committed secrets, no `/api/stock` behaviour change, no
  change to the share flow, the tag filter, `?tags=` sync, or row rendering.

### Likely surface

- **New:** `lib/watchlistCsv.ts` — pure `serializeWatchlist(stocks)` +
  `parseWatchlistCsv(text)` (no React, no Next, no fetch). `lib/` may also host
  the import-planning helper (validate + dedupe + resolve) so it is unit-tested
  rather than buried in a component.
- **Changed:** `components/ManageStocksModal.tsx` (Export + Import controls,
  file picker, preview panel, per-row report). Possibly a small new
  `components/ImportPreview.tsx`. `README.md` (one sentence).
- **Untouched:** `convex/*`, `app/api/stock/route.ts`, `app/page.tsx`'s header
  button row, `SectorCard`, `WatchlistBoard`, the existing test files.

### Proposed milestones (for Specification to confirm/refine)

- **M1** — Pure `lib/watchlistCsv.ts`: `serializeWatchlist` +
  `parseWatchlistCsv` (RFC-4180 subset: BOM, CRLF, quoted fields, escaped
  quotes, case-insensitive header, unknown columns ignored).
- **M2** — Export action inside Manage Stocks: client-side `Blob` download of
  `sector-watchlist.csv`, ticker-sorted, `ticker,name,tags`.
- **M3** — Import inside Manage Stocks: file picker → parse → validate →
  skip-if-exists dedupe → blank-name lookup (bounded) → **preview** with
  per-row outcomes → confirm → apply via `stocks.add` → per-row report.
- **M4** — Existing Playwright suite green, `tsc` and `build` exit 0, README
  sentence.

### Open-for-Specification (small, mechanical)

- Exact preview text/format and the confirm/cancel affordance.
- Whether the import control is a button + hidden file input or a drop zone
  (proposal: button + file input — simplest, testable).
- Exact CSV download filename and whether to include a trailing newline.
- Concurrency cap for name lookups (proposal: small pool, e.g. 4).
- Exact per-row report wording for the three outcomes.

---

## Directions rejected, and why

- **Semaphore/pipe/JSON tags encoding.** A `;` or `|` delimiter is not
  guaranteed absent from a tag (a tag could legally contain either), so it is
  not faithful; a JSON array inside a cell is lossless but ugly in Excel. The
  comma-in-quoted-field scheme is the only option that is both faithful and
  hand-editable in a spreadsheet.
- **Import errors on a duplicate ticker (instead of skipping).** Makes restore
  painful and re-import a failure; skip-if-exists is idempotent, which is what
  a backup loop needs.
- **All-or-nothing import.** One malformed row would block an otherwise-good
  file; partial apply + per-row report is strictly more useful.
- **Import that calls `/api/stock` to autofill *every* name.** Wasteful and
  adds needless network I/O when the file already carries names; lookup is
  limited to *blank* names only.
- **Rejecting a row whose name lookup misses.** Would block valid tickers that
  Yahoo returns no long name for; ticker-as-name fallback keeps the row and
  reports the fact.
- **Replace / wipe-and-restore semantics.** A different product with a much
  heavier confirm story; merge-skip already restores correctly into an empty
  account. Deferred to a future cycle.
- **Export/Import buttons in the page header.** The header is already busy
  (Refresh, + Add stock, Manage Stocks, Share, Sign out). Manage Stocks is the
  natural home — it is already "the one place to maintain entries."
- **A third-party CSV library.** A ~60-line RFC-4180 subset parser is enough,
  keeps the dependency list unchanged, and stays unit-testable as a pure
  function.
- **Schema change / server-side bulk-import mutation.** Unnecessary: looping
  `stocks.add` reuses authoritative F4 validation and whitelist gating, and
  keeps the blast radius at the UI layer.

## Where the product is today (post–Cycle 2), for the record

Sector Watchlist is an invite-only, tag-grouped stock watchlist: whitelist-gated
Google sign-in, per-user private stocks in Convex, live Yahoo quotes via
`/api/stock` (manual refresh), sector cards with colored headers, cycle-2
header summaries (mean + up/down counts), a tag filter that round-trips through
`?tags=`, read-only tokenized share links, Add/Edit/Delete, a Manage Stocks
modal, and a small admin page. The read surface is mature; Cycle 1 shipped
ticker-blur company autofill, Cycle 2 shipped the header summary. The remaining
gaps are about **portability and maintenance** — which is where CSV
export/import lands.

*(This document is the ideation artifact. It is frozen only by `FREEZE_IDEATION`
from the Web App, then approved/redirected at the gate — neither of which Trixie
performs on Wayne's behalf.)*