import { test, expect } from '@playwright/test';

// Phase 3's placeholder Frame is gone; `/` is now the real linear layout (Phase 6).
test('/ returns 200 and renders the masthead', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Joe Valdez');
});
