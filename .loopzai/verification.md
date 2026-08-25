<!-- verification.md — verification results for the current cycle. -->

# Cycle 2 — Verification attempt 2 of 3

**Date:** 2026-08-25. **Grader:** fresh session (attempt 2 per coordinator).
**Grading standard:** `.loopzai/spec.md` (frozen) + `.loopzai/spec-amendments.md`.
**Frozen tests:** commit `a34572a` (attempt 1's frozen implementation —
`tests/cycle2-functions.spec.ts`, `tests/cycle2-e2e.spec.ts`,
`tests/cycle2-api.spec.ts`, `tests/cycle2-static.spec.ts`, plus retained
Cycle-1 `tests/api.spec.ts`). Run **unchanged** this attempt — zero
edits, zero additions (no new amendment landed since freeze; the two
amendments in `spec-amendments.md` predate the freeze and are covered).

Note on attempt 1: it committed the frozen tests (`a34572a`) but never
wrote or committed results to this file (found as an empty stub) — so no
prior failure hypothesis existed. This attempt graded from scratch.

## Environment incident (grading-side, documented for the record)

The first suite invocation this attempt produced 8 failures (T-A1–A5,
T-A7, T-E1, T-S1) + 8 not-run. Investigation showed an **orphaned
`next dev` server** on port 3000 (pid 832838, started 13:03:44, before
this session — almost certainly attempt 1's Playwright `webServer`
left running). Grading's T-B1 `npm run build` then rebuilt `.next/`
underneath it, poisoning its chunk cache: every route on that server
returned HTTP 500 (`Error: Cannot find module './276.js'` in
`webpack-runtime.js` — captured from the server's own error payload;
even `GET /api/stock` with no ticker, which never touches Yahoo,
returned 500 instead of 400). Playwright's `reuseExistingServer: true`
reused that poisoned server, so the frozen Environment ("web server:
`NEXT_PUBLIC_E2E_TEST_MODE=1 npm run dev` on port 3000") **was not in
place** for that run. This is not a flake reclassification: the run did
not execute the frozen environment at all, so it is not a graded run.
The orphan was killed and the suite run once under the mandated
environment (fresh dev server started by Playwright's webServer). That
run is the graded run below. T-S1 — the one static, server-independent
check — failed identically in both runs.

## Results (graded run)

Commands, in order:

1. `npx convex dev --once` → exit 0 (**T-B2 PASS**; also pushes HEAD's functions to dev `combative-minnow-928`)
2. `npm run build` → exit 0 (**T-B1 PASS**)
3. `npx playwright test` (serial, 1 worker, webServer with `NEXT_PUBLIC_E2E_TEST_MODE=1`, dev deployment per `.env.local`) → 32 passed, 1 failed (1.3m)

| Item | Result | Evidence (playwright list reporter) |
|---|---|---|
| T-F1 (F1, D10) | PASS | test-login JWT usable; users.me shapes correct; unauthenticated → null |
| T-F2 (gate rule) | PASS | OUTSIDER + unauthenticated calls all reject |
| T-F3 (D3) | PASS | ADMIN admin+whitelisted with empty whitelist table |
| T-F4 (F5, D4, S2) | PASS | trim+lowercase, idempotent add, INVITED gains access |
| T-F5 (F2, F3, D5) | PASS | per-user isolation; admin cross-user mutations reject |
| T-F6 (F5) | PASS | whitelist fns reject for non-admin whitelisted user |
| T-F7 (F4, S4) | PASS | all 7 invalid-input rejections without mutating; other user may add AAPL |
| T-F7b (F4, S4) | PASS | rename onto owned ticker rejects; distinct rename succeeds |
| T-F8 (F6, D7, S3) | PASS | two distinct tokens `/^[A-Za-z0-9_-]{32,}$/`; list shows 8-char display only |
| T-F9 (F7, D7) | PASS | anonymous share.get → exactly {stocks:[{ticker,name,tags}]}; unknown token → null |
| T-F10 (F6, F7) | PASS | revoke kills exactly that link; admin cross-user revoke rejects |
| T-F10b (F6) | PASS | second whitelisted non-admin cannot revoke |
| T-F11 (D4, D7) | PASS | de-whitelist gates functions + darkens links; re-invite restores intact |
| T-F12 (D10) | PASS | wrong secret fails sign-in and reset |
| T-E1 (D2, U1) | PASS | signin-screen only; zero sector-card/stock-row/add-stock-button |
| T-E2 (D4, U2) | PASS | not-invited wall; sign-out returns to sign-in |
| T-E3 (D1, U3) | PASS | fresh admin, add AAPL, persists to second browser context |
| T-E4 (D5, U4) | PASS | whitelist via /admin; INVITED sees own empty list; admin-denied |
| T-E5 (D11) | PASS | formatting/ordering/filtering/refresh/validation parity (41s, incl. 30s idle no-poll check) |
| T-E6 (D11, F3) | PASS | edit + delete persist server-side across reload |
| T-E7 (D7, D8, U5, U6) | PASS | copy-on-create; anonymous read-only page; revoke → share-invalid |
| T-E8 (D4, U4) | PASS | removal walls INVITED off on next load |
| T-E9 (D8) | PASS | unknown token → share-invalid, no crash |
| T-A1–T-A6 | PASS | Cycle-1 `tests/api.spec.ts` unmodified, live Yahoo, no flake retries needed |
| T-A7 (D9) | PASS | /api/stock 200 with no cookies/auth headers |
| **T-S1 (D10)** | **FAIL** | `Error: components/SignInScreen.tsx mentions test-login but has no process.env.E2E_TEST_SECRET guard` (clause (a) of the frozen check) |
| T-S2 (P1) | PASS | no tickerWatchlist reference in app code |
| T-S3 (S1, D7) | PASS | no ownership fields; shareLinks stores tokenHash only; share.get leaks nothing |
| T-B1 (P2) | PASS | `npm run build` exit 0 |
| T-B2 (P2) | PASS | `npx convex dev --once` exit 0 |

**Machine score: 34 / 35 pass.** Human checks H1–H7 (prod,
`www.sectorwatchlist.com`) remain for the verification gate and are not
machine-scored here.

## The T-S1 failure, precisely

Frozen `tests/cycle2-static.spec.ts` clause (a) requires **every**
app-code file (`app/ components/ convex/ lib/`) that git-grep-matches
`test-login` to contain the string `process.env.E2E_TEST_SECRET`.
`components/SignInScreen.tsx` contains the literal `'test-login'` at
line 20 — the provider id passed to `signIn('test-login', {...})` from
the test form's submit handler — and contains no
`process.env.E2E_TEST_SECRET` reference. Deterministic, fails in both
runs, independent of any server.

For the record (a finding, not a test change): the implementation
appears to satisfy the *spec's* T-S1 sentence — registration
(`convex/auth.ts:60`) and `testing.reset` (`convex/testing.ts:15`) are
guarded by `process.env.E2E_TEST_SECRET`, and the `test-signin-*`
render is guarded by `NEXT_PUBLIC_E2E_TEST_MODE`
(`SignInScreen.tsx:47`). The frozen check's clause (a) is broader than
the spec's "registers the test-login provider" wording, sweeping in the
client-side *invocation*. Per the rules of engagement the frozen test is
the grading target and is not modified or weakened; this observation is
surfaced for Wayne's awareness, not acted on.

## Verdict: FAIL — diagnosed retry

**Failure hypothesis:** `components/SignInScreen.tsx` embeds the raw
provider-id literal `'test-login'` in client UI code; frozen T-S1
clause (a) treats any app-code occurrence of `test-login` as a
registration-adjacent code path and demands the
`process.env.E2E_TEST_SECRET` guard reference in that file, which the
file lacks.

**What must change (implementation only — frozen tests untouched):**
Execution should make `components/SignInScreen.tsx` satisfy frozen
T-S1(a) without weakening any guard. Straightforward compliant routes:
(1) remove the raw literal from the UI file by centralizing the
provider id (e.g. a shared constant in a file that legitimately carries
the `process.env.E2E_TEST_SECRET` guard relationship), or (2) make
`SignInScreen.tsx` itself reference `process.env.E2E_TEST_SECRET` in an
accurate, truthful way that documents the server-side gate this form
depends on. Whatever the mechanism: after the change, every file under
`app/ components/ convex/ lib/` matching `git grep test-login` must
contain `process.env.E2E_TEST_SECRET`, with no behavioral change to
U1/D10 (the form still renders only under `NEXT_PUBLIC_E2E_TEST_MODE=1`,
and provider registration stays gated server-side). No other test may
regress.

**Expected outcome of the retry:** `npx playwright test` under the
frozen environment passes 33/33, with T-B1/T-B2 still exit 0 —
i.e. 35/35 machine tests green — after which only human checks H1–H7
stand between the cycle and Wayne's close-out.

**Operational note for the next session:** ensure no stale server holds
port 3000 before running the suite (the config's
`reuseExistingServer: true` will happily adopt a poisoned orphan), and
run `npm run build` either before starting the dev server or after
stopping it — never concurrently. Uncommitted `.loopzai/state.json`
changes present in the tree are the coordinator's own live heartbeat
(phase/attempt fields), not verification leftovers; this file is
off-limits to Verification and was left as found.

Attempt budget after this attempt: 2 of 3 used. One diagnosed retry
remains before mandatory escalation.

LOOPZAI_VERDICT: {"result":"fail","hypothesis":"components/SignInScreen.tsx contains the raw 'test-login' provider-id literal without any process.env.E2E_TEST_SECRET reference, failing frozen T-S1 clause (a), which requires every app-code file grep-matching test-login to carry that guard string"}
