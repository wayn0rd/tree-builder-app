<!-- assumptions.md — provisional assumption record; never ground truth until reviewed. -->

### assumption-0001
**Undecided:** the session started with coordinator-owned files uncommitted in the working tree (`.loopzai/ideation.md`, `.loopzai/spec-amendments.md`, `.loopzai/state.json` modified; `.loopzai/cycle2-prep-brief.md`, `.loopzai/watchlist-seed.md` untracked) — the spec doesn't say whether Execution commits them or leaves them dirty.
**Chosen:** commit them verbatim (zero content changes) as the first checkpoint, so the session can end with the required clean working tree.
**Why:** the checkpoint contract demands a clean tree at session end and treats uncommitted leftovers as a failure; committing byte-identical content is not "touching" the never-touch files.
**Wrong if:** the coordinator intended to commit these itself at the gate and a duplicate/premature commit confuses its reconciliation.

### assumption-0002
**Undecided:** S3 lists `shareLinks` as `{ userId, tokenHash }`, but F6/U5 require `share.list` to return a shortened identifier "captured at creation" (the token's first 8 chars) — which must be persisted somewhere, since only the hash survives creation.
**Chosen:** add a third field `display: string` (the token's first 8 chars) to the `shareLinks` table.
**Why:** it is the only way to satisfy F6's "captured at creation" wording; 8 chars (48 bits) of a ≥32-char token is non-authoritative and cannot be used as a bearer token, so D7's security property holds. T-S3 only forbids a plaintext `token` field.
**Wrong if:** Verification treats S3's field list as exhaustive and fails the schema on any extra field.
