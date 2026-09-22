<!-- spec-amendments.md — human-approved deltas to the frozen spec; live for the current cycle. -->

## Amendment — blocking-pause answer (cycle 3, 2026-09-22T08:44:44.060Z)

**Question:** [unknown] frozen static rows WC-S-24a/24a2 red because /use client/ and /process\.env/ match phrases inside the header comments of lib/watchlistCsv.ts and lib/watchlistImport.ts; comment-stripped code has no directive, no process.env, no fetch, no react/next/convex import, and the direct-import unit rows pass — a defective frozen assertion, not a product defect; amendment proposed, or reword the two comment lines
**Decision (human):** Authorize the narrow amendment to frozen rows WC-S-24a and WC-S-24a2.

This is a grader defect, not a product defect.

Preserve the original semantic contract exactly:

- lib/watchlistCsv.ts and lib/watchlistImport.ts must not actually contain or
  use a 'use client' directive;
- they must not access process.env;
- they must not call fetch;
- they must not import React, Next, or Convex.

Amend only the frozen assertions so comments and other non-executable text do
not create false positives. The rows should inspect comment-stripped /
executable source, AST-equivalent structure, or another reliable semantic
check.

Do not weaken the protected behavior.
Do not change product code merely to satisfy the defective raw-text regex.
Do not broaden this amendment beyond WC-S-24a / WC-S-24a2.

Resume the cycle after the amended grader proves the same semantic promise.
