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

