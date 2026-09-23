<!-- spec.md — Cycle 3 specification. Human contract; frozen on APPROVE_SPEC. -->

# Cycle 3 Specification — Sector Watchlist: CSV export / import of the watchlist

## Goal

The watchlist becomes portable. Inside the existing **Manage Stocks** modal —
already "the one place to maintain entries" — an **Export CSV** button
downloads the owner's stocks as a three-column `ticker,name,tags` file, and an
**Import CSV** button reads such a file back in: parse, validate, skip what is
already present, look up any blank company names, show a per-row **preview**,
and only on explicit confirmation write the new rows through the existing
`stocks.add` mutation. Export → import round-trips losslessly, and importing
the same file twice is a no-op, so the pair works as a backup/restore loop and
as bulk setup for a new account. Nothing changes on the server: no schema,
Convex function, route, dependency or auth change. This is for the one owner
maintaining his private watchlist (and anyone he invites who does the same);
the read-only shared page is untouched.

## Behaviour changes

- The Manage Stocks modal gains a toolbar row under its heading with two
  buttons, **Export CSV** and **Import CSV**; nothing is added to the page
  header, the cards, the shared page or `/admin`.
- **Export CSV** downloads `sector-watchlist.csv` immediately, built in the
  browser from the stocks already on the page: header `ticker,name,tags`, one
  row per stock sorted by upper-cased ticker (the modal's own order), tags
  joined with `,` inside one CSV field, UTF-8, LF line endings, trailing
  newline, no BOM, RFC-4180 quoting only where needed (a field holding `,`,
  `"`, CR or LF is quoted, with `"` doubled and CR / LF kept verbatim). An
  empty watchlist exports the header line alone. No request and no write
  results.
- **Import CSV** opens the file picker (`.csv`); choosing a file replaces the
  modal's list area with an import panel and, without writing anything,
  shows a **preview**: a summary `Add N · Skip M · Reject K` and one line per
  data row (numbered from 1) with its ticker, its outcome and, where
  relevant, the reason and the name that will be stored.
- Import accepts what Excel, Numbers and a text editor produce: a leading
  UTF-8 BOM, CRLF or LF row endings, quoted fields with `""` escapes, CR, LF
  or CRLF **inside** a quoted field (kept verbatim as part of the value, so
  an exported name containing a newline imports unchanged), blank lines,
  header names in any case with surrounding spaces, unknown extra columns
  (ignored), short rows (missing fields read as blank). Only the `ticker`
  column is required; a missing `name` or `tags` column reads as blank for
  every row.
- A missing `tags` column (or a blank `tags` field) means the row has **no
  tags**, and the existing validation then rejects it with `At least one tag
  is required.` — structurally the column is optional, but every row still
  needs at least one tag to be added. There is no default or implicit import
  tag.
- A file that cannot be read at all — empty, no `ticker` column, or an
  unterminated quoted field (a `"`-opened field that never closes, even one
  that runs across line breaks to the end of the file) — shows one
  file-level error in the panel (`The file is empty.`, `Missing required
  column: ticker.`, `Could not parse the CSV: unterminated quoted field.`)
  and no preview.
- Per-row outcomes: **skipped** when the upper-cased ticker already exists in
  the watchlist (`already in the watchlist`) or has already been **claimed by
  an earlier row of the same file that is headed for `added`** (`duplicate
  of row N`, N = the claiming row); **rejected** when the ticker or tags fail
  the same validation the Add form applies, with the validator's own message
  (`Ticker is required: 1–10 characters, letters/digits/. ^ - only.`,
  `At least one tag is required.`); otherwise **added**. A blank name never
  rejects a row. **First eligible occurrence wins:** only a row headed for
  `added` claims its ticker for the rest of the file; a rejected earlier row
  reserves nothing, so a later valid row with the same ticker is `added`
  normally. Outcomes are decided at preview and do not shift afterwards — a
  row that later `fails` at apply does not promote a `skipped` duplicate.
- For rows headed for **added** whose name is blank, the preview looks the
  company name up through the existing `/api/stock` lookup used by the Add
  form (long name → short name; `BRK.B` retried as `BRK-B`), at most four in
  flight, once per distinct ticker. A hit becomes the stored name; a miss
  stores the ticker as the name and the preview line says
  `name = ticker (lookup found nothing)`. A non-blank name is stored as
  typed (trimmed), never overwritten. Skipped and rejected rows trigger no
  lookup. While lookups are running the panel says `Looking up N names…`
  (`Looking up 1 name…`) and the confirm button is not yet offered.
- **Every chosen file starts its own preview run, and only the current run
  may touch the panel.** Cancel, dismissing the modal (✕, Escape, backdrop)
  or choosing another file invalidates the run in progress. A lookup result
  that arrives after its run was invalidated is ignored: it does not
  re-open or re-populate the panel, does not change the newer preview's
  summary, rows or names, does not enable the confirm button, and writes
  nothing. Preview remains write-free in every case.
- **Import CSV** stays available while a preview or report is showing (not
  while writing); choosing another file discards the current panel and
  starts a fresh preview for the new file.
- The preview offers **Cancel** and, when N > 0, **Import N stocks**
  (`Import 1 stock`). Cancel discards the preview, writes nothing and returns
  to the list. With N = 0 only Cancel is offered.
- Confirming writes the added rows one at a time in file order through
  `stocks.add`; the panel shows `Importing i of N…` and, while writing, the
  modal cannot be dismissed (✕, backdrop and Escape are inert). A row the
  server refuses at that moment (for example the ticker was added from
  another tab after the preview) is reported as **failed** with the server's
  message; the remaining rows still apply; nothing already written is undone.
- When writing finishes the panel shows the report `Added N · Skipped M ·
  Rejected K`, with ` · Failed F` appended only when F > 0, the same per-row
  lines with final outcomes, and a **Done** button that returns to the list.
  The list, the cards and the empty state update live as rows land, exactly
  as they do after Add.
- Each ticker added by an import gets one quote fetch on completion, as a
  stock added through the form does today; nothing is fetched for skipped,
  rejected or failed rows.
- Escape or a backdrop click while a preview or report is showing — including
  while name lookups are still running, but not while writing — closes the
  modal and discards the panel; nothing not yet confirmed is written, and
  reopening the modal shows the list, not the panel.
- Nothing else changes: the modal's heading, rows, Edit / Delete, empty-state
  text and scrolling; the page header buttons; `/api/stock`; the tag filter
  and `?tags=`; the share flow and shared page; the Add / Edit form; admin;
  schema; dependencies.

## Decisions

- **D1 — Both controls live in the Manage Stocks modal.** Rejected: the page
  header, already five buttons wide.
- **D2 — Export is built in the browser from the loaded stocks and
  downloaded as `sector-watchlist.csv`.** Rejected: a server route or Convex
  action, which would be new surface for a file the page can already write.
- **D3 — Export bytes: `ticker,name,tags` header, ticker-sorted rows, LF,
  trailing newline, no BOM, quote only when a field holds `,`, `"`, CR or
  LF.** Rejected: CRLF + BOM for Excel (Excel reads LF/no-BOM ASCII fine, and
  import strips both anyway; LF keeps the file diff- and git-friendly) and
  always-quoting every field (noisier, no gain).
- **D4 — Tags are comma-joined inside one quoted CSV field**
  (`"Tech,AI Infra"`). This is lossless only because a tag can never contain
  a comma (both validators reject one). Rejected: `;` or `|` delimiters (a
  tag may legally contain either) and a JSON array in the cell (unreadable
  in a spreadsheet).
- **D5 — A hand-rolled RFC-4180 subset parser and serializer in `lib/`, pure
  and importable outside React; the parser honours CR, LF and CRLF inside a
  quoted field as data, so everything the serializer quotes parses back
  byte-identical.** Rejected: a CSV dependency for ~100 lines of code, and a
  line-splitting parser (would break every quoted field the serializer
  legitimately emits with an embedded newline, contradicting the round-trip
  promise).
- **D6 — Only `ticker` is a required column; `name` and `tags` may be
  absent. A missing `tags` column is blank tags, and blank tags are rejected
  by the existing `At least one tag is required.` rule — no default tag is
  invented.** Rejected: requiring all three columns (turns a quick
  ticker-only list into a file-level error instead of a useful per-row
  preview) and an implicit import tag such as `Imported` (silently invents
  data the file never carried; a future cycle may revisit).
- **D7 — Merge is skip-if-exists on the upper-cased ticker: against the
  watchlist, and within the file against the earlier row that is headed for
  `added` (first eligible occurrence wins).** A rejected row never reserves
  its ticker. Re-importing an export is a no-op. Rejected: error on duplicate
  (breaks restore), replace / wipe-and-restore (a different product;
  deferred), and "first occurrence wins regardless of outcome" (a rejected
  row would shadow a later valid one, so a file with one bad line and one
  corrected line would import nothing).
- **D8 — Check order per row: ticker validity → already in the watchlist →
  claimed by an earlier `added` row → tags; a blank name is never a reason
  to reject.** Consequences: a malformed ticker is `rejected` even if it
  would also be a duplicate; a duplicate (of the watchlist or of an earlier
  `added` row) with bad tags is `skipped`, not `rejected`; a row whose only
  earlier twin was `rejected` is judged on its own tags and is `added` when
  they pass. Rejected: reporting every problem on a row (more text, no
  better decision).
- **D9 — Blank names are looked up at preview time, only for rows headed for
  `added`, through the existing `fetchCompanyName` helper, four at a time,
  once per distinct ticker; a miss falls back to the ticker.** Rejected:
  looking every row up (wasteful when the file carries names), rejecting on
  a miss (blocks valid tickers Yahoo has no long name for), and an unbounded
  `Promise.all`.
- **D10 — Preview, then explicit confirm; the preview writes nothing.**
  Rejected: apply-then-undo (heavier, and undo of a partial write is
  ambiguous).
- **D11 — Apply is sequential (one `stocks.add` at a time, file order) and
  partial: a server refusal marks that row `failed` and the rest continue.**
  Rejected: parallel writes (the server's duplicate check could pass two
  copies), all-or-nothing (one bad row blocks the file), and a new bulk
  mutation (new server surface; the loop reuses F4 validation and whitelist
  gating as-is).
- **D12 — Added tickers get one quote fetch each after apply, like Add
  stock.** Rejected: leaving them at `—` until the next manual Refresh.
- **D13 — Import control is a button plus a hidden `<input type="file">`
  accepting `.csv,text/csv`; the same file can be chosen twice in a row, and
  the control stays usable while a preview or report is showing.** Rejected:
  a drop zone (more code, harder to drive).
- **D14 — The modal cannot be dismissed while rows are being written.**
  Rejected: allowing dismissal and losing the report mid-write.
- **D15 — The import panel adds no `h1`–`h3` to the modal, never contains
  the text `Add stock`, and reuses no existing test id (`add-stock-button`,
  `stock-price`, `stock-change`, `stock-row`, `manage-stocks-row`, `-edit`,
  `-delete`, `-empty`).** New tooling hooks are `manage-stocks-export`,
  `manage-stocks-import`, `manage-stocks-import-file`, and inside the panel
  `manage-stocks-import-panel` (`data-phase` = `preview` / `applying` /
  `report`), `manage-stocks-import-error`, `manage-stocks-import-summary`,
  `manage-stocks-import-row` (`data-row`, `data-ticker`, `data-outcome` =
  `added` / `skipped` / `rejected` / `failed`), `manage-stocks-import-confirm`,
  `manage-stocks-import-cancel`, `manage-stocks-import-done`. Rejected:
  borrowing row ids, which reddens frozen Manage Stocks rows.
- **D16 — Exact strings are fixed here** (button labels `Export CSV` /
  `Import CSV`, the three file-level errors, the two skip reasons, the
  fallback note, `Looking up N names…` / `Looking up 1 name…`, `Add N · Skip
  M · Reject K`, `Added N · Skipped M · Rejected K[ · Failed F]`, `Import N
  stocks` / `Import 1 stock`, `Cancel`, `Done`). Rejected: leaving wording to
  Execution, which makes the criteria below unverifiable.
- **D17 — Each preview run has an identity, and only the current run may
  update the panel; Cancel, modal dismissal or a replacement file invalidates
  the run, and late `/api/stock` results from an invalidated run are
  dropped.** The behaviour is frozen, not the mechanism. Rejected: blocking
  Cancel / Escape until every lookup has returned (holds the user hostage to
  a slow quote backend) and letting late results land wherever they fall
  (a cancelled preview could resurrect, or an old file's names could
  overwrite a newer file's rows and enable a confirm the user never saw).

## Scope boundary

Explicitly NOT this cycle:

- **Replace / wipe-and-restore import**, "delete all", or any deletion via
  import. Named in ideation and deferred to a future cycle.
- **Updating existing rows from a file** (a matching ticker is skipped, never
  edited — its name and tags are left alone).
- **Undo** of an applied import.
- **A default or implicit tag for rows that carry none** — such rows are
  rejected (D6); a future cycle may decide otherwise.
- **Any other format** — XLSX, JSON, TSV, `;`-delimited CSV, delimiter
  auto-detection — and any column beyond `ticker,name,tags` (no prices,
  quotes or summaries in the export).
- **Export or import on the shared page, `/admin` or the page header.**
- **A row cap or size limit**; a very large file simply takes longer (see
  Architectural constraints).
- **Sort controls, search / quick-filter, remembering the last filter,
  positions / P&L** — the other ideation candidates.
- **Any change to `/api/stock`**, `convex/*`, the schema, dependencies, auth,
  the whitelist, the share flow, the tag filter, `?tags=`, row rendering,
  the sector-header summary, or the Add / Edit form.
- **Modifying any file under `tests/` from a previous cycle**, and
  re-arming `tests/cycle3-scoped.spec.ts` under `LOOPZAI_CYCLE=3` (its diff
  fence forbids `lib/`, which this cycle legitimately touches).

## Human actions required

- **Before approval:** no `AUTHORIZE_TEST_AMENDMENT` is needed — this cycle
  reddens no frozen row (census below). Choices worth a deliberate yes or
  veto here rather than later: **D3** (LF, no BOM), **D6** (`name`/`tags`
  columns optional, no default tag), **D7** (first eligible occurrence wins
  within a file), **D9** (ticker-as-name fallback on a lookup miss), **D12**
  (quote fetch after import), **D16** (the fixed wording), **D17** (stale
  lookup results are dropped rather than Cancel being blocked).
- **During Implementation Planning (informational):** the console is
  expected to show the planning sub-dispatch as the active worker and keep
  **Start Execution** disabled; if pressed it should refuse. That is the
  guard repair working, not a defect in this cycle.
- **Before Verification runs (project owner):** the same prerequisites as
  Cycles 1–2 (README "One-time dev-deployment preparation"): `.env.local`
  pointing at the **dev** Convex deployment (never `frugal-anaconda-225`),
  `E2E_TEST_SECRET` set on that deployment, `node_modules` present, outbound
  access to `query1.finance.yahoo.com` for the prior-cycle live-API rows.
  `.loopzai/verification-gates.json` is already reconciled (`tsc` / `build`
  / `npm test`); no gate change is needed. `LOOPZAI_CYCLE` must be unset (or
  anything but `3`) for every run.
- **After the cycle closes:** production deployment is manual
  (`publishPolicy: manual`); deploy when you choose. No migration, no
  environment variable, no Convex redeploy (no server file changes), no
  restart.

## Success criteria

Fixture for the browser criteria: the owner's watchlist holds exactly `AAPL`
"Apple" [`Tech`] and `MSFT` "Microsoft" [`Tech`, `Cloud`]; `/api/stock` is
stubbed so that `NVDA` answers 200 with `name` `NVIDIA Corporation`, `NONAME`
answers 200 with `name: null`, and every other ticker answers 404. Where a
criterion says a lookup is **delayed**, the stub holds that ticker's response
for at least five seconds before answering as above. "File A" is this text:

```text
ticker,name,tags
aapl,Apple Inc.,Tech
NVDA,,"Chips,Tech"
GOOG,Alphabet,
BAD TICKER,Bad,Tech
NVDA,NVIDIA dup,Chips
NONAME,,Misc
```

1. With the fixture watchlist, clicking **Export CSV** produces a download
   named `sector-watchlist.csv` whose bytes are exactly
   `ticker,name,tags\nAAPL,Apple,Tech\nMSFT,Microsoft,"Tech,Cloud"\n` (no
   BOM, no CR); the click issues no `/api/stock` request and `stocks.list`
   is unchanged. On an empty watchlist the bytes are exactly
   `ticker,name,tags\n`.
2. `serializeWatchlist` on `[{ticker:'ZZ', name:'Foo, Inc.', tags:['A']},
   {ticker:'AB', name:'Say "hi"', tags:['X','Y Z']}]` returns
   `ticker,name,tags\nAB,"Say ""hi""","X,Y Z"\nZZ,"Foo, Inc.",A\n`.
3. `parseWatchlistCsv` on `﻿TICKER, Name ,tags,extra\r\nAAPL,Apple
   Inc.,"Tech,AI Infra",ignored\r\n\r\nmsft ,,Cloud\r\nX,"Say ""hi"", Inc."\r\n`
   returns rows `{ticker:'AAPL', name:'Apple Inc.', tags:['Tech','AI Infra']}`,
   `{ticker:'msft', name:'', tags:['Cloud']}`, `{ticker:'X', name:'Say "hi",
   Inc.', tags:[]}` and no error.
4. `parseWatchlistCsv` returns an error and no rows for: the empty string and
   whitespace-only text (`The file is empty.`); `symbol,name,tags\nAAPL,Apple,
   Tech\n` (`Missing required column: ticker.`); `ticker,name,tags\nX,"open,A\n`
   and `ticker,name,tags\nX,"open\nY,Yes,B\n` (both `Could not parse the CSV:
   unterminated quoted field.` — an open quote is not closed by a line break).
   For `ticker,name,tags\n` it returns zero rows and no error.
5. Embedded newlines in a quoted field survive both directions.
   `serializeWatchlist([{ticker:'NL', name:'Line one\nLine two', tags:['A']}])`
   returns exactly `ticker,name,tags\nNL,"Line one\nLine two",A\n`, and
   `parseWatchlistCsv` of that text returns the single row `{ticker:'NL',
   name:'Line one\nLine two', tags:['A']}` and no error. Likewise
   `parseWatchlistCsv('ticker,name,tags\r\nCR,"Alpha\r\nBeta",A\r\nLF,"Gamma\rDelta",B\r\n')`
   returns `{ticker:'CR', name:'Alpha\r\nBeta', tags:['A']}` and
   `{ticker:'LF', name:'Gamma\rDelta', tags:['B']}` — the CRLF and lone CR
   inside the quotes are kept verbatim while the CRLF row endings are
   consumed as row boundaries.
6. Round trip: for any list of valid stocks,
   `parseWatchlistCsv(serializeWatchlist(stocks))` yields the same
   `(ticker, name, tags)` triples in ticker order — in particular for names
   containing `,`, `"`, CR and LF, and for multi-tag rows.
7. Choosing File A in the import panel shows, before anything is written,
   the summary exactly `Add 2 · Skip 2 · Reject 2` and six rows in file
   order: row 1 `AAPL` `skipped` `already in the watchlist`; row 2 `NVDA`
   `added` showing the name `NVIDIA Corporation`; row 3 `GOOG` `rejected`
   `At least one tag is required.`; row 4 `BAD TICKER` `rejected`
   `Ticker is required: 1–10 characters, letters/digits/. ^ - only.`; row 5
   `NVDA` `skipped` `duplicate of row 2`; row 6 `NONAME` `added` showing the
   name `NONAME` and `name = ticker (lookup found nothing)`. `stocks.list`
   still returns exactly the two fixture rows.
8. During that preview exactly two `/api/stock` requests are made, one for
   `NVDA` and one for `NONAME`; none for `AAPL`, `GOOG`, `BAD TICKER` or the
   duplicate `NVDA`. The confirm button reads `Import 2 stocks`.
9. Clicking **Cancel** on that preview returns the modal to its list of two
   rows; `stocks.list` is unchanged; no request was made by the cancel.
10. Re-choosing File A and confirming: the panel reaches the report
    `Added 2 · Skipped 2 · Rejected 2` (no `Failed` segment); rows 2 and 6
    read `added`, the others keep their preview outcomes; `stocks.list`
    returns four rows with `NVDA` "NVIDIA Corporation" [`Chips`, `Tech`] and
    `NONAME` "NONAME" [`Misc`]; the modal list shows `AAPL, MSFT, NONAME, NVDA`
    in that order; sector cards `Chips` and `Misc` exist on the board; after
    a reload all of this persists. After the report appears exactly one
    further `/api/stock` request per added ticker (`NVDA`, `NONAME`) has been
    made, and none within the following 10 seconds.
11. Choosing File A again on the resulting watchlist shows `Add 0 · Skip 4 ·
    Reject 2`, no confirm button, zero `/api/stock` requests, and
    `stocks.list` is unchanged after Cancel — the import is idempotent.
12. Apply-time refusal: on the fixture watchlist choose a file
    `ticker,name,tags\nNVDA,NVIDIA,Chips\nNONAME,,Misc\n`, wait for the
    preview `Add 2 · Skip 0 · Reject 0`, then add `NVDA` from a second
    client, then confirm. The report is `Added 1 · Skipped 0 · Rejected 0 ·
    Failed 1`; row 1 reads `failed` with `NVDA is already in the watchlist.`;
    row 2 reads `added`; `stocks.list` has exactly one `NVDA` and one
    `NONAME`.
13. A file whose only valid content is the header (`ticker,name,tags\n`)
    shows `Add 0 · Skip 0 · Reject 0` and only Cancel; the unreadable inputs
    of criterion 4, saved as files, each show their file-level error text in
    the panel and no summary; `stocks.list` is unchanged in every case.
14. With the fixture watchlist plus a stock whose name is `Foo, Inc.` and
    tags [`A`, `B`], Export then Import of the downloaded file shows
    `Add 0 · Skip 3 · Reject 0`.
15. First eligible occurrence wins. On the fixture watchlist, the file
    `ticker,name,tags\nNVDA,NVIDIA,\nNVDA,NVIDIA,Chips\n` previews as
    `Add 1 · Skip 0 · Reject 1`: row 1 `NVDA` `rejected` `At least one tag
    is required.`; row 2 `NVDA` `added` showing the name `NVIDIA`; the
    confirm button reads `Import 1 stock`; zero `/api/stock` requests are
    made (the name is non-blank). Confirming yields `Added 1 · Skipped 0 ·
    Rejected 1` and `stocks.list` holds exactly one `NVDA` "NVIDIA"
    [`Chips`]. The same two rows handed to the `lib/` import planner, with a
    lookup function that is never invoked, produce the same two outcomes and
    the same claim. By contrast, `ticker,name,tags\nNVDA,NVIDIA,Chips\nNVDA,
    NVIDIA,\n` previews as `Add 1 · Skip 1 · Reject 0` with row 2 `skipped`
    `duplicate of row 1` (a duplicate of an eligible row is skipped even
    though its own tags are bad, per D8).
16. No default tag. On the fixture watchlist the file `ticker,name\nNVDA,
    NVIDIA\n` (no `tags` column at all) previews as `Add 0 · Skip 0 ·
    Reject 1` with row 1 `NVDA` `rejected` `At least one tag is required.`,
    only Cancel is offered, no `/api/stock` request is made and
    `stocks.list` is unchanged; `parseWatchlistCsv` of that text returns
    `{ticker:'NVDA', name:'NVIDIA', tags:[]}` and no error.
17. Stale lookup after Cancel or dismissal. With the `NVDA` lookup delayed,
    choose `ticker,name,tags\nNVDA,,Chips\n`; the panel shows `Looking up 1
    name…` and no confirm button. Click **Cancel** before the response
    arrives: the modal shows its two list rows and no panel. When the delayed
    response has arrived (at least six seconds after choosing the file): the
    panel has not reappeared, no `manage-stocks-import-confirm` element
    exists anywhere on the page, no `stocks.add` was called and
    `stocks.list` is unchanged. The same holds when Escape or a backdrop
    click closes the modal instead of Cancel — reopening Manage Stocks after
    the delayed response shows the list, no panel, no confirm.
18. Stale lookup after a replacement file. With the `NVDA` lookup delayed
    and `NONAME` immediate, choose File X `ticker,name,tags\nNVDA,,Chips\n`,
    and while the panel reads `Looking up 1 name…` choose File Y
    `ticker,name,tags\nNONAME,,Misc\n`. The panel shows Y's preview `Add 1 ·
    Skip 0 · Reject 0` with exactly one row, `NONAME` `added` `name = ticker
    (lookup found nothing)`, and the confirm button `Import 1 stock`. After
    X's delayed response has arrived the panel is unchanged: still one row,
    still the same summary and confirm label, and the text `NVDA` appears
    nowhere in the panel. Confirming then writes only `NONAME`; `stocks.list`
    has no `NVDA`.
19. While the import panel is open (preview or report) the modal still has
    exactly one `h1`–`h3` element, reading `Manage Stocks`; its text nowhere
    contains `Add stock`; no `add-stock-button`, `stock-price` or
    `stock-change` element is inside it; and after **Done** the list shows
    every row with exactly one Edit and one Delete each, in ticker order.
20. With the fixture watchlist and no file chosen, the modal shows the two
    rows, the `Export CSV` and `Import CSV` buttons, no import panel; with an
    empty watchlist it shows `No stocks yet.` and both buttons. On
    `/shared/<token>`, the not-invited wall and `/admin` no element whose
    test id starts with `manage-stocks-` exists.

Criteria 21–25 are **durable contracts** — promises that must stay true
after this cycle whatever later cycles legitimately add. Standing rule:
*freeze the promise, not the snapshot.*

21. **The comma-free-tag invariant holds on both sides.** `validateStock`
    with a tag `A,B` returns `Tags may not contain commas.`, and
    `stocks.add` with such a tag rejects with the same message and writes
    nothing. (D4's codec is only lossless while this is true.)
22. **Prior frozen verification remains green.** `npm test` on the dev
    deployment with `LOOPZAI_CYCLE` unset: every frozen row from a previous
    cycle that was green before this cycle is still green after it, and the
    rows fenced to another cycle (`tests/cycle3-scoped.spec.ts` V1–V2,
    `tests/sector-summary-scoped.spec.ts` SS-V-E1) still report **skipped**.
23. **The project typechecks and builds.** `npx tsc --noEmit` exits 0 and
    `npm run build` exits 0.
24. **Import writes only through `stocks.add`; export and preview write
    nothing.** No new Convex function, route, table, field, dependency or
    data source exists because of this feature; the codec and planner in
    `lib/` are importable outside React (no React, Next or Convex import, no
    `'use client'`), and the codec makes no network request.
25. `README.md` describes export / import in one or two sentences and still
    contains every literal earlier cycles pinned: `Manage Stocks`,
    `Company name`, the autofill sentence, `summary` and `mean`.

**Cycle-scoped evidence** — exact inventories proving *this cycle's* diff
stayed inside its boundary, checked once at close and never frozen as a
forever-closed set:

- **E1.** Cycle 3's product diff touches only `lib/watchlistCsv.ts` (new),
  at most one further new `lib/` module for import planning,
  `components/ManageStocksModal.tsx`, at most one new `components/` file for
  the import panel, `app/page.tsx`, `README.md`, and new test files; nothing
  under `convex/`, `app/api/`, `app/shared/`, `app/admin/`; no change to
  `package.json` dependencies or `package-lock.json`; no previously frozen
  file under `tests/` modified.
- **E2.** At Cycle 3 close `npm run build` reports the same route set as
  today (`/`, `/_not-found`, `/admin`, `/api/stock`, `/shared/[token]`).

## Architectural constraints

- **The tag codec depends on a validation rule (D4).** Both validators
  reject a comma inside a tag; if a future cycle relaxes that, every export
  with such a tag silently splits it on import. That future cycle must
  change the codec in the same change. Criterion 21 pins the invariant.
- **The parser is a state machine over characters, not a line splitter
  (D5).** A row boundary is a CR, LF or CRLF *outside* quotes only; inside
  quotes those bytes are data. Anything that later reads this CSV with a
  naive split-on-newline (a script, a future feature) will mis-read a name
  containing a newline — the same rule Excel and every RFC-4180 reader
  already follow. An unterminated quote therefore swallows the rest of the
  file and is a file-level error, never a partial preview.
- **Nothing on the server changes.** Every import write is an ordinary
  `stocks.add`: whitelist gating, ownership and F4 validation apply row by
  row, so an unauthorised or malformed row fails on the server exactly as a
  form submission would. Rollback is a revert of client files and a README
  line — no migration, no Convex redeploy, no ordering.
- **Import is partial by design (D11).** An interrupted import (tab closed,
  network drop mid-write) leaves the rows already written in place; because
  merge is skip-if-exists, re-running the same file completes the job
  rather than duplicating it. There is no transaction and no undo.
- **In-file dedupe is decided by outcome, in file order (D7/D8).** A ticker
  is claimed only by the first row that ends up `added`; the claim is fixed
  at preview time and is not released if that row later `fails` at apply —
  the skipped twin stays skipped, and the user re-imports to pick it up.
  Consequence for the user: a file that lists a ticker twice with one bad
  line and one good line imports the good line, whichever comes first.
- **A large file is slow, not blocked.** Each added row is one round-trip
  mutation in sequence; a thousand-row file is a thousand mutations, on the
  order of a minute or more, with the modal locked for the duration (D14).
- **Name lookups hit `/api/stock` at preview time (D9)** — one request per
  distinct blank-name ticker headed for `added`, four in flight. On a slow
  or failing quote backend the preview waits on these; a lookup failure is
  a miss (ticker-as-name), never an error. Skipped and rejected rows cost
  nothing.
- **Lookups outlive the preview that started them (D17).** A request in
  flight is not aborted by Cancel, dismissal or a replacement file; it is
  allowed to finish and then discarded because its run is no longer
  current. The invariant that matters is that a stale result can never
  reach the panel, the confirm button or `stocks.add`: the worst a slow
  backend can do is waste a request. Preview is write-free regardless of
  timing.
- **Frozen Manage Stocks rows pin the modal's shape.** They count exactly
  one heading, forbid the text `Add stock` and the `add-stock-button` id
  inside the modal, require the 30-row list to scroll inside the panel and
  one Edit / Delete per row, and require no `manage-stocks-*` id on the
  shared page, the wall or `/admin`. D15 exists to keep those green; a
  violation returns the cycle here to declare authorities.
- **`tests/cycle3-scoped.spec.ts` (an earlier cycle's rows, gated on
  `LOOPZAI_CYCLE=3`) must stay un-armed.** This cycle is also numbered 3;
  arming it would fail on its stale diff fence (which forbids `lib/`)
  regardless of this cycle's correctness. Any cycle-scoped evidence this
  cycle adds must gate on something other than `LOOPZAI_CYCLE=3`.
- **The `lib/` modules must be importable outside React** (no `'use
  client'`, no React / Next / Convex import) so the codec and planner can be
  exercised directly; the planner's lookup is a plain function it is handed,
  so the planner itself never touches the network.
- **Exported names and tags are the stored values verbatim**; a name
  containing `,`, `"`, CR or LF is quoted and escaped, never altered.
  Tickers are stored upper-cased already, so export never changes case.

## Cost / time

- **Effort:** medium — the largest cycle so far. New `lib/watchlistCsv.ts`
  (≈ 130 lines: character-level parser + serializer), a new planning module
  in `lib/` (≈ 100 lines: validate, first-eligible dedupe, bounded lookup),
  the import panel (≈ 220 lines, in or beside `ManageStocksModal.tsx`,
  including the run-identity guard), `app/page.tsx` wiring (≈ 40 lines:
  writes, quote fetch, dismissal lock), one or two README sentences.
  Execution: about 2–4 hours wall clock (Cycle 2 took ≈ 40 minutes for a
  fifth of this surface; Cycle 1 ≈ 2 hours of active work). Verification:
  rows derived from criteria 1–25 (direct codec/planner calls plus browser
  rows using a real download, a real file chooser and a delayed lookup
  stub); the suite grows from 95 to roughly 130 rows, ≈ 5–7 minutes per
  attempt plus dev-server warm-up; two attempts expected, three allowed.
- **Expected spend: $30** (range $18–45). Execution ≈ $18; Verification
  ≈ $6 per attempt, two attempts expected. The breach threshold is therefore
  **$45**. Calibration: Cycles 1 and 2 estimated $18 and $12 but the harness
  recorded `costUsd: 0` for both, so there is no measured anchor; this is
  Cycle 2's estimate scaled by surface (≈ 5× the lines, damped because
  per-session overhead dominates small cycles).
- **Uncertainty drivers:** (1) first use in this repo of a browser download
  and a file chooser in verification rows — a harness wrinkle costs an
  attempt, not a product fix; (2) exact-text matching of `·` and the
  preview lines under whitespace normalisation; (3) the apply-time race in
  criterion 12 and the delayed-lookup rows in criteria 17–18 are
  timing-sensitive to arrange; (4) a second execution pass if the panel
  trips a frozen Manage Stocks row (heading count, `Add stock` literal,
  in-panel scrolling) or if the lookup pool / stale-run guard needs a fix
  loop; (5) parser edge cases beyond those pinned (trailing commas, a lone
  CR as a row ending, a quote inside an unquoted field) surfacing only in
  verification.

## Feasibility census
feasibility: PASS
preApprovalFrozenTestAuthorities: []
runtimeHandoffs:
- dev server on :3000 with NEXT_PUBLIC_E2E_TEST_MODE=1 and the dev Convex deployment reachable during Verification
architecturalBlockers: none
unresolvedHumanDecisions: none
scopeExplosion: none

## Milestones

- **M1** — Pure CSV codec in `lib/watchlistCsv.ts`: `serializeWatchlist` (ticker-sorted, LF, minimal RFC-4180 quoting) and `parseWatchlistCsv` (BOM, CRLF, quotes, CR/LF/CRLF inside quoted fields, blank lines, case-insensitive headers, unknown columns, file-level errors)
- **M2** — Export CSV in Manage Stocks: client-side download of `sector-watchlist.csv` from the loaded stocks, no request, no write
- **M3** — Import planner in `lib/`: validate, skip-if-exists dedupe (watchlist, and in-file by first eligible occurrence), blank-name lookup at most four in flight with ticker fallback, per-row outcomes — exercisable without a browser
- **M4** — Import CSV in Manage Stocks: file picker → preview panel with summary and per-row lines, one identified run per chosen file with stale lookup results dropped → confirm → sequential `stocks.add` with dismissal locked → report, quote fetch for added tickers
- **M5** — Existing Playwright suite green with fenced rows skipped, `tsc` and `build` exit 0, README sentence
