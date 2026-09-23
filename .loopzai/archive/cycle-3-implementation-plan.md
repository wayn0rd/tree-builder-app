<!-- implementation-plan.md — derived from spec.md sha256 82266cc8500dc6dec90f0ed53ad35d1ae7c08642eddf8cf8e2a9b126146fced0 (cycle 3, revision 2) -->

# Implementation plan — Cycle 3: Sector Watchlist, CSV export / import of the watchlist

This plan is guidance derived from the approved specification. Where any line
here disagrees with `.loopzai/spec.md` or `.loopzai/spec-amendments.md`, the
specification wins. The plan creates no frozen-test authority, adds no scope,
removes no commitment and changes no success criterion. Numbered criteria
below (1–25, E1, E2) are the specification's own numbering under "Success
criteria"; D1–D17 and M1–M5 are the specification's decisions and milestones.
Where this plan fixes a detail the specification leaves open (a function
signature, a file name, a test-file layout, an unpinned parser edge), it is
marked **plan choice**: Execution may deviate when it has a reason, but must
then tell Verification through the execution log, because Verification
implements its frozen rows from the signatures written here.

## Provenance

- **Specification:** `.loopzai/spec.md`, sha256
  `82266cc8500dc6dec90f0ed53ad35d1ae7c08642eddf8cf8e2a9b126146fced0`,
  cycle 3, revision 2, approved 2026-09-22T07:01:24.406Z
  (`state.json.specificationApproval`; freeze commit `d22be65`; revision
  record `.loopzai/spec-revisions/cycle-3-rev-2.md`, superseding revision 1
  `e31ba52b…6c589e` after the review's three bounded corrections: in-file
  "first eligible occurrence wins" (D7/D8, criterion 15), stale-lookup run
  identity (D17, criteria 17–18), CR/LF inside quoted fields (D5,
  criterion 5) and the no-default-tag clarification (D6, criterion 16)).
- **Amendments read:** `.loopzai/spec-amendments.md` — header line only; no
  amendment exists for this cycle. `.loopzai/test-amendments.jsonl` is
  empty. `.loopzai/amendments.jsonl` carries one prior-cycle record
  (`assumption-0001`, cycle 1, approved: new frozen rows are authored by
  Verification, not Execution) — a harness convention this plan follows,
  not a product delta.
- **Planning dispatch:** `8d8a89d0-b68d-4418-b3d1-bded366a8faa`, base commit
  `8868bcedbb6534c6bbe4ae81d2f09e016cfbf2a1` on `main`; working tree clean
  apart from the untracked coordinator files named in the dispatch's
  `treeSnapshot` (`.loopzai/archive/cycle-2-summary.md`,
  `.loopzai/notifications.jsonl`, `.loopzai/publish-log.jsonl`,
  `.loopzai/spec-revisions/cycle-2-rev-1.md`,
  `.loopzai/spec-revisions/cycle-3-rev-1.md`). No product file has changed
  since Cycle 2's verified tree (`62fae66`).
