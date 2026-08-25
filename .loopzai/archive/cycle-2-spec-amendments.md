<!-- spec-amendments.md — human-approved deltas to the frozen spec; live for the current cycle. -->

## Cycle 2 — gate amendment (pre-freeze, 2026-08-24)

The Cycle-2 spec was amended **at the approval gate, before being frozen**,
incorporating an external reviewer pass (Wayne's AI friend). Verdict:
"approve with amendments, not redesign." Edits were made in place to
`.loopzai/spec.md` (Option 1) per Wayne. Changes:

1. **Share tokens stored hashed at rest (D7, S3, F6, F7, U5, T-F8/E7/S3).**
   `shareLinks` now stores `tokenHash = SHA-256(token)` instead of the
   plaintext token. The full share URL is revealed **once at creation**
   (copy-on-create, `share-created-url`); the persistent list shows a
   shortened 8-char identifier (`share-link-id`) + revoke only. Rationale:
   plaintext bearer tokens in the DB are credentials readable by anyone
   with DB/dashboard access. Added **R9** (copy-on-create trade-off note).
2. **Whitelist-removal semantics tightened (D4).** "Next page load" →
   "next protected Convex function invocation" — matches the server-side
   gate rule already in §3; UI need not detect removal proactively.
3. **`whitelist.add` idempotent (S2, F5).** Adding an existing email
   succeeds and leaves exactly one row; removed the "idempotent OR reject"
   implementation-defined branch.
4. **`testing.reset` softened to its observable contract (D10).** Instead
   of mandating deletion of Convex Auth's internal tables (library-owned),
   the contract is: after reset, test identities have no app data and no
   surviving sessions; a fresh sign-in behaves as a fresh identity.
   (Directly de-risks R2, the cycle's largest uncertainty — Execution may
   adapt the mechanism.)
5. **Two added ACL/validation tests (should-fix, accepted).**
   **T-F7b**: `stocks.update` renaming a ticker onto an already-owned
   ticker rejects (uniqueness on edit, not just add). **T-F10b**: a second
   whitelisted non-admin user (OTHER) calling `share.revoke` on INVITED's
   link rejects (cross-user revoke protection beyond the admin path).

Machine-scored test count: 33 → 35. Reviewer confirmed **no cycle split
needed** (auth/whitelist is foundational to both persistence and sharing).

*Deferred as out-of-scope per reviewer agreement: token expiry, audit
logs, account deletion, session-management UI, invitation emails, migration
tooling, granular/per-sector shares, richer roles.*


## Amendment — blocking-pause answer (cycle 2, 2026-08-25T07:16:33.081Z)

**Question:** Spec P4 names combative-minnow-928 as Convex prod but it is actually the project's DEV deployment (real prod: frugal-anaconda-225; Vercel's NEXT_PUBLIC_CONVEX_URL reportedly points at the dev one, which must carry E2E_TEST_SECRET for tests while prod never may, per D10/H5) — which Convex deployment should www.sectorwatchlist.com use, and please create the Google OAuth client (R4) so AUTH_GOOGLE_ID/SECRET can be set on it?
**Decision (human):** Production deployment confirmed: frugal-anaconda-225 (verified via npx convex deploy --dry-run). Vercel NEXT_PUBLIC_CONVEX_URL already repointed to https://frugal-anaconda-225.convex.cloud (Production env). Google OAuth client created in GCP project sectorwatchlist; AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET set on the prod deployment (verified present via npx convex env list --prod). Test users trixiematic415@gmail.com + waynehoy@gmail.com added to the OAuth consent screen. Proceed with remaining P4 launch steps: convex deploy to prod, generate-auth-keys --prod, set --prod SITE_URL=https://www.sectorwatchlist.com, and prod whitelist:seed.

## Amendment — blocking-pause answer (cycle 2, 2026-08-25T20:39:00Z)

