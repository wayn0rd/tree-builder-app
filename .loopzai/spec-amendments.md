<!-- spec-amendments.md — human-approved deltas to the frozen spec; live for the current cycle. -->

## Amendment — frozen test tests/cycle3-e2e.spec.ts: T-E9 (U7, D2) — the two non-retrying `expect(await anonPage.getByTestId(...).count()).toBeGreaterThanOrEqual(1)` checks for sector-card and stock-row immediately after goto(sharedPath) amended (cycle 3, 2026-09-20T20:39:25.484Z)
<!-- loopzai-amendment kind="test" cycle="3" target-test="tests/cycle3-e2e.spec.ts: T-E9 (U7, D2) — the two non-retrying `expect(await anonPage.getByTestId(...).count()).toBeGreaterThanOrEqual(1)` checks for sector-card and stock-row immediately after goto(sharedPath)" target-cycle="3" -->

**Target test:** tests/cycle3-e2e.spec.ts: T-E9 (U7, D2) — the two non-retrying `expect(await anonPage.getByTestId(...).count()).toBeGreaterThanOrEqual(1)` checks for sector-card and stock-row immediately after goto(sharedPath)
**Target cycle:** 3
**Discovered in cycle:** 3
**Evidence:** Attempt 1: line 667 failed 'Expected: >= 1, Received: 0' evaluated 0 ms after goto(sharedPath). Spec §9 requires expectations to hold within Playwright's 15 s expect timeout; the assertion allots 0 s. Cycle-2 T-E7 loaded a shared page with auto-waiting toBeVisible() and passed in the same run. Ad-hoc replay of the full T-E9 flow with retrying assertions: sector-card count right after goto = 0, first card visible after ~3048 ms, then all U7/D2 absence assertions hold (0 manage-stocks-*, no edit/delete controls, no Add Stock; outsider + /admin clean).
**Reason (human):** The frozen assertion contradicts the spec's own 15 s timing rule and the implementation's observed behavior. Repair the TEST only: make the shared-page presence checks retry within the existing frozen timeout (wait for the already-required visible shared-page element before the count assertions, or use a retrying assertion / expect.poll). Do not weaken the U7/D2 product promise.

## Amendment — frozen test tests/cycle3-scoped.spec.ts: V2 (D10) — the `await page.reload()` immediately after `getByTestId('test-signin-submit').click()`, before any wait for the signed-in dashboard amended (cycle 3, 2026-09-20T20:39:53.154Z)
<!-- loopzai-amendment kind="test" cycle="3" target-test="tests/cycle3-scoped.spec.ts: V2 (D10) — the `await page.reload()` immediately after `getByTestId('test-signin-submit').click()`, before any wait for the signed-in dashboard" target-cycle="3" -->

**Target test:** tests/cycle3-scoped.spec.ts: V2 (D10) — the `await page.reload()` immediately after `getByTestId('test-signin-submit').click()`, before any wait for the signed-in dashboard
**Target cycle:** 3
**Discovered in cycle:** 3
**Evidence:** Attempt 1: `expect(brow.first()).toBeVisible()` timed out after 15 s ('element(s) not found'); Playwright's failure snapshot shows the sign-in screen, i.e. the reload fired before the test-login action persisted its session. An ad-hoc replay that waits for the signed-in dashboard before reloading found the AAPL board row and then verified all three D10 outside-the-flow checks (card-opened Edit open after Escape+500ms; delete-confirm open after Escape+500ms; Add Stock form open after Escape+500ms; modal/backdrop count 0 throughout). Static: the only Escape listener in the diff is gated on manageOpen (app/page.tsx); StockForm.tsx unchanged (V1 pass).
**Reason (human):** The frozen test races the harness sign-in and never reaches its D10 assertions, which the implementation satisfies. Repair the TEST only: insert the minimum wait for a canonical signed-in dashboard signal (e.g. manage-stocks-button visible) before the existing page.reload(). Do NOT change the (a)-(c) behavioral assertions.

## Amendment — frozen test tests/cycle3-scoped.spec.ts: V2 (D10) — the `await page.reload()` immediately after `getByTestId('test-signin-submit').click()`, before any wait for the signed-in dashboard amended (cycle 3, 2026-09-20T20:39:53.226Z)
<!-- loopzai-amendment kind="test" cycle="3" target-test="tests/cycle3-scoped.spec.ts: V2 (D10) — the `await page.reload()` immediately after `getByTestId('test-signin-submit').click()`, before any wait for the signed-in dashboard" target-cycle="3" -->

**Target test:** tests/cycle3-scoped.spec.ts: V2 (D10) — the `await page.reload()` immediately after `getByTestId('test-signin-submit').click()`, before any wait for the signed-in dashboard
**Target cycle:** 3
**Discovered in cycle:** 3
**Evidence:** Attempt 1: `expect(brow.first()).toBeVisible()` timed out after 15 s ('element(s) not found'); Playwright's failure snapshot shows the sign-in screen, i.e. the reload fired before the test-login action persisted its session. An ad-hoc replay that waits for the signed-in dashboard before reloading found the AAPL board row and then verified all three D10 outside-the-flow checks (card-opened Edit open after Escape+500ms; delete-confirm open after Escape+500ms; Add Stock form open after Escape+500ms; modal/backdrop count 0 throughout). Static: the only Escape listener in the diff is gated on manageOpen (app/page.tsx); StockForm.tsx unchanged (V1 pass).
**Reason (human):** The frozen test races the harness sign-in and never reaches its D10 assertions, which the implementation satisfies. Repair the TEST only: insert the minimum wait for a canonical signed-in dashboard signal (e.g. manage-stocks-button visible) before the existing page.reload(). Do NOT change the (a)-(c) behavioral assertions.