- **Repository read:** `components/ManageStocksModal.tsx` (the surface this
  cycle extends), `components/StockForm.tsx` (autofill / stale-response and
  server-error precedents), `components/WatchlistBoard.tsx`,
  `components/SectorCard.tsx`, `app/page.tsx` (mutations, `useQuotes`,
  Escape handling, modal mounting), `lib/watchlist.ts` (`validateStock`,
  `TICKER_RE`, `Stock`), `lib/quotes.ts` (`fetchCompanyName`, dot-class
  retry), `lib/useQuotes.ts` (`fetchOne`), `lib/sectorSummary.ts`,
  `app/api/stock/route.ts`, `convex/stocks.ts`, `convex/lib/validate.ts`,
  `convex/testing.ts`, `convex/schema.ts`, every file under `tests/`
  (16 files, with their freezing commits — listed under "Frozen-file
  audit"), `playwright.config.ts`, `package.json`, `tsconfig.json`,
  `next.config.js`, `.gitignore`, `README.md`,
  `.loopzai/verification-gates.json`, `.loopzai/milestones.json`, the
  archived Cycle 2 plan, verification report and manifest, and the Convex
  client's error formatting (`node_modules/convex/dist/esm/browser/logging.js`).
- **Environment facts that shape the mechanics below:**
  - `NODE_ENV=production` is set in the worker shell (checked). Every prior
    gate run used `env -u NODE_ENV` for `npm run build` and `npm test`;
    this plan does the same. `LOOPZAI_CYCLE` is unset. Nothing listens on
    `:3000`. `.env.local` points at the dev deployment
    `combative-minnow-928` (not `frugal-anaconda-225`).
  - Versions: Node `v24.20.0`, `@playwright/test 1.62.1`, `next 14.2.35`,
    `convex 1.45.0`, `react 18`. `next.config.js` sets
    `reactStrictMode: true`, so in the dev server every effect mounts twice
    — the import run must be started from the file input's **event
    handler**, never from a `useEffect`, or criterion 8's exact request
    count doubles (see M4).
  - `tsconfig.json` has `target: es5` without `downlevelIteration`: the new
    `lib/` code must not `for…of` a `Map` / `Set` (use `Array.from`, as
    `lib/watchlist.ts` already does) and should index strings by position
    rather than iterate them; `tsconfig` includes `**/*.ts`, so the new
    test files are type-checked by `npx tsc --noEmit` and by `next build`.
  - A Playwright spec **can** import a plain `lib/*.ts` module directly
    (Cycle 2's `tests/sector-summary-unit.spec.ts` does it against this
    `node_modules`), so criteria 2–6, 15 (planner leg), 16 (parser leg)
    and 21 (validator leg) are direct calls with no browser.
  - Convex surfaces a mutation's thrown `Error` to the browser client as
    `[CONVEX M(stocks:add)] [Request ID: …] Server Error\nUncaught Error:
    <server message>\n    at handler (../convex/stocks.ts:…)\n\n  Called by
    client` (`createHybridErrorStacktrace`). Criterion 12 expects the row to
    read `NVDA is already in the watchlist.`, so `app/page.tsx` extracts
    the server's own line (M4) and Verification asserts with
    `toContainText`.
  - The specification's fixed strings use MIDDLE DOT `U+00B7` (` · `) in
    the summaries, HORIZONTAL ELLIPSIS `U+2026` (`…`) in `Looking up N
    names…` / `Importing i of N…`, and the validator's ticker message
    carries an EN DASH `U+2013` (`1–10`). Execution renders exactly these
    code points; Verification's expected strings must be typed with them.
  - The existing suite is 95 rows: `92 passed / 3 skipped` (Cycle 2 close;
    `test-results/.last-run.json` = passed). The 3 skips are
    `tests/cycle3-scoped.spec.ts` V1–V2 (gated on `LOOPZAI_CYCLE=3`) and
    `tests/sector-summary-scoped.spec.ts` SS-V-E1 (gated on
    `LOOPZAI_CYCLE=2`). This cycle is also numbered 3, so **no run may set
    `LOOPZAI_CYCLE=3`** (its fence forbids `lib/`); this cycle's own scoped
    evidence gates on a different variable (Test plan).

## Module and file sequencing

Ordered as the milestones land. Each entry says what the change is for and
what must stay unchanged. Line counts are the specification's estimates.
The product diff is confined to E1's list: `lib/watchlistCsv.ts` (new),
`lib/watchlistImport.ts` (new — the "one further new `lib/` module"),
`components/ManageStocksModal.tsx`, `components/ImportCsvPanel.tsx` (new —
the "one new `components/` file"), `app/page.tsx`, `README.md`. File names
for the two new modules are **plan choices**; the exported names below are
what Verification will import.

### 1. `lib/watchlistCsv.ts` — M1 (new, ≈ 130 lines): the pure codec

No `'use client'`, no `import` of any kind, no `fetch`, no `process.env`,
no React / Next / Convex reference (criterion 24; D5). Exports:

```ts
export interface CsvStock { ticker: string; name: string; tags: string[] }
export interface ParseResult { rows: CsvStock[]; error: string | null }
export const CSV_HEADER = 'ticker,name,tags';
export const EXPORT_FILENAME = 'sector-watchlist.csv';
export const CSV_ERROR_EMPTY = 'The file is empty.';
export const CSV_ERROR_NO_TICKER = 'Missing required column: ticker.';
export const CSV_ERROR_UNTERMINATED = 'Could not parse the CSV: unterminated quoted field.';
export function serializeWatchlist(stocks: ReadonlyArray<CsvStock>): string;
export function parseWatchlistCsv(text: string): ParseResult;
```

`ParseResult` mirrors the specification's own phrasing ("returns rows … and
no error" / "returns an error and no rows"): on success `error` is `null`;
on a file-level error `rows` is `[]`. `lib/watchlist.ts`'s `Stock` is
assignable to `CsvStock` (extra `id` is ignored), so the modal passes its
`stocks` prop straight in.

- **`serializeWatchlist`** (D3, D4; criteria 1, 2, 5, 6): copy and sort by
  `ticker.toUpperCase()` with the modal's own comparator (`<` / `>` on the
  upper-cased strings — not `localeCompare` — so export order and the
  modal's list order can never disagree, criterion 10). Emit
  `CSV_HEADER`, then per stock `field(ticker),field(name),field(tags.join(','))`,
  rows joined by `\n` with a trailing `\n`; an empty list yields
  `'ticker,name,tags\n'`. `field(v)`: if `v` contains `,`, `"`, `\r` or
  `\n` → `"` + `v` with every `"` doubled + `"`, CR / LF kept verbatim;
  otherwise `v` unchanged. Never a BOM, never CRLF, no trimming or
  re-casing of any value ("stored values verbatim"). Tickers are stored
  upper-cased already; the serializer does not re-case them.
- **`parseWatchlistCsv`** (D5, D6; criteria 3, 4, 5, 6, 16) — a character
  state machine, never a line splitter:
  1. Strip one leading `\uFEFF`. If `text.trim() === ''` → `{ rows: [],
     error: CSV_ERROR_EMPTY }` (covers the empty string, whitespace-only
     text, and a file of blank lines only).
  2. Tokenise into records (`string[][]`) with one pass over UTF-16 units
     and the states *field start* / *unquoted* / *quoted* / *after closing
     quote*: outside quotes `,` ends a field and CR, LF or CRLF ends a
     record (a lone CR is a row ending too; CRLF consumes both units);
     a `"` at field start opens a quoted field; inside quotes `""` is a
     literal `"`, and CR, LF and CRLF are **data** appended verbatim
     (criterion 5: `Alpha\r\nBeta` and `Gamma\rDelta` survive); a `"`
     followed by anything but `,`, CR, LF or EOF closes the field and the
     following characters up to the delimiter are appended literally
     (**plan choice**, lenient; unpinned); a `"` inside an *unquoted* field
     is a literal character (**plan choice**; unpinned). EOF while in the
     quoted state → `{ rows: [], error: CSV_ERROR_UNTERMINATED }` — the
     open quote swallows everything to the end of the file (criterion 4's
     `X,"open\nY,Yes,B\n`). A trailing row ending at EOF produces no extra
     record; a trailing `,` produces one extra empty field.
  3. Drop every record whose fields are all empty after `trim()` (blank
     lines, `\r\n\r\n` in criterion 3, whitespace-only lines, `,,`)
     (**plan choice** for the non-physical cases).
  4. The first remaining record is the header: names lower-cased and
     trimmed (`TICKER`, ` Name ` → `ticker`, `name`); the first occurrence
     of a name wins (**plan choice**); unknown names are ignored. No
     `ticker` column → `{ rows: [], error: CSV_ERROR_NO_TICKER }`. `name`
     and `tags` are optional; a missing column reads as blank for every
     row (D6).
  5. Every later record is a data row: `ticker = (fields[iTicker] ?? '').trim()`
     (criterion 3: `msft ` → `msft`, case untouched — the planner
     upper-cases); `name = fields[iName] ?? ''` **verbatim, not trimmed**
     (D5's byte-identical round trip; the planner trims for storage);
     `tags = (fields[iTags] ?? '').split(',').map(trim).filter(nonEmpty)`
     (`"Tech,AI Infra"` → `['Tech', 'AI Infra']`; blank or absent →
     `[]`). Short rows read missing fields as blank (criterion 3's
     `X,"Say ""hi"", Inc."` has two fields → `tags: []`). Rows are
     returned in file order; nothing is validated here — a row with an
     empty ticker is still returned and rejected by the planner.
  6. `'ticker,name,tags\n'` → `{ rows: [], error: null }` (criterion 4).

### 2. `components/ManageStocksModal.tsx` — M2 (toolbar + export, ≈ +60 lines)

The modal keeps its heading, ✕, rows, Edit / Delete, empty state and
scrolling container untouched (criterion 19; frozen T-E2/T-E3/T-E8).

- Directly under the heading `<div>` and before the scrolling list
  container, add a toolbar row `<div className="flex items-center gap-2
  border-b border-gray-200 px-6 py-2">` holding:
  - `<button type="button" data-testid="manage-stocks-export">Export CSV</button>`
  - `<button type="button" data-testid="manage-stocks-import">Import CSV</button>`
    which calls `fileInputRef.current?.click()`;
  - `<input ref={fileInputRef} data-testid="manage-stocks-import-file"
    type="file" accept=".csv,text/csv" className="hidden" onChange=… />`
    (D13). Labels are exactly `Export CSV` / `Import CSV` (D16). Use the
    existing secondary-button classes; no `<h1>`–`<h3>`, and the toolbar
    must not contain the text `Add stock` (frozen T-E2 checks the modal's
    whole text).
- **Export handler** (D2, D3; criterion 1): `const csv =
  serializeWatchlist(stocks); const blob = new Blob([csv], { type:
  'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob);` then
  an `<a href={url} download={EXPORT_FILENAME}>` appended to `document.body`,
  `.click()`ed, removed, and `URL.revokeObjectURL(url)` on the next tick.
  Do **not** prepend `\uFEFF` and do not add a `\r`. Uses the current
  `stocks` prop (already the live Convex list), so no request and no write
  results; an empty watchlist exports the header line alone. Export stays
  enabled in every panel phase (the spec restricts only Import while
  writing).
- Import: `import { serializeWatchlist, parseWatchlistCsv, EXPORT_FILENAME }
  from '../lib/watchlistCsv';` (relative, like the existing `../lib/watchlist`).
  The modal must not import from `convex` or use `useQuery` /
  `useMutation` — writes arrive as callbacks from `app/page.tsx` (criterion
  24, static leg).

### 3. `lib/watchlistImport.ts` — M3 (new, ≈ 100 lines): the pure planner

No `'use client'`, no React / Next / Convex import, no `fetch`; imports
only `validateStock` from `./watchlist` and `CsvStock` from
`./watchlistCsv` (both plain modules). Exports:

```ts
export type ImportOutcome = 'added' | 'skipped' | 'rejected' | 'failed';
export interface ImportRow {
  row: number;             // 1-based data-row number, file order
  ticker: string;          // trimmed, upper-cased (display and data-ticker)
  outcome: ImportOutcome;  // decided at preview; only added → failed may change at apply
  reason: string | null;   // skip reason / validator message / server message; null for added
  name: string | null;     // name that will be stored (added rows); null while a lookup is pending, null for other outcomes
  tags: string[];          // normalised tags for added rows (trimmed, case-insensitively deduped); [] otherwise
  lookupPending: boolean;  // added row whose name is blank and whose lookup has not resolved
  note: string | null;     // NOTE_LOOKUP_MISS after a miss, else null
}
export interface ImportCounts { added: number; skipped: number; rejected: number; failed: number }
export const LOOKUP_CONCURRENCY = 4;
export const REASON_IN_WATCHLIST = 'already in the watchlist';
export const NOTE_LOOKUP_MISS = 'name = ticker (lookup found nothing)';
export function duplicateOfRow(n: number): string;                       // `duplicate of row ${n}`
export function planImport(rows: ReadonlyArray<CsvStock>,
                           existing: ReadonlyArray<{ ticker: string }>): ImportRow[];
export function resolveNames(plan: ReadonlyArray<ImportRow>,
                             lookup: (ticker: string) => Promise<string | null>,
                             onResolved?: (remaining: number) => void): Promise<ImportRow[]>;
export function countOutcomes(plan: ReadonlyArray<ImportRow>): ImportCounts;
export function previewSummary(c: ImportCounts): string;   // `Add N · Skip M · Reject K`
export function reportSummary(c: ImportCounts): string;    // `Added N · Skipped M · Rejected K` + (F > 0 ? ` · Failed F` : '')
export function confirmLabel(n: number): string;           // `Import N stocks`, `Import 1 stock`
export function lookingUpLabel(n: number): string;         // `Looking up N names…`, `Looking up 1 name…`
```

- **`planImport`** (D7, D8; criteria 7, 11, 15, 16) — synchronous, pure,
  one pass in file order with `existingSet = new Set(existing.map(s =>
  s.ticker.toUpperCase()))` and `claimed = new Map<string, number>()`
  (ticker → claiming row number). Per row `n` (1-based), in exactly D8's
  order:
  1. **Ticker validity** — reuse the Add form's validator so the message
     can never drift: `validateStock({ ticker: row.ticker, name: '-',
     tags: ['-'] }, [], null)`; with placeholders for name and tags and an
     empty `existing`, only the ticker rule can fail. Not ok → `rejected`,
     `reason = result.error`, `ticker = row.ticker.trim().toUpperCase()`
     (criterion 7 row 4 shows `BAD TICKER`). Ok → `ticker =
     result.stock.ticker` (trimmed, upper-cased).
  2. **Already in the watchlist** — `existingSet.has(ticker)` → `skipped`,
     `reason = REASON_IN_WATCHLIST`.
  3. **Claimed by an earlier `added` row** — `claimed.has(ticker)` →
     `skipped`, `reason = duplicateOfRow(claimed.get(ticker))`.
  4. **Tags** — `validateStock({ ticker, name: '-', tags: row.tags }, [],
     null)`: not ok → `rejected`, `reason = result.error` (`At least one
     tag is required.` for `[]`; the comma rule cannot trigger because the
     parser split on commas, but is passed through unchanged if it ever
     does). Ok → `tags = result.stock.tags` (the same trimming and
     case-insensitive dedupe the form applies).
  5. Otherwise `added`: `claimed.set(ticker, n)`; `name = row.name.trim()`
     — blank → `name: null, lookupPending: true`, else `name` as typed
     (trimmed), `lookupPending: false`. A blank name never rejects.
  Rejected and skipped rows never claim (criterion 15: row 1 `NVDA,NVIDIA,`
  rejected, row 2 `NVDA,NVIDIA,Chips` added; `NVDA,NVIDIA,Chips` then
  `NVDA,NVIDIA,` → row 2 skipped `duplicate of row 1` even though its tags
  are bad). The placeholder `'-'` is a **plan choice** that isolates one
  rule per call; Execution may instead re-implement the two rules with
  `TICKER_RE` and the identical message strings, but the validator call is
  preferred because the frozen rows quote the validator's message verbatim.
- **`resolveNames`** (D9, D17 support; criteria 7, 8, 17, 18): returns a
  **new** array (never mutates its input). Collect the distinct tickers of
  rows with `lookupPending` (claims already make them distinct; dedupe
  anyway). If none, resolve immediately with a copy and **never call
  `lookup`** (criterion 15's planner leg). Otherwise run a worker pool of
  `min(LOOKUP_CONCURRENCY, queue.length)` async workers pulling from a
  shared index — never `Promise.all` over the whole queue (D9). Per ticker:
  `let found: string | null = null; try { found = await lookup(ticker); }
  catch { found = null; }` — a throw is a miss. Hit (`typeof found ===
  'string' && found.trim() !== ''`) → `name = found, note = null`; miss →
  `name = ticker, note = NOTE_LOOKUP_MISS`. Set `lookupPending = false` on
  every row with that ticker, then call `onResolved(remaining)` with the
  count still pending. The planner never touches the network: the modal
  hands it `fetchCompanyName` from `lib/quotes.ts` (long → short name,
  `BRK.B` retried as `BRK-B`, never throws).
- `countOutcomes` counts by `outcome` (in preview `added` includes rows
  whose lookup is pending — outcomes are fixed at preview, D7/D8; after
  apply, `failed` rows have left `added`). The four string helpers produce
  the D16 strings with `U+00B7` and `U+2026`; they live here so they are
  unit-testable and so the panel renders one string per line.

### 4. `components/ImportCsvPanel.tsx` (new, ≈ 120 lines) and `components/ManageStocksModal.tsx` — M4 (≈ +150 lines in the modal)

**Split (plan choice):** the modal owns the import state machine and every
handler (file chosen, lookups, cancel, confirm, apply, done); the panel is
purely presentational. Neither file imports anything from `convex` or uses
`useQuery` / `useMutation`; neither calls `fetch` directly (the lookup goes
through `fetchCompanyName`). Both stay `'use client'` components as the
modal already is.

**State in the modal:**

```ts
type PanelState =
  | { runId: number; phase: 'preview'; error: string | null; plan: ImportRow[]; pending: number }
  | { runId: number; phase: 'applying'; plan: ImportRow[]; index: number; total: number }
  | { runId: number; phase: 'report'; plan: ImportRow[] };
const [panel, setPanel] = useState<PanelState | null>(null);
const runIdRef = useRef(0);          // D17: identity of the current preview run
const fileInputRef = useRef<HTMLInputElement>(null);
```

New props from `app/page.tsx`:

```ts
onImportRow: (stock: Omit<Stock, 'id'>) => Promise<void>;   // one stocks.add; rejects with the server's own message
onImported: (tickers: string[]) => void;                    // one quote fetch per added ticker (D12)
onImportingChange: (importing: boolean) => void;            // D14 lock for the page-level Escape handler
```

**File chosen (D13, D17; criteria 7, 13, 17, 18)** — the `<input>`'s
`onChange` handler (an event handler, so React StrictMode cannot double-run
it):

```ts
async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  e.target.value = '';                                   // D13: the same file can be chosen again
  if (!file) return;
  const runId = ++runIdRef.current;                      // every chosen file starts its own run
  const existing = stocks;                               // snapshot at choice time (D7: outcomes fixed at preview)
  const text = await file.text();
  if (runIdRef.current !== runId) return;                // replaced or cancelled while reading
  const parsed = parseWatchlistCsv(text);
  if (parsed.error !== null) { setPanel({ runId, phase: 'preview', error: parsed.error, plan: [], pending: 0 }); return; }
  const plan = planImport(parsed.rows, existing);
  const pending = new Set(plan.filter(r => r.lookupPending).map(r => r.ticker)).size;
  setPanel({ runId, phase: 'preview', error: null, plan, pending });
  if (pending === 0) return;
  const resolved = await resolveNames(plan, fetchCompanyName, (remaining) => {
    if (runIdRef.current !== runId) return;               // stale progress: dropped
    setPanel(p => (p && p.runId === runId && p.phase === 'preview') ? { ...p, pending: remaining } : p);
  });
  if (runIdRef.current !== runId) return;                // stale result: dropped (criteria 17, 18)
  setPanel(p => (p && p.runId === runId && p.phase === 'preview') ? { ...p, plan: resolved, pending: 0 } : p);
}
```

Every `setPanel` after an `await` is double-guarded by `runIdRef` and by the
state's own `runId`, so a late `/api/stock` result can never re-open a
cancelled panel, touch a newer file's rows or enable its confirm button.
Requests in flight are not aborted (D17: allowed to finish, then
discarded). `existing` is the `stocks` prop at choice time; later `stocks`
updates (criterion 12's second client) never re-plan.

**Cancel** (`manage-stocks-import-cancel`, D10; criterion 9):
`runIdRef.current++; setPanel(null);` — writes nothing, returns to the
list. Offered in the file-level-error state too (**plan choice**: the
spec says the panel shows the error "and no preview"; a way back to the
list is still needed).

**Dismissal (D14; criteria 17, 19):** ✕ and the backdrop call `onClose`
only when `panel?.phase !== 'applying'`; the page-level Escape handler
gets the same guard through `onImportingChange`. Because `app/page.tsx`
renders `{manageOpen && <ManageStocksModal …/>}`, dismissal unmounts the
modal and all panel state with it: reopening shows the list. An unmount
effect (`useEffect(() => () => { runIdRef.current++;
onImportingChange(false); }, [])`) invalidates any run still in flight;
under StrictMode's dev double-mount this runs once before any file can be
chosen and is harmless.

**Import CSV availability:** the `Import CSV` button and the file input are
`disabled` while `panel?.phase === 'applying'`; enabled in the list view,
in preview (including while lookups run) and in report (choosing a new
file discards the panel and starts a fresh run).

**Confirm and apply (D11, D12, D14; criteria 10, 12):**

```ts
async function handleConfirm() {
  const s = panel;
  if (!s || s.phase !== 'preview' || s.error !== null || s.pending > 0) return;
  const runId = s.runId;
  const plan = s.plan.map(r => ({ ...r }));
  const targets = plan.filter(r => r.outcome === 'added');
  if (targets.length === 0) return;
  onImportingChange(true);
  const added: string[] = [];
  for (let i = 0; i < targets.length; i++) {
    setPanel({ runId, phase: 'applying', plan: [...plan], index: i + 1, total: targets.length });
    const r = targets[i];
    try {
      await onImportRow({ ticker: r.ticker, name: r.name as string, tags: r.tags });
      added.push(r.ticker);
    } catch (err) {
      r.outcome = 'failed';
      r.reason = err instanceof Error ? err.message : String(err);
    }
  }
  onImportingChange(false);
  onImported(added);                    // D12: fire the quote fetches before the report shows
  setPanel({ runId, phase: 'report', plan: [...plan] });
}
```

One `stocks.add` at a time, file order; a refusal marks that row `failed`
with the server's message and the loop continues; nothing written is
undone; skipped / rejected rows never reach `onImportRow`; a `skipped`
duplicate is not promoted when its claimant fails (the plan array is not
re-planned). **Done** (`manage-stocks-import-done`): `setPanel(null)`.

**`ImportCsvPanel` rendering (D15, D16):** props `{ state: PanelState;
onCancel; onConfirm; onDone }`. It is rendered by the modal **inside the
existing scrolling container** (`min-h-0 flex-1 overflow-y-auto px-6
py-2`) **instead of** the `<ul>` / empty-state `<p>` whenever `panel !==
null`, so a long preview scrolls inside the modal exactly as the list does
(frozen T-E8 pins that container). Markup, top to bottom:

- `<div data-testid="manage-stocks-import-panel" data-phase={state.phase}>`
  — the only wrapper; no `<h1>`–`<h3>` anywhere inside (criterion 19).
- file-level error: `<p data-testid="manage-stocks-import-error">{error}</p>`
  and the Cancel button; no summary, no rows.
- status line (preview with `pending > 0`): `<p>{lookingUpLabel(pending)}</p>`;
  applying: `<p>{`Importing ${index} of ${total}…`}</p>`.
- summary: `<p data-testid="manage-stocks-import-summary">` —
  `previewSummary(counts)` in preview and applying, `reportSummary(counts)`
  in report — always one string, one text node.
- rows: `<ul>` of `<li data-testid="manage-stocks-import-row"
  data-row={r.row} data-ticker={r.ticker} data-outcome={r.outcome}>` whose
  text is built as **one string**, e.g. `${r.row}  ${r.ticker}  ${r.outcome}`
  + (`r.reason` ? ` — ${r.reason}` : '') + (`r.name` ? ` — ${r.name}` : '')
  + (`r.note` ? ` · ${r.note}` : ''); an `added` row with a pending lookup
  shows no name until it resolves. Rows keep their numbers and order in
  every phase; after apply the same rows carry their final outcomes.
- buttons (bottom): preview → `Cancel` (`manage-stocks-import-cancel`,
  always) and, **only when `pending === 0 && counts.added > 0`**,
  `<button data-testid="manage-stocks-import-confirm">{confirmLabel(counts.added)}</button>`
  (the element must not exist otherwise — criteria 11, 16, 17 assert count
  0); applying → no buttons (or both disabled; **plan choice**: render
  none); report → `Done` (`manage-stocks-import-done`).
- Never render the ids `add-stock-button`, `stock-price`, `stock-change`,
  `stock-row`, `manage-stocks-row`, `manage-stocks-edit`,
  `manage-stocks-delete`, `manage-stocks-empty`, nor `manage-stocks-tag`,
  inside the panel; never the text `Add stock` (note `Add stocks` would
  also contain it — the D16 strings `Add N`, `Added N`, `Import N stocks`
  are safe).

### 5. `app/page.tsx` — M4 wiring (≈ 40 lines)

- `const [importing, setImporting] = useState(false);` and in the Escape
  effect's final branch `else if (!importing) setManageOpen(false);` with
  `importing` added to the dependency array. The StockForm / delete-confirm
  branches are unchanged (they cannot be open behind a panel anyway).
- ```ts
  function serverMessage(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    const m = /Uncaught (?:[A-Za-z]*Error): ([^\n]*)/.exec(raw);
    return (m ? m[1] : raw).trim();
  }
  async function handleImportRow(data: Omit<Stock, 'id'>) {
    try { await addStock(data); } catch (err) { throw new Error(serverMessage(err)); }
  }
  function handleImported(tickers: string[]) { for (const t of tickers) void fetchOne(t); }
  ```
  `addStock` is the existing `useMutation(api.stocks.add)`; no other
  mutation is added or touched (criterion 24). The message extraction is
  what lets criterion 12's row read `NVDA is already in the watchlist.`;
  on a production deployment Convex redacts to `Server Error`, which the
  panel then shows as the server's message — acceptable per the spec.
- `fetchOne` unconditionally for every added ticker ("each ticker added
  by an import gets one quote fetch"; criterion 10 counts exactly one per
  added ticker and none for failed rows). The board, cards and empty
  state update live through the existing `useQuery(api.stocks.list)`.
- Pass `onImportRow={handleImportRow}`, `onImported={handleImported}`,
  `onImportingChange={setImporting}` to `<ManageStocksModal>`; nothing else
  in the page changes (header buttons, share, admin, forms untouched).

### 6. `README.md` — M5 (one or two sentences)

In the opening paragraph after "…so entries can be maintained without
hunting through the cards." add e.g.: *From the same modal, **Export CSV**
downloads the watchlist as a `ticker,name,tags` file and **Import CSV**
previews such a file — skipping tickers already present, looking up blank
company names, rejecting rows without a tag — and adds the new rows only
after you confirm.* Keep every pinned literal intact: `Manage Stocks`,
`Company name`, the autofill sentence (`auto-fills`), `summary`, `mean`
(criterion 25; frozen `AF-STATIC-23`, cycle-3 `T-S1`, `SS-S-14`).

### 7. Execution's own regression pass — M5

On the tree after 1–6: `env -u NODE_ENV npx tsc --noEmit` → 0; stop any dev
server, `env -u NODE_ENV npm run build` → 0 with the route set `/`,
`/_not-found`, `/admin`, `/api/stock`, `/shared/[token]` (E2);
`env -u NODE_ENV -u LOOPZAI_CYCLE npm test` → 0, expected `92 passed, 3
skipped` (criterion 22). Record the three results in the execution-log
entry. Execution adds **no** file under `tests/` (assumption-0001
convention: Verification freezes the rows) and modifies none (E1). If
`npx convex dev --once` is run for any reason and rewrites
`convex/_generated/`, restore it (`git checkout -- convex/_generated`)
before committing — E1 forbids any `convex/` change. Before C4, walk the
D15 checklist against the frozen Manage Stocks rows (heading count, `Add
stock` literal, in-panel scrolling, ids) — "Frozen-row repair mechanics"
lists each row and its product-side answer.

Not touched this cycle (Scope boundary, E1): `app/api/**`, `app/shared/**`,
`app/admin/**`, `convex/**`, `package.json` / `package-lock.json`,
`playwright.config.ts`, `tests/**` (Execution), `components/StockForm.tsx`,
`components/SectorCard.tsx`, `components/WatchlistBoard.tsx`,
`components/TagFilterBar.tsx`, `components/SharePanel.tsx`,
`lib/watchlist.ts`, `lib/quotes.ts`, `lib/useQuotes.ts`,
`lib/sectorSummary.ts`.

## Test plan

**Shared environment (identical to the frozen cycle-2/3, autofill and
sector-summary harness):** Playwright config as committed (`workers: 1`,
`retries: 0`, `expect.timeout` 15 s, test timeout 240 s, `webServer: npm
run dev` with `NEXT_PUBLIC_E2E_TEST_MODE=1` on :3000,
`reuseExistingServer: true`, global warm-up navigation). Convex **dev**
deployment from `.env.local` (`NEXT_PUBLIC_CONVEX_URL`; refuse if it
matches `frugal-anaconda-225`); `SECRET = 'loopzai-e2e-dev-secret'`;
`ADMIN = 'trixiematic415@gmail.com'`; reset via `anyApi.testing.reset {
secret }`; Node-client sign-in via `anyApi.auth.signIn { provider:
'test-login', params: { email, secret } }` then `client.setAuth(tokens.token)`;
browser sign-in via the `test-signin-email` / `test-signin-secret` /
`test-signin-submit` form, then wait for `manage-stocks-button`; viewport
1280×720. Run command for every durable row: `env -u NODE_ENV -u
LOOPZAI_CYCLE npm test`. Playwright's default `acceptDownloads: true` is
what row 1 relies on.

**Fixture (spec "Success criteria" preamble), seeded through the Node
client as ADMIN in this order:** `AAPL` / `Apple` / `['Tech']`; `MSFT` /
`Microsoft` / `['Tech', 'Cloud']`. `testing.reset` wipes sessions too, so
every reseed is followed by a fresh browser sign-in: helper
`freshFixture(page, extra = [])` = reset → Node sign-in → seed fixture (+
`extra`) → `page.goto('/')` → form sign-in → `manage-stocks-button`
visible → `waitForTimeout(2000)` so the load-triggered quote fetches
settle before any counter baseline.

**Lookup / quote stub, installed on every browser context
(`ctx.route('**/api/stock*')`), autofill-e2e precedent:** a request log
`log: string[]` of raw `ticker` params and a `delays: Record<string,
number>` map (if `delays[T]` is set, `await` that many ms before
answering). `NVDA` → 200 `{ ticker, price: 100, previousClose: 100,
changePercent: 0, historicalPrice: 100, name: 'NVIDIA Corporation' }`;
`NONAME` → 200 with the same body and `name: null`; **every other
ticker** (including `AAPL`, `MSFT`, `GOOG`, `FOO`) → 404 JSON `{ error }`.
"Delayed" in criteria 17–18 = `delays.NVDA = 6000` (≥ 5 s). Request
deltas are measured as `log.slice(baseline)` and compared as multisets
(the pool may reorder `NVDA` / `NONAME`).

**Files (Verification writes them as V0; Execution writes none):**
- `tests/watchlist-csv-unit.spec.ts` — criteria 2, 3, 4, 5, 6, 15 (planner
  leg), 16 (parser leg), 21 (validator leg), plus the helper rows below.
- `tests/watchlist-csv-e2e.spec.ts` — criteria 1, 7–20, 21 (server leg);
  one serial describe, one long-lived ADMIN context.
- `tests/watchlist-csv-static.spec.ts` — criteria 24 (static legs), 25.
- `tests/watchlist-csv-scoped.spec.ts` — E1, gated by
  `test.skip(process.env.LOOPZAI_EVIDENCE !== 'watchlist-csv', 'cycle-3
  (csv) scoped evidence')` so the plain suite reports it **skipped**;
  **never** gated on `LOOPZAI_CYCLE` (the spec forbids re-arming
  `tests/cycle3-scoped.spec.ts`).
Criteria 22, 23 and E2 are graded by the Verification procedure, not by a
new file.

**File texts used below** (`\n` and `\r` are the real control characters;
File A is the spec's block verbatim):

- `FILE_A = 'ticker,name,tags\naapl,Apple Inc.,Tech\nNVDA,,"Chips,Tech"\nGOOG,Alphabet,\nBAD TICKER,Bad,Tech\nNVDA,NVIDIA dup,Chips\nNONAME,,Misc\n'`
- `FILE_12 = 'ticker,name,tags\nNVDA,NVIDIA,Chips\nNONAME,,Misc\n'`
- `FILE_15a = 'ticker,name,tags\nNVDA,NVIDIA,\nNVDA,NVIDIA,Chips\n'`,
  `FILE_15b = 'ticker,name,tags\nNVDA,NVIDIA,Chips\nNVDA,NVIDIA,\n'`
- `FILE_16 = 'ticker,name\nNVDA,NVIDIA\n'`
- `FILE_X = 'ticker,name,tags\nNVDA,,Chips\n'`, `FILE_Y = 'ticker,name,tags\nNONAME,,Misc\n'`
- `HEADER_ONLY = 'ticker,name,tags\n'`
- unreadable: `''`, `'  \n\t\n'`, `'symbol,name,tags\nAAPL,Apple,Tech\n'`,
  `'ticker,name,tags\nX,"open,A\n'`, `'ticker,name,tags\nX,"open\nY,Yes,B\n'`

**Helpers:** `chooseFile(page, name, text)` =
`page.getByTestId('manage-stocks-import-file').setInputFiles({ name,
mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') })` (works on the
hidden input; for criterion 13's "saved as files" the same texts may be
written under `test.info().outputPath()` and passed as paths — equivalent);
`panel = page.getByTestId('manage-stocks-import-panel')`, `summary =
page.getByTestId('manage-stocks-import-summary')`, `irow(n) =
page.locator('[data-testid="manage-stocks-import-row"][data-row="<n>"]')`,
`confirmBtn = page.getByTestId('manage-stocks-import-confirm')`,
`cancelBtn`, `doneBtn`, `errorEl` likewise; `mrows`, `mrow`, `modal`,
`backdrop`, `clickManageBackdrop` and `card` exactly as in
`tests/cycle3-e2e.spec.ts`; `list()` = Node-client `anyApi.stocks.list`
mapped to `{ ticker, name, tags }` sorted by ticker; `expectRow(n, ticker,
outcome, ...contains)` asserts `data-ticker`, `data-outcome` and
`toContainText` for each string. `toHaveText` normalises whitespace, so
single spaces are safe; `·`, `…`, `–` must match exactly.

### Codec and planner rows — `tests/watchlist-csv-unit.spec.ts` (direct calls, no browser)

`import { serializeWatchlist, parseWatchlistCsv } from '../lib/watchlistCsv';`
`import { planImport, resolveNames, countOutcomes, previewSummary,
reportSummary, confirmLabel, lookingUpLabel, LOOKUP_CONCURRENCY } from
'../lib/watchlistImport';` `import { validateStock } from '../lib/watchlist';`

| Row | Command / input | Pass criteria |
|---|---|---|
| **2** | `serializeWatchlist([{ticker:'ZZ', name:'Foo, Inc.', tags:['A']}, {ticker:'AB', name:'Say "hi"', tags:['X','Y Z']}])` | `toBe('ticker,name,tags\nAB,"Say ""hi""","X,Y Z"\nZZ,"Foo, Inc.",A\n')`. |
| **1u** (plan-derived, mirrors criterion 1's bytes) | `serializeWatchlist([{AAPL,'Apple',['Tech']},{MSFT,'Microsoft',['Tech','Cloud']}])`; `serializeWatchlist([])` | `'ticker,name,tags\nAAPL,Apple,Tech\nMSFT,Microsoft,"Tech,Cloud"\n'`; `'ticker,name,tags\n'`; neither starts with `\uFEFF`; neither contains `\r`. |
| **3** | `parseWatchlistCsv('\uFEFFTICKER, Name ,tags,extra\r\nAAPL,Apple Inc.,"Tech,AI Infra",ignored\r\n\r\nmsft ,,Cloud\r\nX,"Say ""hi"", Inc."\r\n')` | `error === null`; `rows` `toEqual([{ticker:'AAPL', name:'Apple Inc.', tags:['Tech','AI Infra']}, {ticker:'msft', name:'', tags:['Cloud']}, {ticker:'X', name:'Say "hi", Inc.', tags:[]}])`. |
| **4a** | `parseWatchlistCsv('')`, `parseWatchlistCsv('  \n\t\n')` | each `toEqual({ rows: [], error: 'The file is empty.' })`. |
| **4b** | `parseWatchlistCsv('symbol,name,tags\nAAPL,Apple,Tech\n')` | `{ rows: [], error: 'Missing required column: ticker.' }`. |
| **4c** | `parseWatchlistCsv('ticker,name,tags\nX,"open,A\n')`, `parseWatchlistCsv('ticker,name,tags\nX,"open\nY,Yes,B\n')` | each `{ rows: [], error: 'Could not parse the CSV: unterminated quoted field.' }`. |
| **4d** | `parseWatchlistCsv('ticker,name,tags\n')` | `{ rows: [], error: null }`. |
| **5a** | `serializeWatchlist([{ticker:'NL', name:'Line one\nLine two', tags:['A']}])` → `text`; `parseWatchlistCsv(text)` | `text === 'ticker,name,tags\nNL,"Line one\nLine two",A\n'`; parse → `error null`, `rows` `toEqual([{ticker:'NL', name:'Line one\nLine two', tags:['A']}])`. |
| **5b** | `parseWatchlistCsv('ticker,name,tags\r\nCR,"Alpha\r\nBeta",A\r\nLF,"Gamma\rDelta",B\r\n')` | `error null`; rows `toEqual([{ticker:'CR', name:'Alpha\r\nBeta', tags:['A']}, {ticker:'LF', name:'Gamma\rDelta', tags:['B']}])`. |
| **6** | Fixed list: `[{ZETA,'Z, Co',['A']}, {ALPHA,'Say "hi"',['X','Y Z']}, {NL,'Line one\nLine two',['T']}, {CR,'Alpha\r\nBeta',['A','B','C']}, {LONE,'Gamma\rDelta',['Q']}, {PLAIN,'Plain',['One']}, {'BRK.B','Berkshire Hathaway Inc.',['Fin']}, {Q2,'"quoted" start',['A B']}]`; plus 50 generated lists (seeded LCG; 0–12 stocks; tickers from `[A-Z0-9.^-]{1,10}` distinct upper-cased; names of 0–20 chars from an alphabet including `,`, `"`, `\r`, `\n`, space, letters; 1–4 tags of 1–8 chars from letters/space/`;`/`|` with no leading/trailing space) | for each list `L`: `parseWatchlistCsv(serializeWatchlist(L))` has `error null` and `rows` `toEqual` `L` sorted by `ticker.toUpperCase()` (same `<`/`>` comparator), comparing `(ticker, name, tags)` triples. Generator constraints follow the parser's trimming rules: tickers carry no whitespace (the alphabet has none), tags have no leading / trailing whitespace (the parser trims tags), names are unconstrained (the parser never trims a name, so any name — including one made of spaces, `,`, `"`, CR or LF — round-trips). |
| **16u** | `parseWatchlistCsv('ticker,name\nNVDA,NVIDIA\n')` | `{ rows: [{ticker:'NVDA', name:'NVIDIA', tags:[]}], error: null }`. |
| **15u** | `rowsA = parseWatchlistCsv(FILE_15a).rows`; `plan = planImport(rowsA, [{ticker:'AAPL'},{ticker:'MSFT'}])`; `lookup = async () => { calls++; return 'X'; }`; `resolved = await resolveNames(plan, lookup)` | `plan[0]` `toMatchObject({ row: 1, ticker: 'NVDA', outcome: 'rejected', reason: 'At least one tag is required.' })`; `plan[1]` `toMatchObject({ row: 2, ticker: 'NVDA', outcome: 'added', name: 'NVIDIA', tags: ['Chips'], lookupPending: false })`; `calls === 0`; `resolved` `toEqual(plan)` (same two outcomes, same claim); `countOutcomes(plan)` `{ added: 1, skipped: 0, rejected: 1, failed: 0 }`; `previewSummary(...)` `'Add 1 · Skip 0 · Reject 1'`. Contrast: `planImport(parseWatchlistCsv(FILE_15b).rows, fixture)` → row 1 `added`, row 2 `toMatchObject({ outcome: 'skipped', reason: 'duplicate of row 1' })`; summary `'Add 1 · Skip 1 · Reject 0'`. |
| **7u** (plan-derived, File A through the planner) | `plan = planImport(parseWatchlistCsv(FILE_A).rows, fixture)`; `lookup` returns `'NVIDIA Corporation'` for `NVDA`, `null` for `NONAME`, records every call; `resolved = await resolveNames(plan, lookup)` | outcomes in order `skipped / added / rejected / rejected / skipped / added`; reasons `already in the watchlist`, `null`, `At least one tag is required.`, `Ticker is required: 1–10 characters, letters/digits/. ^ - only.`, `duplicate of row 2`, `null`; `plan[1].lookupPending === true`, `plan[5].lookupPending === true`; `plan[0].ticker === 'AAPL'`, `plan[3].ticker === 'BAD TICKER'`; lookup called exactly with `['NVDA','NONAME']` (any order); `resolved[1]` `{ name: 'NVIDIA Corporation', note: null, lookupPending: false }`; `resolved[5]` `{ name: 'NONAME', note: 'name = ticker (lookup found nothing)' }`; `plan` itself unchanged (`plan[1].lookupPending` still `true`); `previewSummary(countOutcomes(resolved))` `'Add 2 · Skip 2 · Reject 2'`. |
| **9u** (D9 pool) | 10 rows `T01…T10` with blank names; `lookup` increments `inFlight` on entry, records `maxInFlight`, awaits 20 ms, decrements, returns `null`; a second run where `lookup` throws | `maxInFlight <= LOOKUP_CONCURRENCY` (`=== 4`); every ticker looked up exactly once; `onResolved` called 10 times with `remaining` ending at `0`; a throwing lookup yields `name = ticker` and the miss note, never a rejected promise. |
| **16s** (strings) | `confirmLabel(1)`, `confirmLabel(2)`, `lookingUpLabel(1)`, `lookingUpLabel(3)`, `reportSummary({added:2,skipped:2,rejected:2,failed:0})`, `reportSummary({added:1,skipped:0,rejected:0,failed:1})` | `'Import 1 stock'`, `'Import 2 stocks'`, `'Looking up 1 name…'`, `'Looking up 3 names…'`, `'Added 2 · Skipped 2 · Rejected 2'`, `'Added 1 · Skipped 0 · Rejected 0 · Failed 1'`. |
| **21u** | `validateStock({ ticker: 'X', name: 'X', tags: ['A,B'] }, [], null)` | `toEqual({ ok: false, error: 'Tags may not contain commas.' })`. |

### Browser rows — `tests/watchlist-csv-e2e.spec.ts`

`test.describe.configure({ mode: 'serial' })`; `beforeAll`: reset; ADMIN
browser context with the stub; sign in via the form (empty watchlist).
Segments are separated by `freshFixture` because several rows write.

| Row | Command / input | Pass criteria |
|---|---|---|
| **20-empty, 1-empty** | Open the modal on the empty watchlist | `manage-stocks-empty` `toHaveText('No stocks yet.')`; `manage-stocks-export` and `manage-stocks-import` visible with texts `Export CSV` / `Import CSV`; `panel` count 0; `[download] = await Promise.all([page.waitForEvent('download'), exportBtn.click()])`; `download.suggestedFilename() === 'sector-watchlist.csv'`; `fs.readFileSync(await download.path())` `.equals(Buffer.from('ticker,name,tags\n'))`. Close via ✕. |
| **20, 1** | `freshFixture(page)`; open the modal; `base = log.length`; `l0 = await list()`; export as above | `mrows` count 2; both buttons visible; no panel; filename `sector-watchlist.csv`; bytes `.equals(Buffer.from('ticker,name,tags\nAAPL,Apple,Tech\nMSFT,Microsoft,"Tech,Cloud"\n'))` — first three bytes `74 69 63` (no BOM), no `0x0d`; `waitForTimeout(1500)`; `log.length === base` (no `/api/stock` request); `await list()` `toEqual(l0)`. |
| **7, 8, 19a** | `base = log.length`; `chooseFile('file-a.csv', FILE_A)` | `panel` visible with `data-phase="preview"`; `summary` `toHaveText('Add 2 · Skip 2 · Reject 2')` (auto-waits through the lookups); `manage-stocks-import-row` count 6; `expectRow(1,'AAPL','skipped','already in the watchlist')`; `expectRow(2,'NVDA','added','NVIDIA Corporation')`; `expectRow(3,'GOOG','rejected','At least one tag is required.')`; `expectRow(4,'BAD TICKER','rejected','Ticker is required: 1–10 characters, letters/digits/. ^ - only.')`; `expectRow(5,'NVDA','skipped','duplicate of row 2')`; `expectRow(6,'NONAME','added','NONAME','name = ticker (lookup found nothing)')`; `confirmBtn` `toHaveText('Import 2 stocks')`; `log.slice(base)` upper-cased sorted `toEqual(['NONAME','NVDA'])` — none for `AAPL`, `GOOG`, `BAD TICKER`; `await list()` `toEqual(l0)`. **19a:** `modal.locator('h1, h2, h3')` count 1 text `Manage Stocks`; modal `textContent` not containing `Add stock`; `modal.getByTestId('add-stock-button'|'stock-price'|'stock-change')` each count 0. |
| **9** | `base = log.length`; `cancelBtn.click()` | `panel` count 0; `mrows` count 2 (`AAPL`, `MSFT`); `waitForTimeout(1000)`; `log.length === base`; `await list()` `toEqual(l0)`. |
| **16** | `base = log.length`; `chooseFile('no-tags.csv', FILE_16)` | `summary` `'Add 0 · Skip 0 · Reject 1'`; rows count 1; `expectRow(1,'NVDA','rejected','At least one tag is required.')`; `confirmBtn` count 0; `cancelBtn` visible; `log.length === base`; `list()` unchanged; Cancel. |
| **15-contrast** | `base = log.length`; `chooseFile('dup-first.csv', FILE_15b)` | `summary` `'Add 1 · Skip 1 · Reject 0'`; `expectRow(1,'NVDA','added','NVIDIA')`; `expectRow(2,'NVDA','skipped','duplicate of row 1')`; `confirmBtn` `'Import 1 stock'`; `log.length === base`; Cancel; `list()` unchanged. |
| **13** | `chooseFile('header.csv', HEADER_ONLY)` → then each unreadable text in turn (choosing the next file replaces the panel) | header-only: `summary` `'Add 0 · Skip 0 · Reject 0'`, rows 0, `confirmBtn` 0, `cancelBtn` visible. Each unreadable file: `panel` visible, `errorEl` `toHaveText` the exact criterion-4 message, `summary` count 0, rows 0, `confirmBtn` 0; after the last, Cancel; `list()` unchanged throughout. |
| **17** | `delays.NVDA = 6000`; `t0 = Date.now()`; `chooseFile('x.csv', FILE_X)` | `panel` `toContainText('Looking up 1 name…')`; `confirmBtn` count 0; `cancelBtn.click()` at once → `panel` count 0, `mrows` count 2; `waitForTimeout(Math.max(0, 7000 - (Date.now() - t0)))`; `panel` count 0; `page.locator('[data-testid="manage-stocks-import-confirm"]')` count 0 (page-wide); `list()` `toEqual(l0)`. **Escape variant:** choose `FILE_X` again → `Looking up 1 name…` → `keyboard.press('Escape')` → `modal` count 0 → wait ≥ 7 s from choice → `modal` still 0 and no `manage-stocks-import-confirm` anywhere → open the modal → `mrows` 2, `panel` 0, `confirmBtn` 0. **Backdrop variant:** the same with `clickManageBackdrop(page)`. Then `delete delays.NVDA`; `list()` `toEqual(l0)`. |
| **18** | Modal open on the list; `delays.NVDA = 6000`; `t0 = Date.now()`; `chooseFile('x.csv', FILE_X)`; `panel` `toContainText('Looking up 1 name…')`; `chooseFile('y.csv', FILE_Y)` | `summary` `'Add 1 · Skip 0 · Reject 0'`; rows count 1; `expectRow(1,'NONAME','added','NONAME','name = ticker (lookup found nothing)')`; `confirmBtn` `'Import 1 stock'`; wait until ≥ 7 s after `t0`; still rows 1, same summary, same confirm label; `panel` `textContent` `not.toContain('NVDA')`; `confirmBtn.click()`; `panel` `data-phase="report"`, `summary` `'Added 1 · Skipped 0 · Rejected 0'`; `list()` has `NONAME` and no `NVDA`; `doneBtn.click()`; `mrows` `['AAPL','MSFT','NONAME']`; `delete delays.NVDA`. |
| **21s** (server leg, Node client) | `client.mutation(anyApi.stocks.add, { ticker: 'ZZZ', name: 'Z', tags: ['A,B'] })` | `rejects` with an error whose `message` contains `Tags may not contain commas.`; `list()` has no `ZZZ`. |
| **10, 19b** | `freshFixture(page)`; open modal; `chooseFile(FILE_A)`; `confirmBtn` `'Import 2 stocks'`; `base = log.length`; `confirmBtn.click()` | `panel` reaches `data-phase="report"` (the transient `applying` phase / `Importing i of 2…` may be asserted with `toContainText` if caught, not required); `summary` `toHaveText('Added 2 · Skipped 2 · Rejected 2')` and `not.toContainText('Failed')`; rows 2 and 6 `data-outcome="added"`, rows 1/5 `skipped`, 3/4 `rejected` (same texts as row 7); `expect.poll(() => list())` has 4 rows incl. `{NVDA,'NVIDIA Corporation',['Chips','Tech']}` and `{NONAME,'NONAME',['Misc']}`; `card('Chips')` and `card('Misc')` count ≥ 1; `expect.poll(() => sorted(log.slice(base)))` `toEqual(['NONAME','NVDA'])`; `waitForTimeout(10_000)`; `log.length === base + 2`; **19b:** heading count 1 / `Manage Stocks`, no `Add stock`, no `add-stock-button` / `stock-price` / `stock-change` inside the modal while the report shows; `doneBtn.click()` → `panel` 0, `mrows` `['AAPL','MSFT','NONAME','NVDA']`, each row exactly one `manage-stocks-edit` and one `manage-stocks-delete`; close; `page.reload()`; sign-in persists (`manage-stocks-button`); open modal → same four rows in order; `card('Chips')`, `card('Misc')` present. |
| **11** | Modal open; `base = log.length`; `chooseFile(FILE_A)` | `summary` `'Add 0 · Skip 4 · Reject 2'`; `confirmBtn` count 0; `cancelBtn` visible; `log.length === base`; Cancel; `list()` still the same 4 rows. |
| **14** | `freshFixture(page, [{ticker:'FOO', name:'Foo, Inc.', tags:['A','B']}])`; open modal; export → `buf` | `buf.equals(Buffer.from('ticker,name,tags\nAAPL,Apple,Tech\nFOO,"Foo, Inc.","A,B"\nMSFT,Microsoft,"Tech,Cloud"\n'))` (plan-derived from D3/D4; the pinned part follows); `setInputFiles({ name: 'sector-watchlist.csv', mimeType: 'text/csv', buffer: buf })`; `summary` `'Add 0 · Skip 3 · Reject 0'`; `confirmBtn` 0; Cancel. |
| **12** | `freshFixture(page)`; open modal; `chooseFile('race.csv', FILE_12)`; `summary` `'Add 2 · Skip 0 · Reject 0'`; `confirmBtn` `'Import 2 stocks'`; second client: `nodeSignIn(ADMIN)` then `stocks.add { ticker: 'NVDA', name: 'NVIDIA', tags: ['Chips'] }`; `expect.poll(() => list())` shows `NVDA` (the add landed before confirm; the panel must still read `Add 2 · Skip 0 · Reject 0` — outcomes are fixed at preview); `base = log.length`; `confirmBtn.click()` | report `summary` `toHaveText('Added 1 · Skipped 0 · Rejected 0 · Failed 1')`; `irow(1)` `data-outcome="failed"` and `toContainText('NVDA is already in the watchlist.')`; `irow(2)` `data-outcome="added"`; `list()` has exactly one `NVDA` and one `NONAME`; `expect.poll(() => log.slice(base))` `toEqual(['NONAME'])` (nothing fetched for the failed row); Done. |
| **15-confirm** | `freshFixture(page)`; open modal; `base = log.length`; `chooseFile('first-eligible.csv', FILE_15a)` | `summary` `'Add 1 · Skip 0 · Reject 1'`; `expectRow(1,'NVDA','rejected','At least one tag is required.')`; `expectRow(2,'NVDA','added','NVIDIA')`; `confirmBtn` `'Import 1 stock'`; `log.length === base` (name non-blank → no lookup); `confirmBtn.click()`; report `'Added 1 · Skipped 0 · Rejected 1'`; `list()` has exactly one `NVDA` = `{ name: 'NVIDIA', tags: ['Chips'] }`; Done. |
| **20-elsewhere** | ADMIN `share-button` → `share-create` → `share-created-url` token (cycle-3 T-E9 precedent); anonymous context + stub → `/shared/<token>`; OUTSIDER context → sign in → `not-invited`; then `/admin` | on each page `page.locator('[data-testid^="manage-stocks-"]')` count 0 (after `sector-card` count ≠ 0 on the shared page, as T-E9 waits). Close both contexts. |

### Static rows — `tests/watchlist-csv-static.spec.ts`

| Row | Command / input | Pass criteria |
|---|---|---|
| **24a** (lib purity) | `fs.readFileSync` of `lib/watchlistCsv.ts` and `lib/watchlistImport.ts` | neither matches `/use client/`, `/from\s+['"]react/`, `/from\s+['"]next/`, `/from\s+['"]convex/`, `/from\s+['"]\.\.\/convex/`, `/\bfetch\(/`, `/process\.env/`, `/useQuery|useMutation/`; the codec additionally matches none of `/^\s*import\s/m`, `/require\(/`; the codec exports `serializeWatchlist` and `parseWatchlistCsv`; the planner exports `planImport` and `resolveNames` (regex on `export\s+(async\s+)?function\s+<name>\b`). |
| **24b** (writes only through `stocks.add`) | `components/ManageStocksModal.tsx`, `components/ImportCsvPanel.tsx` (skip if absent — the spec allows the panel to live inside the modal), `app/page.tsx` | modal and panel match none of `/from\s+['"]convex/`, `/from\s+['"]\.\.\/convex/`, `/useMutation|useQuery/`, `/\bfetch\(/`, `/api\.stocks\./`; `app/page.tsx` references `api.stocks.add` and every `api\.\w+\.\w+` reference in it is one of `users.me`, `stocks.list`, `stocks.add`, `stocks.update`, `stocks.remove` (the pre-existing set — a durable "no new server call from this page" promise, not a route inventory). |
| **25** | `fs.readFileSync('README.md')` | `toContain('Manage Stocks')`, `toContain('Company name')`, `toMatch(/auto-?fills?|autofill/i)`, `toMatch(/summary/i)`, `toMatch(/\bmean\b/i)`, and `toMatch(/export/i)` and `toMatch(/import/i)` and `toMatch(/\bCSV\b/)`. |

### Cycle-scoped evidence — `tests/watchlist-csv-scoped.spec.ts` (gated) and the procedure

| Row | Command / input | Pass criteria |
|---|---|---|
| **E1** (gated on `LOOPZAI_EVIDENCE === 'watchlist-csv'`) | `BASE = '8868bcedbb6534c6bbe4ae81d2f09e016cfbf2a1'`; `changed = git diff --name-only BASE -- . ':!.loopzai'` ∪ `git ls-files --others --exclude-standard -- . ':!.loopzai'`, minus `tests/watchlist-csv-*` | every entry is in the allowed set `{ lib/watchlistCsv.ts, lib/watchlistImport.ts, components/ManageStocksModal.tsx, components/ImportCsvPanel.tsx, app/page.tsx, README.md }` (at most one new `lib/` beyond the codec, at most one new `components/` file); no entry starts with `convex/`, `app/api/`, `app/shared/`, `app/admin/`, `tests/`; `package.json` / `package-lock.json` absent and `depsOf('HEAD')` `toEqual(depsOf(BASE))` (Cycle 2's `depsOf` helper); `console.log('E1 CHANGED = …')` for the report. Expected set: the six files above. |
| **E2** (procedure) | the build log from the Verification procedure step 2 | route lines are exactly `/`, `/_not-found`, `/admin`, `/api/stock`, `/shared/[token]`. |

## Verification procedure

Graded end to end on **one tree**: the Execution head (commit C5 below) plus
the Verification freeze commit V0 that adds the four new test files. Before
grading, `git status --porcelain -- . ':!.loopzai'` must be empty and
`git diff --name-only 8868bce HEAD -- tests/` must list only
`tests/watchlist-csv-*.spec.ts`.

0. **Prerequisites (read back, do not fix here — spec "Human actions"):**
   `.loopzai/verification-gates.json` still names `npx tsc --noEmit`,
   `npm run build`, `npm test` (reconciled; no change needed);
   `.env.local` has `CONVEX_DEPLOYMENT=dev:combative-minnow-928` (not
   `frugal-anaconda-225`); `npx convex env get E2E_TEST_SECRET` prints
   `loopzai-e2e-dev-secret`; `node_modules/@playwright/test`,
   `node_modules/next` present; outbound HTTPS to
   `query1.finance.yahoo.com` answers (needed only by the prior-cycle live
   rows `T-A*`, `AF-API-*`); `ss -ltnp | grep ':3000'` is empty or is
   `next dev` from the current tree with `NEXT_PUBLIC_E2E_TEST_MODE=1`.
   Run everything with `env -u NODE_ENV`; `LOOPZAI_CYCLE` unset for every
   run.
1. **Typecheck (criterion 23a):** `env -u NODE_ENV npx tsc --noEmit` →
   exit 0 (covers the codec, the planner, the modal, the panel, the page
   and the four new test files).
2. **Build (criterion 23b, E2):** stop any dev server (`next build` and
   `next dev` share `.next/`), then `env -u NODE_ENV npm run build 2>&1 |
   tee /tmp/cycle3-a<N>-build.log` → exit 0; copy the route block into
   `verification.md` and compare with the E2 set.
3. **Full suite (criteria 1–22, 24, 25):** `env -u NODE_ENV -u
   LOOPZAI_CYCLE npm test 2>&1 | tee /tmp/cycle3-a<N>-suite.log` —
   Playwright starts the test-mode dev server itself. Never set
   `LOOPZAI_CYCLE=3` (cycle3-scoped's fence forbids `lib/`). Expected
   reporter summary: `92 + <new durable rows> passed`, `4 skipped`
   (cycle3-scoped V1, V2; sector-summary SS-V-E1; and this cycle's gated
   E1), `0 failed`, `0 flaky`. Files run alphabetically: `api`,
   `autofill-*`, `cycle2-*`, `cycle3-*`, `sector-summary-*`,
   `watchlist-csv-*`. Budget ≈ 2 min for the existing rows + ≈ 3–4 min for
   the new rows (five resets, three ≥ 7 s stale waits, one 10 s idle) + up
   to 2 min warm-up; live flake waits (3 × 30 s) on `T-A` / `AF-API` rows
   are the only variable. Criterion 22 is satisfied when every previously
   green row is still green and the three prior-cycle gated rows report
   skipped.
4. **Cycle-scoped evidence (E1):** `LOOPZAI_EVIDENCE=watchlist-csv env -u
   NODE_ENV npx playwright test tests/watchlist-csv-scoped.spec.ts` → 1
   passed; paste the `E1 CHANGED` line. Confirm independently: `git diff
   --name-only 8868bce HEAD -- convex/ app/api/ app/shared/ app/admin/
   package.json package-lock.json playwright.config.ts` is empty and `git
   diff --name-only 8868bce HEAD -- tests/ | grep -v '^tests/watchlist-csv-'`
   is empty.
5. **Frozen-file audit (criterion 22):** `git diff --stat V0 HEAD -- tests/`
   is empty at grading time; every prior-cycle file under `tests/` is
   byte-identical to its last frozen commit (`api`, `cycle2-api`,
   `cycle2-e2e`, `cycle2-functions`, `cycle2-static`, `cycle3-static`,
   `global-setup` `f9e2ee6`; `autofill-api` `07fbe25`; `autofill-e2e` /
   `autofill-static` `8c2c845`; `cycle3-e2e` `5fc93b1`; `cycle3-scoped`
   `5ab1cc4`; `sector-summary-unit` / `-e2e` / `-static` / `-scoped`
   `a00a601`).
6. **Independent spot checks (not machine-scored, cheap):** with the dev
   server up and a signed-in browser, open Manage Stocks — the toolbar
   shows `Export CSV` / `Import CSV` under the heading; Export saves a
   file that opens in a spreadsheet with three columns; choosing an
   exported file shows `Add 0 · Skip N · Reject 0` and only Cancel;
   `xxd sector-watchlist.csv | head -1` starts `7469 636b` (no BOM);
   `grep -c "manage-stocks-import-panel" components/*.tsx` = 1;
   `grep -cE "'use client'|from 'react'|from 'convex" lib/watchlistCsv.ts lib/watchlistImport.ts` = 0.
7. **Verdict:** PASS only when steps 1–5 are all green. A red row is
   classified before any retry: a product defect → rework of the Execution
   files (never a test edit); a defect in a frozen row → the amendment
   path in "Frozen-row repair mechanics" (never a silent edit); a
   live-Yahoo failure the in-row flake rule already retried 3× →
   environmental, retry the whole attempt; a timing miss in rows 12, 17,
   18 → first check the stub delay actually held (≥ 5 s) and the wait was
   measured from the file choice, then classify. Up to three attempts
   (`verification.maxAttempts`), ≈ 7–10 min each. Playwright `retries`
   stays 0.

## Git sequencing

Base: `8868bcedbb6534c6bbe4ae81d2f09e016cfbf2a1` (planning dispatch base)
on `main`. Commit subjects follow the repository's existing pattern
(`loopzai cycle 2 M1: …`, `loopzai cycle 2 V0: …`). Every commit must
typecheck on its own (`npx tsc --noEmit`), touch no file under `tests/`,
`convex/`, `app/api/`, `app/shared/`, `app/admin/`, no `package*.json` and
no `playwright.config.ts`.

| # | Commit subject | Carries | Milestone |
|---|---|---|---|
| **C1** | `loopzai cycle 3 M1: lib/watchlistCsv.ts — pure serializeWatchlist / parseWatchlistCsv (RFC-4180 subset, LF, minimal quoting; BOM, CRLF, quoted CR/LF, blank lines, case-insensitive headers, file-level errors)` | `lib/watchlistCsv.ts`, `.loopzai/execution-log.md` (entry-0001) | M1 |
| **C2** | `loopzai cycle 3 M2: Manage Stocks toolbar — Export CSV downloads sector-watchlist.csv from the loaded stocks (no request, no write); Import CSV button + hidden file input` | `components/ManageStocksModal.tsx`, `.loopzai/execution-log.md` (entry-0002) | M2 (the Import control is wired to nothing until C4 — it may be rendered disabled or omitted in C2; **plan choice**) |
| **C3** | `loopzai cycle 3 M3: lib/watchlistImport.ts — planImport (ticker → watchlist → claim → tags, first eligible occurrence wins), resolveNames (4 in flight, ticker fallback), D16 string helpers` | `lib/watchlistImport.ts`, `.loopzai/execution-log.md` (entry-0003) | M3 |
| **C4** | `loopzai cycle 3 M4: Import CSV — file picker → identified preview run (stale lookups dropped) → confirm → sequential stocks.add with dismissal locked → report; quote fetch per added ticker` | `components/ImportCsvPanel.tsx`, `components/ManageStocksModal.tsx`, `app/page.tsx`, `.loopzai/execution-log.md` (entry-0004) | M4 |
| **C5** | `loopzai cycle 3 M5: README export/import sentence; tsc 0, build 0 (route set unchanged), existing Playwright suite green (92 passed / 3 skipped)` | `README.md`, `.loopzai/execution-log.md` (entry-0005, recording the three results) | M5 (Execution's part) |
| **V0** | `loopzai cycle 3 V0: freeze verification tests (watchlist-csv-unit, -e2e, -static, -scoped)` | the four new files under `tests/` only | M5 (frozen rows) |
| **V1…** | `loopzai cycle 3 V<N>: verification attempt N — PASS/FAIL (…)` | `.loopzai/verification.md` only | — |

C1 and C3 are dead code until C2 / C4 and that is fine (they typecheck and
change no behaviour). C1+C3 or C2+C4 may be squashed if Execution prefers
fewer product commits; C5 stays separate so the README-only change is
revertable on its own. Coordinator-owned commits (plan promotion,
milestone status, interventions) interleave and are not Execution's. No
tags, no branches, no force-pushes; Execution and Verification never
commit `.loopzai/state.json`.

## Deploy, restart and rollback

No schema change, migration, environment variable, Convex function change,
route change or production restart is involved (Architectural constraints:
"Nothing on the server changes"). Runtime handoffs, how each is read back,
and how each is reversed:

1. **Test-mode dev server on :3000 (Verification; Feasibility census
   `runtimeHandoffs`).** Started by Playwright's `webServer` (`npm run dev`
   with `NEXT_PUBLIC_E2E_TEST_MODE=1`) when nothing listens; an existing
   server is reused, so restart it after any `npm run build` (shared
   `.next/`) and whenever the tree changes between attempts:
   `kill <pid>`; `env -u NODE_ENV NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev`.
   Read-back: `curl -s http://localhost:3000/ | grep -c test-signin` ≥ 1;
   a signed-in board's Manage Stocks modal shows
   `document.querySelectorAll('[data-testid="manage-stocks-export"]').length === 1`.
   Reverse: stop it; `ss -ltnp | grep ':3000'` empty. `.next/` is
   gitignored; `rm -rf .next` is a safe reset if the server serves stale
   chunks.
2. **Convex dev deployment (`combative-minnow-928`).** Unchanged by this
   cycle; reachable with `E2E_TEST_SECRET` set (README "One-time
   dev-deployment preparation"). Nothing to deploy, nothing to reverse.
   Verification's rows reset it (`testing.reset`) as every prior cycle
   did. If `npx convex dev --once` is run to confirm reachability, discard
   any rewrite of `convex/_generated/` before committing (E1).
3. **Browser downloads (Verification).** Playwright stores each download
   under its own temp dir and deletes it with the context; nothing is
   written into the repository (`test-results/` is gitignored). Reverse:
   nothing.
4. **Production (manual `publishPolicy`, after close-out, when the owner
   chooses).** Frontend only: merge/push `main` → Vercel deploys. **No**
   `npx convex deploy` (nothing under `convex/` changed) and no ordering
   constraint between frontend and backend. Read-back on
   `https://www.sectorwatchlist.com`: sign in, open Manage Stocks — the
   toolbar shows `Export CSV` / `Import CSV`; Export saves
   `sector-watchlist.csv`; re-importing it previews `Add 0 · Skip N ·
   Reject 0`; the shared page and `/admin` show no `manage-stocks-*`
   element. Rollback: `git revert <C5> <C4> <C3> <C2> <C1>` (reverse
   order, or one `git revert --no-commit C1^..C5` + commit) and push →
   Vercel redeploys; the modal returns to heading + list. Rows added by an
   import are ordinary `stocks` rows written through `stocks.add` — a code
   rollback does not and need not remove them; the owner deletes any
   unwanted row through Manage Stocks exactly as for a row added by the
   form. Export never wrote anything.

## Frozen-row repair mechanics

- **Licensed amendments: none.** The specification's Feasibility census
  states `preApprovalFrozenTestAuthorities: []` and "no
  `AUTHORIZE_TEST_AMENDMENT` is needed — this cycle reddens no frozen row".
  This plan therefore names no repair, **never creates or amends a
  frozen-test authority**, and neither Execution nor Verification may edit
  any file under `tests/` from a previous cycle, nor the new
  `watchlist-csv-*` files once V0 freezes them.
- **If a frozen row nonetheless reddens**, the only path is the harness's
  own: Verification reports the red row with evidence in
  `.loopzai/verification.md`; a human decides `AUTHORIZE_TEST_AMENDMENT`
  through the coordinator; the coordinator records it in
  `.loopzai/test-amendments.jsonl` and projects it into
  `.loopzai/spec-amendments.md` as an
  `## Amendment — frozen test <file>: <row> … (cycle 3, <timestamp>)` block
  carrying `<!-- loopzai-amendment kind="test" cycle="3" target-test="…" target-cycle="<origin cycle>" -->`,
  **Target test**, **Target cycle**, **Discovered in cycle**, **Evidence**
  and **Reason (human)**; a repair worker then edits only the named lines
  of the named row (precedents: `5fc93b1`, `5ab1cc4`, `07fbe25`), commits
  as `loopzai: cycle 3 — <row> test-harness repair: <what> (authorized amendment)`,
  and logs an execution-log entry naming the commit. A product-behaviour
  disagreement with a frozen row is never repaired in the test; it is a
  product defect (rework) or, if the row and the specification truly
  conflict, a return to Specification — the spec itself says a D15
  violation "returns the cycle here to declare authorities".
- **Rows this cycle could plausibly disturb, and the product-side answer
  the plan prefers over any amendment** (Execution should verify each
  before C5):
  - `cycle3-e2e` T-E2 (exactly one `h1`–`h3` in the modal reading `Manage
    Stocks`; modal text never contains `Add stock`; no `add-stock-button`
    inside; `No stocks yet.` on empty): the toolbar and panel use no
    heading element, the D16 strings never spell `Add stock`, and the empty
    state `<p>` is rendered whenever no panel is showing.
  - `cycle3-e2e` T-E3 (no `stock-price` / `stock-change` inside the modal;
    one Edit / Delete per row; `manage-stocks-tag` texts per row): the
    panel renders none of those ids; the list markup is untouched.
  - `cycle3-e2e` T-E8 (30-row list scrolls inside the panel, `window.scrollY`
    stays 0, the modal box stays inside the viewport): the toolbar is a
    fixed-height row above the same `min-h-0 flex-1 overflow-y-auto`
    container; `max-h-[80vh]` is unchanged.
  - `cycle3-e2e` T-E6a–f and `cycle3-scoped` V2 (Escape / backdrop
    semantics): the only change to the page-level Escape handler is the
    `!importing` guard on the final branch; with no import in progress
    behaviour is identical; no Escape handling is added elsewhere.
  - `cycle3-e2e` T-E9 (no `manage-stocks-*` id on the shared page, the
    wall or `/admin`): the modal is still mounted only by `app/page.tsx`
    for whitelisted owners.
  - `sector-summary-e2e` / `cycle2-e2e` request accounting (+4 on refresh,
    30 s idle, zero on filter toggles): none of these rows opens Manage
    Stocks or chooses a file, and the toolbar issues no request on render.
  - `cycle2-static` T-S1(b)/(c), T-S2: the new files mention neither
    `test-signin-`, the secret literal, nor `tickerWatchlist`.
  - `autofill-static` AF-STATIC-23, `cycle3-static` T-S1, `sector-summary-static`
    SS-S-14 (README literals): the new sentence is additive.
  - `sector-summary-static` SS-S-13a/b: `lib/sectorSummary.ts` and
    `components/SectorCard.tsx` are not touched.
  - `api.spec.ts` / `cycle2-api` / `autofill-api`: `/api/stock` is not
    touched; the import's lookups go through the same route unchanged.
  - `cycle3-scoped` V1/V2 and `sector-summary-scoped` SS-V-E1 must stay
    **skipped** — the durable run never sets `LOOPZAI_CYCLE`, and this
    cycle's E1 run sets `LOOPZAI_EVIDENCE`, never `LOOPZAI_CYCLE`.
