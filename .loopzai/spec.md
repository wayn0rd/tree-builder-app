<!-- spec.md — the frozen specification, once approved at the Specification gate. -->

# Cycle 2 Specification — Sector Watchlist goes multi-user (Convex + Google auth + share links)

**Status:** awaiting spec-approval gate.
**Input:** `.loopzai/ideation.md` (frozen, cycle 2).
**One-line summary:** Move the watchlist from localStorage to Convex,
put Google-OAuth invite-only login in front of it (admin-managed
whitelist, per-user private watchlists), and add tokenized, revocable,
no-login-required read-only share links — with Cycle-1 UI/UX preserved
unchanged for the authenticated owner view.

---

## 1. Decisions made here (open questions from ideation, now resolved)

These are commitments, not suggestions. A veto on any one can be aimed at
its number.

- **D1 — Convex is the only store; localStorage persistence is removed.**
  All watchlist data lives in Convex tables (§2). No code reads or writes
  the `tickerWatchlist.v1` localStorage key anymore; there is no dual-write
  and no migration path (ideation: the old data is lost; the seed file
  `.loopzai/watchlist-seed.md` is re-entered manually post-launch).
- **D2 — Login is the front door.** Auth is **Convex Auth with the Google
  OAuth provider** (plus the test-only provider of D10). An
  unauthenticated visitor to `/` sees only a sign-in screen — no
  watchlist UI, no data fetches of watchlist content. There is no
  anonymous/local mode. A signed-in user can sign out from the header.
- **D3 — Admin is determined by email constant, not a stored flag.** A
  frozen constant `ADMIN_EMAIL = "trixiematic415@gmail.com"` lives in the
  Convex backend code (it is not a secret). A user whose
  Google-account email equals it (case-insensitive) is admin from their
  first login onward — no promotion step, no bootstrap chicken-and-egg —
  and is **implicitly whitelisted** regardless of the whitelist table's
  contents. There is exactly one admin this cycle.
- **D4 — Whitelist semantics.** The whitelist is a Convex table of email
  addresses, stored trimmed + lowercased; matching against the signed-in
  user's email is case-insensitive exact-string match (no gmail
  dot-normalization). Enforcement is **server-side in every Convex
  function** (§3), not merely hidden UI: a signed-in, non-whitelisted user
  sees the "not invited" wall and every data function rejects them.
  Removing an email invalidates that user's authorization on their **next
  protected Convex function invocation**: every protected query/mutation
  re-checks the whitelist server-side, so a removed user's in-flight SPA
  begins rejecting as soon as it next calls a protected function; the UI
  need not proactively detect removal until such a call, a refresh, or a
  navigation occurs. Removal does **not** delete the user's stored
  watchlist; re-adding the email restores access to their intact data.
- **D5 — The admin is not a super-reader.** Resolving the ideation open
  question: the admin manages the whitelist only. No Convex function
  exists that returns another user's watchlist to the admin (or to
  anyone, except via a share token, D7). The admin's own watchlist
  behaves like any user's.
- **D6 — Whitelist seeding.** A Convex mutation `whitelist.seed` (callable
  only via `npx convex run`, i.e. an internal mutation) inserts
  `waynehoy@gmail.com` into the whitelist if absent. Execution runs it
  once against the production deployment. The admin email is NOT stored
  in the table (implicit per D3); adding it via the admin UI is allowed
  but redundant.
- **D7 — Share links are tokenized rows, revoke = delete, tokens stored
  HASHED.** A share link is a row `{ userId, tokenHash }`. The plaintext
  token is generated server-side from a CSPRNG with ≥ 128 bits of entropy,
  rendered as ≥ 32 URL-safe characters (`/^[A-Za-z0-9_-]{32,}$/`), and is
  shown to the owner **exactly once, at creation** (copy-on-create). Only
  `tokenHash = SHA-256(token)` (hex, 64 lowercase chars) is persisted; the
  plaintext token is never stored, so a database read never yields a usable
  share URL. After creation, the owner UI shows only a **shortened
  non-authoritative identifier** (the token's first 8 chars, surfaced to
  the client at creation time) plus a revoke action — the full URL is NOT
  re-displayable. A user may hold multiple active links. Revoking deletes
  the row; a revoked token can never resolve again (its hash lookup
  misses). The public share payload contains **only** `{ stocks: [{
  ticker, name, tags }] }` — no owner email, no owner name, no user id, no
  document ids, no token. **If the owner is currently off the whitelist
  (and is not the admin), all their share links resolve to null** (links
  go dark with the owner, back to life on re-invite).
