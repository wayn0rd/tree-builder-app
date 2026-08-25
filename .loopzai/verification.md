<!-- verification.md — verification results for the current cycle. -->

# Cycle 2 — Verification attempt 2 of 3 — PASS

**Date:** 2026-08-25. **Grader:** fresh session (attempt 2 per coordinator —
the post-escalation attempt authorized by the 2026-08-25T21:09Z
escalation-resolution amendment).
**Grading standard:** `.loopzai/spec.md` (frozen) + `.loopzai/spec-amendments.md`
(gate amendment, two T-S1 clause-(c) scope amendments, and the
escalation-resolution warm-up amendment).

## Frozen-test integrity check (performed before running anything)

The frozen test implementation is commit `a34572a` (attempt 1 of the
original run). `git diff a34572a HEAD -- tests/ playwright.config.ts`
shows exactly **two** deltas since freeze, both human-authorized:

1. `a7c89da` — excludes `.loopzai/` from T-S1 clause (c)'s grep target
   set, per the 2026-08-25T20:39/20:40 blocking-pause amendments
   (clauses (a), (b), (d) untouched).
2. `d6b170a` — **additions only**: new `tests/global-setup.ts` (a
   Playwright globalSetup warm-up navigating `/` and retrying until the
   page loads with an OK response and zero pageerrors) plus a
   `globalSetup:` wiring line in `playwright.config.ts`, per the
   escalation-resolution amendment ("the Playwright harness must issue a
   warm-up navigation to `/` … before any e2e test executes"). No test's
   assertions, scope, or pass criteria changed; no existing test removed,
   weakened, or modified — verified against the actual diff, not the
   execution log.

Every other test file is byte-identical to the freeze. No additions were
made this attempt (no amendment requires any). The tests were run
**unchanged from git**.

Also verified against ground truth: since attempt 3's graded run
(`502a264`), the non-`.loopzai` delta is exactly `playwright.config.ts`
(+5) and `tests/global-setup.ts` (+63) — **zero application-code
changes**. The prior fix `990377d` remains a comment-only change to
`components/SignInScreen.tsx`.

## Environment (frozen §10 + warm-up amendment, confirmed in place)

- `.env.local` (gitignored — verified via `git check-ignore`) points
  `CONVEX_DEPLOYMENT`/`NEXT_PUBLIC_CONVEX_URL` at dev
  `combative-minnow-928` (never prod); `E2E_TEST_SECRET` present.
- Port 3000 verified **empty** before the suite; Playwright's
  `webServer` started a fresh `NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev`
  itself, and the amended `globalSetup` warm-up ran before any test.
- `npm run build` ran **before** any dev server existed, never
  concurrently.

## Results (graded run)

Commands, in order:

1. `npx convex dev --once` → "Convex functions ready! (1.34s)", exit 0
   (**T-B2 PASS**; pushes HEAD's functions to dev)
2. `npm run build` → exit 0 (**T-B1 PASS**)
3. `npx playwright test --reporter=list` (serial, 1 worker, fresh
   webServer, dev deployment) → exit 0: **33 passed (1.3m), 0 failed**

| Item | Result | Evidence (playwright list reporter) |
|---|---|---|
| T-F1 (F1, D10) | PASS | OUTSIDER test-login JWT usable; `users.me` shapes incl. unauthenticated → null (376ms) |
| T-F2 (gate rule) | PASS | OUTSIDER + unauthenticated calls all reject (637ms) |
| T-F3 (D3) | PASS | ADMIN admin+whitelisted with an EMPTY whitelist table (254ms) |
| T-F4 (F5, D4, S2) | PASS | add trims+lowercases, idempotent; INVITED gains access (695ms) |
| T-F5 (F2, F3, D5) | PASS | per-user isolation; admin cannot mutate cross-user (875ms) |
| T-F6 (F5) | PASS | whitelist functions reject for non-admin whitelisted user (369ms) |
| T-F7 (F4, S4) | PASS | validation rejects (a)–(g) without mutating; per-user uniqueness (2.2s) |
| T-F7b (F4, S4) | PASS | rename onto owned ticker rejects; distinct rename succeeds (857ms) |
| T-F8 (F6, D7, S3) | PASS | two distinct hashed tokens; list exposes only 8-char display (395ms) |
| T-F9 (F7, D7) | PASS | anonymous `share.get` returns only `{stocks:[{ticker,name,tags}]}`; unknown token → null (342ms) |
| T-F10 (F6, F7) | PASS | revoke kills exactly that link; admin cannot revoke cross-user (511ms) |
| T-F10b (F6) | PASS | second whitelisted non-admin cannot revoke either (223ms) |
| T-F11 (D4, D7) | PASS | de-whitelisting gates functions AND darkens links; re-invite restores (687ms) |
| T-F12 (D10) | PASS | wrong secret fails sign-in and reset (194ms) |
| T-E1 (D2, U1) | PASS | unauthenticated `/` shows only `signin-screen` (436ms — warm-up pre-compiled the route; attempts' prior race did not recur) |
| T-E2 (D4, U2) | PASS | OUTSIDER hits not-invited wall; sign-out returns to sign-in (1.4s) |
| T-E3 (D1, U3) | PASS | ADMIN fresh account; add AAPL; persists to a second browser context (2.7s) |
| T-E4 (D5, U4) | PASS | admin whitelists INVITED; INVITED sees own empty list, no admin access (4.1s) |
| T-E5 (D11) | PASS | parity — formatting, ordering, filtering, refresh (incl. 30s no-polling idle), validation UX (41.2s) |
| T-E6 (D11, F3) | PASS | edit and delete persist server-side across reload (2.6s) |
| T-E7 (D7, D8, U5, U6) | PASS | copy-on-create share link; anonymous read-only page; revoke → `share-invalid` (6.0s) |
| T-E8 (D4, U4) | PASS | whitelist removal walls INVITED off on next load (2.4s) |
| T-E9 (D8) | PASS | unknown share token renders `share-invalid` without crashing (1.2s) |
| T-A1–T-A6 | PASS | Cycle-1 `tests/api.spec.ts` unmodified, live Yahoo, no flake retries needed (370ms–182ms each) |
| T-A7 (D9) | PASS | `/api/stock?ticker=AAPL` with no cookies and no auth headers → 200 (37ms) |
| T-S1 (D10) | PASS | env-gating clauses (a)/(b) green; amended clause (c) scope clean; `.env.local` gitignored (32ms) |
| T-S2 (P1) | PASS | no `tickerWatchlist` reference in app code (7ms) |
| T-S3 (S1, D7) | PASS | no ownership fields; `shareLinks` stores `tokenHash`, never plaintext token (10ms) |
| T-B1 (P2) | PASS | `npm run build` exit 0 |
| T-B2 (P2) | PASS | `npx convex dev --once` exit 0 |

**Machine score: 35 pass / 0 fail of 35.**

## Verdict

The cycle's machine-verifiable commitments are met in full: all 14
function/ACL tests, all 9 e2e tests (including the full parity, share,
and whitelist-removal surfaces that attempt 3 never reached), all 7 API
regression tests, all 3 static-safety sweeps, and both build checks pass
against the frozen tests unchanged from git, under the human-amended
environment (warm-up before the e2e suite). The escalation-resolution
hypothesis is confirmed by this run: the sole prior failure (T-E1) was a
harness-path first-request compile race — with the authorized warm-up in
place and zero app-code changes, T-E1 and every downstream e2e test pass.

**Remaining before close-out — human checks H1–H7** (spec §10, all on
`https://www.sectorwatchlist.com` prod): real Google sign-in as admin
(H1), non-whitelisted wall (H2), seeded `waynehoy@gmail.com` (H3), prod
share-link create/open-incognito/revoke (H4), prod sign-in shows ONLY the
Google button and prod Convex env has no `E2E_TEST_SECRET` (H5),
cross-machine persistence (H6), visual parity (H7). These are not
machine-scored; this session recommends a pass, and final close-out is
Wayne's gate — I recommend, I do not close the cycle.

LOOPZAI_VERDICT: {"result":"pass"}
