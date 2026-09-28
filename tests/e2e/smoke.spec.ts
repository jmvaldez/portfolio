import { test, expect } from '@playwright/test';

// Phase 3's placeholder Frame is gone; `/` is now the real linear layout (Phase 6).
// Phase 8 adds a second `h1` (the shell's own, sr-only) above the breakpoint, so this
// targets the linear layout's masthead specifically rather than `h1` at large —
// `tests/e2e/entry.spec.ts` covers the shell/linear handover itself.
test('/ returns 200 and renders the masthead', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#linear h1')).toHaveText('Joe Valdez');
});