**Question:** Frozen T-S1 clause (c) forbids the literal `loopzai-e2e-dev-secret` in any tracked file outside `tests/`, but frozen `.loopzai/spec.md` itself contains that literal (lines 433/440/603, present at freeze commit `a34572a`) — the frozen test fails deterministically against the spec's own text. Which resolution is authorized?
**Decision (human):** Option 1 — narrow T-S1 clause (c)'s sweep scope: the `loopzai-e2e-dev-secret` literal is forbidden in **application code** (source files that ship in the product or configure its runtime: `app/`, `components/`, `convex/`, `lib/`, `scripts/`, config files such as `package.json`/`*.config.*`/`*.env*`), NOT in `.loopzai/` narrative/process documents (spec, amendments, logs, briefs). Rationale: the clause's intent is that the test-only backdoor secret never ships in the product; the spec document naming the secret to describe the rule is expected and harmless. Frozen `tests/cycle2-static.spec.ts` may be adjusted to encode this narrowed scope (minimum change: exclude `.loopzai/` from the clause-(c) grep target set); clauses (a) and (b) are unchanged.

## Amendment — blocking-pause answer (cycle 2, 2026-08-25T20:40:20.810Z)

**Question:** Frozen T-S1 clause (c) forbids the literal 'loopzai-e2e-dev-secret' outside tests/, but frozen .loopzai/spec.md itself contains it (lines 433/440/603, present at freeze) — resolving requires amending the frozen spec or frozen test; which resolution do you authorize?
**Decision (human):** Option 1 authorized and recorded in spec-amendments.md (commit d642dda): T-S1 clause (c) sweep scope narrowed to application code; .loopzai/ narrative docs excluded. Frozen tests/cycle2-static.spec.ts may be minimally adjusted to encode this scope (exclude .loopzai/ from clause-(c) grep targets); clauses (a) and (b) unchanged. Proceed with verification attempt 3.

## Amendment — escalation resolution (cycle 2, 2026-08-25T21:09:00Z)

**Escalation:** Verification attempt 3 of 3 failed solely on T-E1 — the suite's first page navigation raced the Next dev server's first-request on-demand compile and received a syntactically broken `_next` chunk (`pageerror: Invalid or unexpected token`), crashing the client bundle. Evidence: reproduced exactly once (first load after fresh server start), absent on all warm loads; identical page code passed T-E1–E9 in attempt 2; sole app-code delta since is a comment. Harness-path race, not a product regression. Attempt cap exhausted → mandatory human decision.
**Decision (human):** Option 1 — amend the frozen test environment (§10): the Playwright harness must issue a **warm-up navigation to `/` and wait for the route to compile** (e.g. a `globalSetup` or fixture that requests `/` and waits for a non-error response / network idle) **before** any e2e test executes, so no test's first navigation doubles as the dev server's first-request compile. This changes only harness timing; no test's assertions, scope, or pass criteria are altered. The frozen e2e test file may be minimally adjusted to add this warm-up (additions-only spirit; no existing test removed, weakened, or reclassified). Authorize one further verification attempt under the amended environment.

## Amendment — assumption assumption-0001 approved (cycle 2, 2026-08-25T23:48:47.424Z)

**Undecided:** the session started with coordinator-owned files uncommitted in the working tree (`.loopzai/ideation.md`, `.loopzai/spec-amendments.md`, `.loopzai/state.json` modified; `.loopzai/cycle2-prep-brief.md`, `.loopzai/watchlist-seed.md` untracked) — the spec doesn't say whether Execution commits them or leaves them dirty.
**Chosen:** commit them verbatim (zero content changes) as the first checkpoint, so the session can end with the required clean working tree.
**Why:** the checkpoint contract demands a clean tree at session end and treats uncommitted leftovers as a failure; committing byte-identical content is not "touching" the never-touch files.
**Wrong if:** the coordinator intended to commit these itself at the gate and a duplicate/premature commit confuses its reconciliation.

## Amendment — assumption assumption-0002 approved (cycle 2, 2026-08-25T23:48:47.424Z)

