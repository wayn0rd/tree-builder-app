<!-- spec.md — Cycle 1 specification (refreshed LoopzAI harness). Human contract; frozen on APPROVE_SPEC. -->

# Cycle 1 Specification — Sector Watchlist: auto-fill Company name from the ticker

## Goal

In the **Add stock** form, when the user types a ticker and leaves the ticker
field, the app looks the ticker up and fills the **Company name** field with
the company's name (e.g. `AAPL` → "Apple Inc."). The name comes from the
Yahoo Finance chart response the app already fetches through `/api/stock`,
so no new provider, key, route or schema is introduced. Manual entry stays
exactly as it is today: the name remains required on save, a value the user
typed is never overwritten, and a lookup that misses or fails changes
nothing and shows nothing. This is friction reduction for the one person
adding stocks to their private watchlist; it is additive and reversible by
revert.

## Behaviour changes

- `GET /api/stock?ticker=X` **200** responses gain one key, `name`: Yahoo's
  `meta.longName`, else `meta.shortName`, else `null`. Every existing key
  and every non-200 response (400 / 404 / 502 / 500 bodies and statuses) is
  byte-for-byte unchanged.
- In the **Add stock** form, leaving the ticker field (blur) with a
  non-blank ticker issues one lookup through `/api/stock` and, when the
  response carries a name, writes it into the Company name field — but only
  if that field is blank or still holds the untouched result of a previous
  autofill.
- Dot-class tickers: if the lookup for a ticker containing `.` (e.g.
  `BRK.B`) does not return 200, the form retries once with `.` replaced by
  `-` (`BRK-B` → "Berkshire Hathaway Inc.") and uses that result.
- A lookup miss (unknown ticker, non-200, network failure) leaves the
  Company name field exactly as it was, renders no error, and does not
  affect Save.
- A response that arrives after the ticker field has been changed to a
  different ticker is discarded.
- **Edit** mode gains no lookup: opening Edit and blurring the ticker
  issues no request and never changes the name.
- Nothing else changes: save and validation rules (`Company name is
  required.` unchanged), quote rendering (`—` on failure), the manual
  refresh (one request per distinct ticker), the shared page, auth and
  the Manage Stocks modal behave exactly as before.

## Decisions

- **D1 — Trigger is blur of the ticker field**, not keystroke debounce and
  not a button; one event covers tab-to-name and click-to-name. (Locked in
  ideation.)
- **D2 — Write rule is autofill provenance, not emptiness.** The form tracks
  "the current name is the untouched output of the last autofill" as its own
  fact; a lookup may write only when the name is blank or that fact is true.
  Any user edit of the name — even to blank-then-retyped text, even to text
  identical to what a lookup would produce — makes it human-authored for the
  life of the form. Alternative rejected: overwrite whenever the field is
  empty (would clobber a name the user cleared and retyped). (Locked.)
- **D3 — Dot-class retry lives in the form's lookup, not in the route.**
  `/api/stock?ticker=BRK.B` keeps returning its current non-200; the form
  makes a second request for `BRK-B`. Alternative rejected: retrying inside
  the route, which would silently change quote behaviour and the returned
  `ticker` for existing dot-class rows — a separate product change this cycle
  does not make. (Retry-once itself is locked; its location is this cycle's
  choice.)