- **D8 — Shared page = `/shared/<token>`, strictly read-only.** No login
  required, no redirect to sign-in. It renders the same visual page as
  the owner view — sector cards with colored headers, tag filter bar with
  `?tags=` URL sync (i.e. `/shared/<token>?tags=...` filters exactly like
  `/?tags=...`), live prices + % change via the same `/api/stock` route,
  `last-refreshed` timestamp, and a working manual refresh button — with
  ALL mutating controls absent: no add button, no edit/delete buttons, no
  forms, no share management, no admin link. An unknown or revoked token
  renders a polite "link not found or revoked" screen (`share-invalid`
  test id) with no watchlist data; HTTP status is not constrained (the
  page is client-rendered).
- **D9 — `/api/stock` is unchanged and stays unauthenticated.** The
  Cycle-1 route contract (Cycle-1 spec §2, A1–A6) is preserved verbatim,
  including no-env-var/no-fs. It must remain callable with no cookies or
  auth header — the anonymous shared page depends on it, and quotes are
  public data.
- **D10 — Test-mode auth escape hatch (a product commitment, env-gated).**
  Google OAuth cannot be driven by headless tests, so the app ships a
  test-only sign-in path that exists **only when the Convex deployment
  env var `E2E_TEST_SECRET` is set**:
  - A Convex Auth credentials-style provider with id **`test-login`**
    taking `{ email, secret }`. If `secret` equals `E2E_TEST_SECRET`, it
    signs in (creating if needed) the user with that email; any other
    secret, or the env var being unset, fails sign-in. It works from a
    non-browser client: calling the `api.auth.signIn` action with
    `{ provider: "test-login", params: { email, secret } }` resolves with
    tokens whose JWT is accepted by `ConvexHttpClient.setAuth(...)`.
  - A public mutation **`testing.reset`** taking `{ secret }`: on secret
    match it deletes all rows from `stocks`, `whitelist`, `shareLinks`,
    clears the test identities' application data, and leaves no surviving
    authenticated sessions for them — the externally observable contract is
    that, after a successful reset, each test identity has no app data and
    a subsequent test sign-in behaves as a brand-new identity. (It is not
    required to delete Convex Auth's internal tables row-for-row, which are
    library-owned; the observable outcome is the contract.) It is rejected
    entirely when the env var is unset.
  - The sign-in screen additionally renders a test sign-in form
    (`test-signin-email`, `test-signin-secret`, `test-signin-submit`)
    **only when** the build-time env var `NEXT_PUBLIC_E2E_TEST_MODE=1`.
  - **Production never sets `E2E_TEST_SECRET` or
    `NEXT_PUBLIC_E2E_TEST_MODE`.** Verified by static check (T-S1) and
    human check H5.
- **D11 — Cycle-1 UX parity is a commitment, not a vibe.** For the
  authenticated whitelisted user, every UI commitment of Cycle-1 spec §4
  (U1–U7) still holds with the storage layer swapped: same `data-testid`s
  (`add-stock-button`, `stock-form*`, `sector-card`/`data-tag`,
  `stock-row`/`data-ticker`, `stock-price`, `stock-change`/
  `data-direction`, `tag-chip`, `clear-tag-filter`, `refresh-prices`,
  `last-refreshed`, `empty-state`, `edit-stock`, `delete-stock`,
  `confirm-delete`), same validation rules (Cycle-1 S2, now enforced
  server-side too — §3 F4), Enter-to-commit tag chips with commas
  rejected, zero change rendered unsigned `0.00%` (`data-direction=
  "flat"`), `last-refreshed` as 24h time with milliseconds, unknown
  `?tags=` values staying in the URL while matching no cards, manual
  refresh only (no polling), failed quotes degrading to `—` /
  `data-direction="unavailable"` per-row.
- **D12 — Cycle-1 UI tests are superseded; API tests are not.** The
  localStorage-based `tests/ui.spec.ts` cannot pass behind a login wall;
  Verification replaces it (the parity behaviors it covered are re-frozen
  here as T-E5/T-E6). `tests/api.spec.ts` (Cycle-1 T-A1–T-A6) remains
  valid and must still pass unmodified (D9).

## 2. Data model commitments — Convex schema (S)

`convex/schema.ts` defines, in addition to Convex Auth's own tables:

- **S1 — `stocks`**: `{ userId: Id<"users">, ticker: string, name:
  string, tags: string[] }`, indexed by `userId`. Same field semantics as
  Cycle 1: `ticker` stored uppercase; `tags` non-empty; **no ownership/
  portfolio fields of any kind** (no shares, equity, cost basis, platform
  — nothing from which a position could be inferred; this survives from
  Cycle 1 and applies to the share payload too, D7).
- **S2 — `whitelist`**: `{ email: string }` (trimmed, lowercased),
  indexed by `email`. At most one row per email; `whitelist.add` is
  **idempotent** (adding an existing email succeeds and leaves exactly one
  row — no error path, no duplicate).
- **S3 — `shareLinks`**: `{ userId: Id<"users">, tokenHash: string }`
  (SHA-256 hex of the plaintext token, per D7), indexed by `tokenHash` and
  by `userId`. The plaintext token is never stored. Token format per D7.