**Undecided:** S3 lists `shareLinks` as `{ userId, tokenHash }`, but F6/U5 require `share.list` to return a shortened identifier "captured at creation" (the token's first 8 chars) — which must be persisted somewhere, since only the hash survives creation.
**Chosen:** add a third field `display: string` (the token's first 8 chars) to the `shareLinks` table.
**Why:** it is the only way to satisfy F6's "captured at creation" wording; 8 chars (48 bits) of a ≥32-char token is non-authoritative and cannot be used as a bearer token, so D7's security property holds. T-S3 only forbids a plaintext `token` field.
**Wrong if:** Verification treats S3's field list as exhaustive and fails the schema on any extra field.

## Amendment — assumption assumption-0003 approved (cycle 2, 2026-08-25T23:48:47.424Z)

**Undecided:** D12 says Cycle-1's `tests/ui.spec.ts` "is superseded; Verification replaces it", but not who deletes the old file — leaving it in place makes `npm test` fail (it cannot pass behind the login wall).
**Chosen:** Execution deletes `tests/ui.spec.ts` now; `tests/api.spec.ts` is kept byte-identical (D9/D12).
**Why:** a permanently-failing superseded test file poisons every future `npm test` run; D12 already declares it dead, and its behaviors are re-frozen as T-E5/T-E6 for Verification to implement fresh.
**Wrong if:** Verification expected to diff its replacement against the old file in the working tree (it can still recover it from git history).

## Amendment — assumption assumption-0004 approved (cycle 2, 2026-08-25T23:48:47.424Z)

**Undecided:** How components/SignInScreen.tsx should satisfy frozen T-S1 clause (a), which is broader than the spec's D10 wording: verification attempt 2 offered two compliant routes — (1) centralize the 'test-login' provider-id literal into a shared constant file carrying the guard string, or (2) have SignInScreen.tsx itself reference process.env.E2E_TEST_SECRET in a truthful, documenting way. The spec does not prescribe either.
**Chosen:** Route (2): a documenting comment on the test-form submit handler stating (accurately) that the 'test-login' provider is enforced server-side in convex/auth.ts behind process.env.E2E_TEST_SECRET and that this client form grants nothing by itself.
**Why:** Smallest possible diff with zero behavioral or bundling risk — route (1) would add a new module and an import into a client component (or risk pulling server-only convex/auth.ts into the client bundle), touching more surface for the same frozen-test outcome. The comment is truthful: it documents the exact server gate the form depends on. A code-level reference to a non-NEXT_PUBLIC env var in client code would always evaluate to undefined in the browser and would be *less* truthful than the comment.
**Wrong if:** A future verifier or reviewer judges a comment-only guard reference as gaming the frozen check rather than documenting the gate, or a later cycle's static sweep requires an executable (non-comment) reference — either would favor route (1)'s shared-constant refactor.

## Amendment — assumption assumption-0005 approved (cycle 2, 2026-08-25T23:48:47.424Z)

**Undecided:** the warm-up amendment (escalation resolution 2026-08-25T21:09Z) leaves the mechanism open ("e.g. a globalSetup or fixture that requests `/` and waits for a non-error response / network idle") — bare HTTP fetch vs. real browser navigation, globalSetup vs. per-file fixture, and whether to also warm `/admin` and `/shared/<token>`.
**Chosen:** a Playwright `globalSetup` (new file `tests/global-setup.ts`, wired in `playwright.config.ts` — no frozen test file touched) that performs a real Chromium navigation to `/`, waits for `networkidle`, and retries until the load completes with an OK response and zero `pageerror`s (120s deadline). Only `/` is warmed.
**Why:** the attempt-3 failure artifact was a syntactically broken on-demand-compiled `_next` chunk *executed by the browser*; a bare HTML fetch never fetches or executes chunks, so a real navigation with a zero-pageerror gate is the smallest mechanism that actually covers the observed failure. globalSetup runs once before every test (Playwright starts `webServer` before globalSetup, and the retry loop absorbs any residual startup lag). Warming only `/` follows the amendment's letter; `/admin` and `/shared` share the compiled app chunks and compiled without incident in attempts 2 and 3.
**Wrong if:** a future run shows the same first-compile race on `/admin` or `/shared/<token>` navigations (would justify warming those routes too), or a Playwright version change starts globalSetup before the webServer is listening for longer than the 120s retry deadline.