- **D4 — Extend `/api/stock` with a `name` key** rather than add a lookup
  route; the key is named `name` to match the stock field. Preference is
  `longName` → `shortName` → `null` (Yahoo's `shortName` for `BRK-B` is
  "Berkshire Hathaway Inc. New"; `longName` is the clean form). Alternative
  rejected: `shortName` first. (Extend is locked; key name and preference
  order are this cycle's choice.)
- **D5 — Add only.** No lookup in Edit mode. (Locked.)
- **D6 — A miss never writes.** Consequence the approver should see: if
  `AAPL` autofilled "Apple Inc." and the user then changes the ticker to an
  unknown one and blurs, "Apple Inc." stays in the field (untouched, so a
  later successful lookup may still replace it). Alternative rejected:
  clearing a stale untouched autofill on a miss — ideation fixes that a miss
  "does exactly one thing: it does not populate the Company name field".
- **D7 — Stale-response guard compares against the ticker field's current
  value at write time**, not the value when the lookup started. (Locked.)
- **D8 — Every blur with a non-blank ticker issues a lookup**; a blur with a
  blank (empty or whitespace-only) ticker issues none. Alternative rejected:
  skipping the request when the ticker is unchanged since the last lookup —
  extra state for one spare request, and it would leave a user who cleared
  the name unable to re-trigger the fill.
- **D9 — The lookup sends the ticker trimmed and upper-cased** (the same
  normalization `validateStock` applies on save) and never rewrites the
  ticker field's text. Alternative rejected: upper-casing the field on blur —
  an unrelated change to existing form behaviour.
- **D10 — No new UI element.** No spinner, hint, toast or error; the only
  visible effect is the Company name field's value. Alternative rejected: a
  "looking up…" indicator — new surface not asked for by ideation.

## Scope boundary

Explicitly NOT this cycle:

- **Quote-side dot-class handling.** `BRK.B` rows keep showing `—` for
  price/change; only the Add-form name lookup retries with `-`. (Deferred;
  a future cycle may decide route-level normalization.)
- **Ticker autocomplete / search-as-you-type** — rejected in ideation, stays
  rejected.
- **Validating that the ticker exists on save** — rejected in ideation;
  save semantics do not change.
- **Hard-coded symbol→name table** — rejected in ideation.
- **Any portfolio / ownership / holdings framing** — out of scope by schema
  (`S1`, `N5`), not deferred.
- **Back-filling names for stocks already in the watchlist**, and any
  lookup in Edit mode.
- **Any loading / error affordance for the lookup** (D10).
- **Schema, save path, validation messages, auth, sharing, the shared
  page, Manage Stocks, styling** — untouched.
- **Repairing `.loopzai/verification-gates.json`** — a harness-configuration
  action for a human (see below), not product work in this cycle.

## Human actions required

- **Before approval:** none. This cycle reddens no frozen test row, so no
  `AUTHORIZE_TEST_AMENDMENT` is needed (census below).
- **Before Execution is dispatched (harness owner):** reconcile
  `.loopzai/verification-gates.json` with this repository. It currently
  names `scripts/harness-sanity.mjs`, `scripts/run-src-tests.mjs`,
  `tsconfig.web.json`, an `engine/` directory and a vitest run of ≥ 3105
  tests — none of which exist here (the file was copied in by
  "Refresh project onto current LoopzAI harness"). As written every gate
  fails regardless of the work. This repo's verification is
  `npx tsc --noEmit`, `npm run build`, and `npm test` (Playwright, serial).
  The Specification worker may not edit that file.
- **Before Verification runs (project owner):** confirm the existing test
  prerequisites from README "One-time dev-deployment preparation" are in
  place on the machine that runs Verification — `.env.local` pointing at
  the **dev** Convex deployment, `E2E_TEST_SECRET` set on that deployment,
  and outbound access to `query1.finance.yahoo.com` for the live API rows.
  (Both `.env.local` and `node_modules` are present on this machine today.)
- **After the cycle closes:** production deployment is manual
  (`publishPolicy: manual`); deploy when you choose. No data migration,
  no environment variable, no restart is required.

## Success criteria

Route (live Yahoo; `BASE` is the dev server):

1. `GET /api/stock?ticker=AAPL` → 200; body has `ticker`, `price`,
   `previousClose`, `changePercent`, `historicalPrice` **and** `name`;
   `name === "Apple Inc."`; `ticker === "AAPL"`.
2. `GET /api/stock?ticker=%5EGSPC` → 200 with `name === "S&P 500"`.
3. `GET /api/stock?ticker=BRK-B` → 200 with
   `name === "Berkshire Hathaway Inc."` (proves `longName` is preferred over
   `shortName`, which is "Berkshire Hathaway Inc. New").
4. When Yahoo's `meta` carries neither `longName` nor `shortName`, the 200
   body has `name === null` (key present, not absent).
5. `GET /api/stock` → 400; `GET /api/stock?ticker=ZZZZZZZZ99` → 404 or 502;
   `GET /api/stock?ticker=BRK.B` → the same non-200 status it returns before
   this cycle (currently 502, since Yahoo answers 404). All three bodies are
   `{ "error": <string> }` with no `name` key.
6. `app/api/stock/route.ts` still contains no `fs` import/usage and no
   `process.env` read.

Add-stock form (behaviour holds whether `/api/stock` is live or served by
a stub; "response carries `name: N`" means a 200 body with that key):

7. Open **Add stock**, type `AAPL` in the ticker field, move focus to the
   Company name field → exactly one request `GET /api/stock?ticker=AAPL`
   is made, and once its response carries `name: "Apple Inc."` the Company
   name field's value is `Apple Inc.`.
8. Type `aapl ` (lower-case, trailing space) and blur → the request is for
   `ticker=AAPL`; the ticker field's text is still `aapl `.
9. Blur the ticker field while it is empty or whitespace-only → zero
   `/api/stock` requests.
10. Type `BRK.B` and blur → first request `ticker=BRK.B`; if it is non-200,
    exactly one further request `ticker=BRK-B`; the name written is the
    second response's `name`. If the first request is 200 there is no
    second request. A non-dot ticker that misses issues exactly one request.
11. Blur on a ticker whose lookup returns 404, 502, a network failure, or a
    200 body with `name: null` → the Company name field's value is unchanged
    (blank stays blank; typed text stays typed), no `stock-form-error`
    element is rendered, Save is not disabled, and saving with a manually
    typed name and a tag succeeds exactly as today.
12. Company name first typed by the user as `My Co`, then `AAPL` entered and
    blurred with a response carrying `name: "Apple Inc."` → the name field
    still reads `My Co`.
13. `AAPL` blurred → `Apple Inc.`; ticker changed to `MSFT` and blurred with
    a response carrying `name: "Microsoft Corporation"` → the field reads
    `Microsoft Corporation` (an untouched autofill is replaceable).
14. After 13, the user edits the name to `MSFT Corp`; ticker changed back to
    `AAPL` and blurred → the field still reads `MSFT Corp`.
15. `AAPL` blurred → `Apple Inc.`; the user clears the field and retypes
    exactly `Apple Inc.`; ticker changed to `MSFT` and blurred → the field
    still reads `Apple Inc.` (human-authored, even though identical).
16. `AAPL` blurred → `Apple Inc.`; ticker changed to `ZZZZ` (a miss) and
    blurred → the field still reads `Apple Inc.` (D6).
17. Stale response: the `AAPL` lookup is delayed; before it responds the
    ticker is changed to `MSFT` and blurred, and the `MSFT` response arrives
    first with `name: "Microsoft Corporation"` → the field reads
    `Microsoft Corporation` and never, at any point afterwards, reads
    `Apple Inc.`. If `MSFT` is never blurred, the field stays blank.
18. Open **Edit** for an existing stock, focus the ticker field and blur
    it → zero `/api/stock` requests originate from the form and the name
    field keeps its pre-filled value.
19. Saving a stock whose name was autofilled persists that exact string
    (`stocks.list` for the user returns `name === "Apple Inc."`) through the
    unchanged `stocks.add` path; the server-side rule
    `Company name is required.` still rejects a blank name.

Regression and build:

20. `npm test` on the dev deployment: every row in `tests/api.spec.ts`,
    `tests/cycle2-*.spec.ts`, `tests/cycle3-e2e.spec.ts` and
    `tests/cycle3-static.spec.ts` passes; `tests/cycle3-scoped.spec.ts` rows
    report **skipped** (this cycle does not set `LOOPZAI_CYCLE=3`). No file
    under `tests/` from a previous cycle is modified.
21. The manual refresh still makes exactly one `/api/stock` request per
    distinct ticker and none during a 30-second idle; failed quotes still
    render `—` with `data-direction="unavailable"`.
22. `npx tsc --noEmit` exits 0 and `npm run build` exits 0.
23. `README.md` describes the autofill in one or two sentences and still
    contains the literal `Manage Stocks`.

## Architectural constraints

- `/api/stock` is public and unauthenticated by design (the anonymous shared
  page depends on it). The change is additive: every existing consumer
  (`lib/quotes.ts`, both e2e stubs, the shared page) ignores unknown keys, so
  nothing downstream breaks and nothing needs redeploying in lock-step.
- The route must stay free of `fs` and `process.env` — a frozen static row
  checks this. The lookup adds no caching (`revalidate: 0` stays), so each
  blur is one more upstream Yahoo call; at watchlist scale this is
  negligible, but it is uncached.
- The form's write rules are the risk surface. Getting provenance or the
  stale-response guard wrong silently corrupts the name the user saves; the
  criteria above pin every path so a regression is caught rather than
  discovered by a user.
- `tests/cycle3-scoped.spec.ts` V1 fences the cycle-3 diff against a stale
  base commit and lists `components/StockForm.tsx`, `app/api/`, and `lib/`
  as forbidden. It is skipped unless `LOOPZAI_CYCLE=3`, so it is not an
  authority for this cycle — but it must never be re-armed under `3` again;
  this cycle legitimately touches all three paths.
- `.loopzai/verification-gates.json` does not describe this repository (see
  Human actions). Until it is reconciled, Verification cannot pass on gates
  alone, independent of how good the work is.
- Nothing is irreversible: no schema change, no migration, no new
  environment variable. Rollback is a revert of three source files.

## Cost / time

- **Effort:** small. Roughly three source files (`app/api/stock/route.ts`
  ≈ +5 lines, `lib/quotes.ts` ≈ +30 lines, `components/StockForm.tsx`
  ≈ +40 lines), a README sentence, and new Playwright rows for the criteria
  above. Execution: about 1–2 hours wall clock. Verification: a serial
  Playwright run is 15–25 minutes per attempt (the frozen parity test alone
  waits 30 s idle and live-API rows may wait 3 × 30 s), up to three attempts.
- **Expected spend: $18** (range $10–30). Execution ≈ $10; Verification
  ≈ $4 per attempt, two attempts expected. The breach threshold is therefore
  $27.
- **Uncertainty drivers:** (1) live Yahoo flakiness triggering the 30-second
  retry rule in the API rows; (2) Next dev-server first-compile latency
  making a Playwright attempt time out; (3) the async criteria (17) needing
  a second execution pass if the first implementation writes on the
  started-with ticker instead of the current one; (4) time lost if the
  gates file is not reconciled before Verification is dispatched.

## Feasibility census
feasibility: PASS
preApprovalFrozenTestAuthorities: []
runtimeHandoffs:
- reconcile .loopzai/verification-gates.json to this repo's Playwright/tsc/build commands before Verification
- dev server on :3000 with NEXT_PUBLIC_E2E_TEST_MODE=1 and dev Convex deployment reachable during Verification
architecturalBlockers: none
unresolvedHumanDecisions: none
scopeExplosion: none

## Milestones

- **M1** — `/api/stock` 200 responses carry `name` (longName → shortName → null); every error path unchanged
- **M2** — Add-form blur lookup: normalized ticker, blank-ticker guard, dot-class retry, silent degradation, Add-only
- **M3** — Company-name write rules: autofill provenance and stale-response guard
- **M4** — Existing Playwright suite green, new rows covering the criteria, README sentence
