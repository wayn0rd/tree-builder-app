<!-- assumptions.md — provisional assumption record; never ground truth until reviewed. -->

### assumption-0001
**Undecided:** the session started with coordinator-owned files uncommitted in the working tree (`.loopzai/ideation.md`, `.loopzai/spec-amendments.md`, `.loopzai/state.json` modified; `.loopzai/cycle2-prep-brief.md`, `.loopzai/watchlist-seed.md` untracked) — the spec doesn't say whether Execution commits them or leaves them dirty.
**Chosen:** commit them verbatim (zero content changes) as the first checkpoint, so the session can end with the required clean working tree.
**Why:** the checkpoint contract demands a clean tree at session end and treats uncommitted leftovers as a failure; committing byte-identical content is not "touching" the never-touch files.
**Wrong if:** the coordinator intended to commit these itself at the gate and a duplicate/premature commit confuses its reconciliation.