- **S4 — Uniqueness of tickers is per-user**: two different users may
  both hold `AAPL`; one user may not hold it twice (case-insensitive,
  enforced by F4 validation).

## 3. Function commitments — Convex API surface (F)

Function names below are **frozen** so Verification can call them from a
`ConvexHttpClient` (importing `convex/_generated/api` or using string
function references) without seeing the implementation. "Rejects" means
the call throws / the promise rejects; error message wording is not
frozen. "Caller" is resolved from Convex auth context. **Gate rule:
every function below except `share.get`, `users.me`, `testing.reset`,
and the auth actions rejects when the caller is unauthenticated OR
authenticated-but-not-whitelisted (whitelisted = email in `whitelist`
table or admin, per D3/D4).**

- **F1 — `users.me` (query, public)**: unauthenticated → `null`.
  Authenticated → `{ email: string, isAdmin: boolean, isWhitelisted:
  boolean }` for the caller (admin ⇒ both flags true regardless of table
  contents).
- **F2 — `stocks.list` (query)**: returns the **caller's own** stocks
  only, each at least `{ _id, ticker, name, tags }`. Never accepts a
  userId argument; there is no function anywhere in the public API that
  returns another identified user's stocks (D5).
- **F3 — `stocks.add` (mutation)**: args `{ ticker, name, tags }`;
  validates per F4; inserts for the caller; ticker stored uppercase.
  **`stocks.update`** args `{ id, ticker, name, tags }` and
  **`stocks.remove`** args `{ id }` operate only on a document owned by
  the caller; an `id` owned by another user rejects and leaves that
  document unchanged (no cross-user mutation, even by the admin).
- **F4 — Server-side validation** (mirror of Cycle-1 S2, enforced in the
  mutations regardless of client behavior): ticker required, 1–10 chars
  matching `/^[A-Za-z0-9.^-]+$/`, unique per-user case-insensitively
  (edit excludes the stock being edited); name required non-empty after
  trim; ≥ 1 tag, each trimmed non-empty, comma-free, deduplicated
  case-insensitively. Violations reject without mutating.
- **F5 — `whitelist.list` / `whitelist.add({ email })` /
  `whitelist.remove({ email })` (admin-only)**: reject for any
  non-admin caller (including whitelisted regular users). `add` stores
  trimmed+lowercased and is **idempotent**: adding an email that is already
  present succeeds and leaves exactly one row (S2). `list` returns the
  stored emails; `remove` matches case-insensitively. `whitelist.seed` per
  D6 is not callable from clients (internal).
- **F6 — `share.create` (mutation)**: no args; creates a link for the
  caller, stores only its `tokenHash` (S3), and returns **the plaintext
  token string exactly once** (format per D7) — this is the only moment the
  plaintext exists off the owner's clipboard. Successive calls return
  distinct tokens. **`share.list` (query)**: the caller's links, each at
  least `{ _id, display }` where `display` is the shortened identifier
  (first 8 chars of the token, captured at creation) — never the full
  token/hash. **`share.revoke({ id })` (mutation)**: deletes the caller's
  link; an `id` not owned by the caller rejects.
- **F7 — `share.get({ token })` (query, public, no auth required)**:
  hashes the incoming `token` (SHA-256) and looks up `tokenHash`; returns
  `{ stocks: [{ ticker, name, tags }] }` for a live token whose
  owner is currently whitelisted-or-admin; returns `null` for an unknown
  token, a revoked token, or a token whose owner is off the whitelist
  (D7). Never returns ids, emails, hashes, or any owner identity.
- **F8 — Auth actions**: Convex Auth's standard `api.auth.signIn` /
  `api.auth.signOut` are exposed; providers are Google (always) and
  `test-login` (only when env-gated, D10).

## 4. UI commitments — new surfaces (U)

All new interactive elements below commit to `data-testid` attributes;
they are part of the frozen contract. Cycle-1 test ids are preserved per
D11. A brief loading indicator while auth state resolves is permitted
everywhere; tests await settled states.

- **U1 — Sign-in screen** (`signin-screen`): what an unauthenticated
  visitor to `/` sees — an app title and a Google sign-in button
  (`signin-google`). No sector cards, no stock data, no admin/share
  controls. With `NEXT_PUBLIC_E2E_TEST_MODE=1` it additionally shows the
  test sign-in form (D10); without it, no `test-signin-*` element exists
  in the DOM.
- **U2 — Not-invited wall** (`not-invited`): what an authenticated,
  non-whitelisted user sees at `/` — a polite "you're not on the invite
  list" message, the signed-in email, and a sign-out button. No
  `add-stock-button`, no sector cards, no stock data.
- **U3 — Signed-in header**: the whitelisted user's view adds to the
  Cycle-1 header the signed-in email (`user-email`), a sign-out button
  (`signout-button`, click → back to `signin-screen`), a share button
  (`share-button`, U5), and — for the admin only — a link to the admin
  page (`admin-link`). Non-admins have no `admin-link` element.
