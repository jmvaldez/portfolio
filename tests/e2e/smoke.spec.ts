import { test, expect } from '@playwright/test';

test('/ returns 200 and renders the valdez-os 1.0 frame', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toContainText('valdez-os 1.0');
});
