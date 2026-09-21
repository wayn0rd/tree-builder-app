<!-- assumptions.md — provisional assumption record; never ground truth until reviewed. -->

### assumption-0001
**Undecided:** Milestone M4 reads "Existing Playwright suite green, new rows covering the criteria, README sentence", but the spec does not say who authors the new rows; the execution system prompt forbids Execution from writing the tests it is graded against, and the implementation plan (Git sequencing: C3 = "M4 (Execution's part)", V0 = "frozen rows" by Verification, matching cycle-3 commit f9e2ee6) assigns them to the Verification worker.
**Chosen:** Execution adds no file under `tests/`; it completes M4's Execution part (README sentence, existing suite green, tsc/build green) and stamps `completesMilestoneIds: ["M4"]` on that entry. Criteria 7–19 were exercised ad hoc with a scratch Playwright script kept outside `tests/` and not committed (15/15 passed).
**Why:** Writing the frozen rows myself would violate the "must not touch the tests you will be graded against" rule and collide with the Verification freeze commit; the plan explicitly carves M4 this way.
**Wrong if:** The coordinator or a human expects the new `tests/autofill-*.spec.ts` rows to exist at Execution close — then M4 should be treated as in_progress until Verification's V0 commit lands.

<!-- loopzai-reviewed: assumption-0001 accepted 2026-09-21T22:10:13.885Z -->