- **U4 — Admin page at `/admin`**: for the admin, a whitelist manager:
  email input (`whitelist-email-input`), add button (`whitelist-add`),
  and one row per whitelisted email (`whitelist-row` with
  `data-email="<stored lowercase email>"`) each with a remove button
  (`whitelist-remove`). For any non-admin (or unauthenticated) visitor,
  `/admin` renders an access-denied message (`admin-denied`) and zero
  `whitelist-row` elements.
- **U5 — Share management** (owner view): `share-button` opens a panel
  (`share-panel`) with a create button (`share-create`). On create, the
  full share URL is revealed **once** in a dedicated element
  (`share-created-url`, containing `/shared/<token>`) with a copy
  affordance — this is copy-on-create, the only time the full URL is shown
  (D7). The persistent list shows one row per active link
  (`share-link-row`) displaying the shortened identifier
  (`share-link-id`, the token's first 8 chars — NOT the full token/URL)
  plus a revoke button (`share-revoke`). Creating adds a row; revoking
  removes it. No element re-displays a full share URL after creation.
- **U6 — Shared read-only page** at `/shared/<token>` per D8: renders
  `sector-card`s, `stock-row`s, `stock-price`/`stock-change` with the
  same formatting and `data-direction` semantics as Cycle 1, `tag-chip`s
  + `clear-tag-filter` with `?tags=` sync, `refresh-prices`, and
  `last-refreshed`. Contains **zero** of: `add-stock-button`,
  `edit-stock`, `delete-stock`, `stock-form`, `share-button`,
  `admin-link`, `signout-button`. Invalid/revoked token →
  `share-invalid` and zero `sector-card`/`stock-row` elements.

## 5. Cleanup / build / docs commitments (P)

- **P1** — No app code reads or writes the `tickerWatchlist.v1`
  localStorage key (or any successor watchlist key). `loadWatchlist`/
  `saveWatchlist` are deleted or unreferenced by app code.
- **P2** — `npm run build` exits 0, and `npx convex dev --once` (push +
  typecheck of the Convex functions to the configured dev deployment)
  exits 0 on this machine.
- **P3** — `README.md` gains a **"Environment & test setup"** section
  listing: every required Convex env var (prod and dev), where each is
  set (Convex dashboard — never the repo, never Vercel, per ideation),
  the Google OAuth client setup steps, and the exact copy-pasteable
  one-time commands to prepare the dev deployment for the frozen test
  plan (§10 Environment). Secrets themselves never appear in the repo.
- **P4** — Production deployment: the code on `main` deploys via the
  existing Vercel project onto `https://www.sectorwatchlist.com` with
  Convex prod (`https://combative-minnow-928.convex.cloud`), Google
  OAuth env vars set in the Convex dashboard, and `whitelist.seed` run
  (D6). Machine tests cover none of this (they run locally); human
  checks H1–H6 cover it at the verification gate.

## 6. Scope boundary — this cycle will NOT

- **N1** — Per-sector or per-card share links (whole-watchlist only;
  ideation defers per-sector to a later cycle).
- **N2** — Public sign-up, self-service invites, invite emails, or any
  auth provider besides Google (+ the env-gated test provider). No
  passwords, no magic links.
- **N3** — Multiple admins, admin roles/permissions UI, or admin
  visibility into other users' watchlist contents (D5).
- **N4** — Data migration or import from localStorage; any import/export
  feature. Wayne re-enters his 22 stocks manually post-launch.
- **N5** — Ownership/portfolio fields or value rollups (permanent, from
  Cycle 1).
- **N6** — Auto-refresh/polling/websocket price streams (manual refresh
  only, unchanged) and any change to the `/api/stock` contract (D9).
- **N7** — Vercel/DNS/infra setup (done outside the loop, fixed given)
  and any CI pipeline work.
- **N8** — Share-link niceties: expiry dates, view counts, per-link
  labels, password-protected links.
- **N9** — Editing the watchlist from the shared page, or any
  collaborative/multi-editor features.
- **N10** — Account deletion / GDPR tooling; renaming the app or visual
  redesign beyond what auth surfaces require.

## 7. Risks and rejected alternatives (one line each, veto-targetable)

**Risks**

- **R1** — The test-mode sign-in (D10) is a deliberate, env-gated
  security hole; mitigations: server-side secret check, absent-by-default
  registration, static check T-S1, human check H5 on prod.
- **R2** — Convex Auth's Google + custom-credentials-provider
  combination and its Node-client token shape (`signIn` →
  `tokens.token`) is the least-trodden path here; if the library
  fights back, D10's *behavior* is the commitment and Execution adapts
  the mechanism — this is the largest effort uncertainty.
- **R3** — The frozen E2E harness depends on a working Convex dev
  deployment + CLI auth on this machine (P2, §10); environment bring-up
  has failed loops before — mitigated by P3's copy-pasteable setup.
- **R4** — Google OAuth client creation in Google Cloud Console is a
  manual human step mid-Execution (callback URL known only once auth
  code exists); it can stall wall-clock but not machine tests (which
  never touch Google).
- **R5** — Porting the page from synchronous localStorage to reactive
  Convex queries risks subtle parity regressions (flash of empty state,
  quote refetch timing); T-E5/T-E6 pin the observable behaviors.
- **R6** — A share link exposes ticker+name+tags to anyone holding the
  URL by design; accepted because no position data exists (S1) and links
  are revocable and die with de-whitelisting (D7). Tokens are stored hashed
  (tokenHash, D7), so a database/dashboard read does not by itself leak a
  usable URL.
- **R9** — Copy-on-create means a full share URL cannot be re-displayed
  after the creation moment; if the owner closes the panel before copying,
  they revoke and create a fresh link. Accepted as the standard token
  trade-off (GitHub/Netlify-style) in exchange for never storing bearer
  tokens at rest (D7).

**Rejected alternatives**

- Stored `isAdmin` flag with first-login promotion — rejected: email
  constant (D3) has no bootstrap race and nothing to corrupt.
- Admin as super-reader of all watchlists — rejected per ideation's
  privacy default (D5).
- Share links that survive the owner's de-whitelisting — rejected:
  revoking a person should revoke their audience too (D7).
- Soft-delete/`revoked` flag on share links — rejected: row deletion is
  simpler and equally testable (D7).
- Storing plaintext share tokens so the full URL can be re-displayed —
  rejected: bearer tokens at rest are credentials; store `tokenHash`,
  reveal the URL once at creation, never re-display it (D7).
- Keeping localStorage as offline cache/fallback — rejected: dual-write
  bugs for zero product value this cycle (D1).
- Auth-gating `/api/stock` — rejected: the anonymous shared page needs
  it and quotes are public data (D9).
- Mocking Google OAuth in tests (fake IdP, browser automation of Google)
  — rejected as brittle/ToS-hostile; env-gated test provider (D10)
  instead, with prod safety checks.
- `convex-test`/Vitest as the primary harness — rejected as primary
  (couples tests to implementation internals for auth identity); a live
  dev deployment exercised via `ConvexHttpClient` + Playwright tests the
  real stack. Verification may still *add* convex-test checks.

## 8. Milestones (6 — upper end of one cycle; no split proposed)

Interdependence is why this stays one cycle: B (auth/whitelist) is a
prerequisite for both A (per-user persistence) and C (sharing); shipping
A without B would ship a different access model than the one Wayne
approved.

1. **M1** — Convex foundation: schema (S1–S3), client provider wiring in
   `app/layout.tsx`, Convex Auth with Google + `test-login` (D10, F8),
   `users.me` (F1), sign-in screen + not-invited wall (U1, U2).
2. **M2** — Whitelist: functions (F5), seed (D6), admin page (U4),
   header/admin-link (U3).
3. **M3** — Stocks on Convex: functions (F2–F4), port the main page +
   form to Convex queries/mutations with full Cycle-1 parity (D11),
   remove localStorage (P1).
4. **M4** — Share backend + owner UI: functions (F6–F7), share panel
   (U5).
5. **M5** — Shared read-only page (D8, U6).
6. **M6** — Hardening & launch: `testing.reset` env-gating pass, README
   env/test docs (P3), builds green (P2), prod env vars + seed + Google
   OAuth client live on `www.sectorwatchlist.com` (P4).

## 9. Cost/time estimate (vetoable; 1.5× the point estimates below is the cycle's breach threshold)

- **Scale of change:** ~1,800–2,600 lines added/changed across ~18–24
  files: new `convex/` directory (schema, auth config, 4–5 function
  modules, ~500–700 lines), rewritten `app/page.tsx` + providers, ~5 new
  components/routes (sign-in, wall, admin, share panel, shared page),
  README. Reference: Cycle 1 landed ~1,500 lines for a comparable-feeling
  scope, and this cycle adds a backend and an auth system.
- **Execution effort:** one Execution session, **point estimate 9
  agent-hours** (range 6–15). Wall clock through all gates: **2–4 days**
  — the Google Cloud Console step (R4) and two human gates dominate
  calendar time, not compute.
- **Spend:** **point estimate $115** for the remainder of the cycle
  (Execution ≈ $70, Verification ≈ $45 including the Node-client +
  two-browser-context harness), range $70–180.
- **Breach thresholds (1.5×): 13.5 agent-hours / $172.50.**
- **Uncertainty drivers, largest first:** (1) Convex Auth custom
  provider + non-browser token flow (R2) — if the library's shape
  differs from D10's assumption, Execution burns hours wrapping it;
  (2) dev-deployment/test-environment bring-up on this machine (R3);
  (3) reactive-port parity regressions (R5); (4) Google Console
  human-in-loop latency (R4, wall-clock only). The estimate is not
  optimistic: the happy path lands near 6 hours; the thresholds absorb
  one of these going wrong, not two.

---

## 10. Test plan — FROZEN with this spec

Rules of engagement: Verification implements these from this document
alone, may **add** checks, may never remove or weaken one. Verification
may add dev-dependencies as needed. Cycle-1's `tests/api.spec.ts`
(T-A1–T-A6) is retained unmodified and must pass (D9, D12); Cycle-1's
`tests/ui.spec.ts` is superseded and replaced by this plan (D12).

### Environment (frozen)

- **Setup:** `npm install`; then run the one-time dev-deployment
  commands documented in README §"Environment & test setup" (P3)
  verbatim — these must include (or be equivalent to) pushing functions
  (`npx convex dev --once`) and setting the dev deployment env var
  `E2E_TEST_SECRET=loopzai-e2e-dev-secret`. `.env.local` (left in place
  by Execution, gitignored) points `CONVEX_DEPLOYMENT` /
  `NEXT_PUBLIC_CONVEX_URL` at the **dev** deployment — never prod.
- **Web server:** `NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev` on port 3000
  (or Playwright `webServer` equivalent). Tests run serially (shared
  backend state).
- **Reset:** each test file first calls `testing.reset({ secret:
  "loopzai-e2e-dev-secret" })` so runs are repeatable.
- **Identities** (via `test-login`, D10): **ADMIN** =
  `trixiematic415@gmail.com`, **INVITED** = `e2e-invited@example.com`,
  **OTHER** = `e2e-other@example.com` (a second whitelisted user, used by
  T-F10b), **OUTSIDER** = `e2e-outsider@example.com`.
- **Node-client harness (T-F):** a `ConvexHttpClient` against
  `NEXT_PUBLIC_CONVEX_URL`; sign in via the `api.auth.signIn` action
  with `{ provider: "test-login", params: { email, secret } }` and
  `client.setAuth(result.tokens.token)` (F8/D10). Function names per §3;
  Verification may import `convex/_generated/api` or use string
  references.
- **Quote stub (T-E):** Playwright route interception on `/api/stock`
  (works for owner and shared pages alike, D9): `AAPL → {price: 200,
  previousClose: 100, changePercent: 100}`, `MSFT → {price: 90,
  previousClose: 100, changePercent: -10}`, `NVDA → {price: 100,
  previousClose: 100, changePercent: 0}`, `FAIL → HTTP 502`.
- "Rejects/throws" = the returned promise rejects. Pass criteria on
  element absence mean zero matching elements in the DOM.

### T-F: Function/ACL tests (Node + ConvexHttpClient, dev deployment)

After reset, unless a step says otherwise, whitelist INVITED via an
ADMIN-authenticated client (`whitelist.add`).

- **T-F1** (F1, D10): OUTSIDER signs in via `test-login` and receives a
  usable JWT; `users.me` → `{ email: "e2e-outsider@example.com",
  isAdmin: false, isWhitelisted: false }`. An unauthenticated client's
  `users.me` → `null`.
- **T-F2** (gate rule): OUTSIDER's `stocks.list`, `stocks.add`,
  `share.create`, and `share.list` all reject. An unauthenticated
  client's `stocks.list` rejects.
- **T-F3** (D3): immediately after reset (whitelist table empty), ADMIN
  signs in; `users.me` → `{ isAdmin: true, isWhitelisted: true }` — no
  whitelist row needed, no promotion step.
- **T-F4** (F5, D4): ADMIN `whitelist.add({ email:
  " E2E-Invited@Example.COM " })` → `whitelist.list` contains exactly
  `e2e-invited@example.com` (trimmed, lowercased, once even if added
  twice); INVITED can now `stocks.add` and `stocks.list`.
- **T-F5** (F2, F3, D5): INVITED adds AAPL; ADMIN adds MSFT. Pass:
  INVITED's `stocks.list` = [AAPL] only; ADMIN's = [MSFT] only; ADMIN
  calling `stocks.remove({ id: <INVITED's AAPL _id> })` and
  `stocks.update` on it both reject and INVITED's AAPL is unchanged.
- **T-F6** (F5): INVITED's `whitelist.list`, `whitelist.add`, and
  `whitelist.remove` all reject.
- **T-F7** (F4): INVITED's `stocks.add` rejects, without mutating, for:
  (a) ticker `""`; (b) ticker `TOOLONGTICKER1`; (c) ticker `AA$PL`;
  (d) empty name; (e) empty tags; (f) tag `"a,b"`; (g) ticker `aapl`
  when AAPL exists (case-insensitive per-user duplicate). Then a
  *different* user adding `AAPL` succeeds (S4).
- **T-F7b** (F4, S4, edit-path uniqueness): INVITED owns AAPL and MSFT;
  `stocks.update` editing MSFT to ticker `aapl` rejects without mutating
  (per-user ticker uniqueness applies on edit, excluding the stock being
  edited); a rename that keeps a distinct ticker succeeds.
- **T-F8** (F6, D7): INVITED `share.create` twice → two distinct plaintext
  tokens, each matching `/^[A-Za-z0-9_-]{32,}$/`; `share.list` has both
  rows but exposes only the shortened `display` identifier (first 8 chars)
  — never a full token or tokenHash. The stored `shareLinks` rows contain
  `tokenHash` (64 lowercase hex) and NOT the plaintext token (verified by
  inspecting the returned row shape / schema, not by reading the DB).
- **T-F9** (F7): an **unauthenticated** client's `share.get({ token })`
  for a live token → `{ stocks: [...] }` whose elements carry exactly
  ticker/name/tags (no `_id`, no `userId`, no email, no token, no
  tokenHash anywhere in the payload) and match the owner's list;
  `share.get` with token
  `"nope-000000000000000000000000000000"` → `null`.
- **T-F10** (F6, F7): `share.revoke({ id })` on link 1 → `share.get`
  (link 1) → `null` while link 2 still resolves; ADMIN calling
  `share.revoke` on INVITED's remaining link rejects.
- **T-F10b** (F6, cross-user, non-admin): a second whitelisted user OTHER
  calling `share.revoke({ id })` on INVITED's link rejects, and INVITED's
  link still resolves (non-admin users cannot revoke each other's links).
- **T-F11** (D4, D7): ADMIN `whitelist.remove({ email:
  "e2e-invited@example.com" })` → INVITED's `stocks.list` now rejects
  AND their remaining share link's `share.get` → `null`; ADMIN re-adds
  the email → INVITED's `stocks.list` resolves with AAPL intact and the
  same share token resolves again.
- **T-F12** (D10): `test-login` sign-in with secret
  `"wrong-secret"` fails (no usable token). `testing.reset({ secret:
  "wrong-secret" })` rejects.

### T-E: E2E tests (Playwright, quote stub active)

- **T-E1** (D2, U1): unauthenticated `/` shows `signin-screen` with
  `signin-google`; zero `sector-card`, `stock-row`, `add-stock-button`
  elements.
- **T-E2** (D4, U2): sign in as OUTSIDER via the test form
  (`test-signin-email`/`-secret`/`-submit`) → `not-invited` visible with
  `signout-button`; zero `add-stock-button`/`sector-card`. Click
  `signout-button` → `signin-screen` returns.
- **T-E3** (D1, U3): sign in as ADMIN → `empty-state` (fresh account),
  `user-email` shows the admin email, `admin-link` present. Add AAPL
  (name "Apple", tag `Tech`) via `add-stock-button` → `stock-form` →
  `stock-form-save`; card `sector-card[data-tag="Tech"]` with
  `stock-row[data-ticker="AAPL"]` appears. Open a **second browser
  context**, sign in as ADMIN there: the same card and row are present
  (cloud persistence across browsers — the load-bearing Cycle-2 claim).
- **T-E4** (D5, U4): as ADMIN at `/admin`, whitelist INVITED via
  `whitelist-email-input` + `whitelist-add` →
  `whitelist-row[data-email="e2e-invited@example.com"]` appears. In a
  separate context, INVITED signs in → sees `empty-state` (not ADMIN's
  AAPL); INVITED has no `admin-link`, and navigating to `/admin` shows
  `admin-denied` with zero `whitelist-row`s.
- **T-E5** (D11 parity — formatting/filter/refresh), as ADMIN with
  stocks AAPL(`Tech`), MSFT(`Tech`,`Cloud`), NVDA(`Chips`),
  FAIL(`Chips`):
  - AAPL `stock-price` text `$200.00`, `stock-change` `+100.00%` /
    `data-direction="up"`; MSFT `-10.00%`/`"down"`; NVDA `0.00%`
    (unsigned)/`"flat"`; FAIL `—` for both /`"unavailable"` while other
    rows render.
  - MSFT appears under both `Tech` and `Cloud` cards; cards in
    case-insensitive alphabetical order; AAPL before MSFT within Tech.
  - Click `tag-chip[data-tag="Cloud"]` → only Cloud card visible, URL
    contains `tags=Cloud`; direct-load `/?tags=Cloud` (same signed-in
    context) restores it; `clear-tag-filter` → all cards, no param;
    direct-load `/?tags=Nonexistent` → param stays in URL, zero
    `sector-card`s.
  - `last-refreshed` matches `/\d{2}:\d{2}:\d{2}\.\d{3}/`; clicking
    `refresh-prices` fires exactly one `/api/stock` request per distinct
    ticker and changes the `last-refreshed` text; a 30-second idle wait
    produces zero further `/api/stock` requests.
  - `stock-form` validation UX: saving with a comma-containing tag and
    with duplicate ticker `aapl` each surface `stock-form-error` and do
    not save; typing `Growth` in `stock-form-tags` and pressing Enter
    creates a chip.
- **T-E6** (D11, F3): edit MSFT via `edit-stock` (rename) → row shows
  new name; delete NVDA via `delete-stock` → `confirm-delete` → NVDA row
  gone; reload the page → edit and delete both persisted (server-side,
  not local state).
- **T-E7** (D7, D8, U5, U6): as INVITED (with AAPL + MSFT added),
  `share-button` → `share-panel` → `share-create` → the full share URL is
  revealed once in `share-created-url` (containing `/shared/` + a token
  matching `/[A-Za-z0-9_-]{32,}/`); capture it from that element. The
  persistent `share-link-row` shows the shortened `share-link-id` (8
  chars), NOT the full token. Open that captured URL in a **fresh
  unauthenticated context** (stub active): `sector-card`s and
  `stock-row`s render with correct prices/changes; `refresh-prices` works
  and updates `last-refreshed`; `tag-chip` filtering works and writes
  `?tags=` onto the `/shared/<token>` URL; the page contains **zero** of
  `add-stock-button`, `edit-stock`, `delete-stock`, `stock-form`,
  `share-button`, `admin-link`, `signout-button`, and no sign-in
  redirect occurs. Back as INVITED, `share-revoke` the link; reload the
  shared URL → `share-invalid`, zero `sector-card`/`stock-row`.
- **T-E8** (D4, U4): as ADMIN, `whitelist-remove` INVITED's row → row
  disappears; INVITED's context reloads `/` → `not-invited` wall, zero
  stock data in the DOM.
- **T-E9** (D8): navigate unauthenticated to
  `/shared/nope-000000000000000000000000000000` → `share-invalid`, zero
  `sector-card`s, no crash.

### T-A: API regression (live Yahoo, unchanged from Cycle 1)

- **T-A1–T-A6** — Cycle-1 spec §10 T-A1–T-A6 apply verbatim (existing
  `tests/api.spec.ts`), including the live-API flake rule (retry ≤ 3×
  with ≥ 30s waits on Yahoo non-200). Additionally **T-A7** (D9): the
  `GET /api/stock?ticker=AAPL` request is made with no cookies and no
  auth headers and still returns HTTP 200.

### T-S: Static safety checks

- **T-S1** (D10): in the repo, every code path that registers the
  `test-login` provider or enables `testing.reset` is guarded by a check
  on `process.env.E2E_TEST_SECRET`, and every render of `test-signin-*`
  UI is guarded by `process.env.NEXT_PUBLIC_E2E_TEST_MODE`; the literal
  string `loopzai-e2e-dev-secret` (or any other secret value) appears
  nowhere in the repo outside test files and `.env.local`
  (`git grep` based; `.env.local` is gitignored — verify it is).
- **T-S2** (P1): `git grep tickerWatchlist` matches no file under
  `app/`, `components/`, `convex/`, or `lib/` (test files exempt).
- **T-S3** (S1, D7): the Convex schema and the `share.get` return
  contain no field named `shares`, `equity`, `cost`, `basis`,
  `position`, or `platform` (no ownership data anywhere). The `shareLinks`
  table has **no plaintext `token` field** (only `tokenHash`), and `share.get`
  returns no `token`/`tokenHash`/`_id`/`userId`/email (D7).

### T-B: Build

- **T-B1** (P2): `npm run build` exits 0.
- **T-B2** (P2): `npx convex dev --once` exits 0 on this machine.

### Human checks at the verification gate (not machine-scored, listed so they aren't skipped; all on `https://www.sectorwatchlist.com` prod)

- **H1** (D2, D3, P4): Wayne signs in with real Google as
  `trixiematic415@gmail.com`; the app loads, `admin-link` present.
- **H2** (D4): a real Google account not on the whitelist gets the
  polite wall, not data.
- **H3** (D6): the prod admin page shows `waynehoy@gmail.com` seeded.
- **H4** (D7, D8): Wayne creates a share link on prod, opens it in an
  incognito window with no login: live-priced read-only watchlist;
  revoking makes the same URL show the invalid screen.
- **H5** (D10): the prod sign-in page shows ONLY the Google button — no
  test sign-in form — and prod's Convex env vars include no
  `E2E_TEST_SECRET`.
- **H6** (D1): the same admin watchlist appears on a second
  browser/machine after sign-in.
- **H7** (D11): up-changes visibly green, down-changes visibly red;
  cards visually match Cycle 1 (no design regression).

*End of frozen test plan. 35 machine-scored tests (T-F1–12 + T-F7b +
T-F10b, T-E1–9, T-A1–7, T-S1–3, T-B1–2), 7 human checks.*
