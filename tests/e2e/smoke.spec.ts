import { test, expect } from '@playwright/test';

// The shell adds a second `h1` (its own, sr-only) above the breakpoint, so this targets
// the linear layout's masthead specifically rather than `h1` at large.
// `tests/e2e/entry.spec.ts` covers the shell/linear handover itself.
test('/ returns 200 and renders the masthead', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#linear h1')).toHaveText('Joe Valdez');
});
