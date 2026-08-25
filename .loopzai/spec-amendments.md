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
