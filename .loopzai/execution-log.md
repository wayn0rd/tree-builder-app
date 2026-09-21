<!-- execution-log.md — checkpointed action entries for the current cycle; entry format per ARCHITECTURE.md §6. -->

### entry-0001
```yaml
timestamp: 2026-09-21T16:35:00Z
phase: execution
cycle: 1
status: in_progress
commitSha: null
filesTouched: []
milestoneIds: ["M1"]
completesMilestoneIds: ["M1"]
```
Add the `name` key (meta.longName → meta.shortName → null) to the /api/stock 200 body per spec D4 and criteria 1–6, leaving every non-200 branch, existing key, and import untouched (M1).
