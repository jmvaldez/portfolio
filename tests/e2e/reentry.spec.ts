import { expect, test } from '@playwright/test';

// Re-entry after a round trip to a page reaches an interactive, layout-restored shell
// within 800 ms of navigation start. Timing on shared runners is noisy, so 800 ms is
// warn-only (an annotation); the hard failure is 3000 ms, which means something is
// broken rather than slow.
const WARN_MS = 800;
const FAIL_MS = 3000;

test.use({ viewport: { width: 1440, height: 900 } });

test('re-entry after promote and close box reaches shell-ready within budget', async ({ page }) => {
  // Runs in every document before its scripts: records `performance.now()` (ms since that
  // document's navigation start) the moment `html.shell-ready` appears.
  await page.addInitScript(() => {
    const record = () => {
      if (document.documentElement?.classList.contains('shell-ready')) {
        (window as unknown as { __shellReadyAt?: number }).__shellReadyAt ??= performance.now();
      }
    };
    // Observe `document`, not `documentElement`: this runs before <html> is parsed.
    new MutationObserver(record).observe(document, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
  });

  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });

  // The seed opens four windows; two more launches make sure at least three are open and
  // one of them is not from the seed.
  for (const label of ['resume.txt', 'contact.txt']) {
    await page.locator('.desktop-icon', { hasText: label }).first().dblclick();
  }
  const open = await page.locator('[data-window]').count();
  expect(open).toBeGreaterThanOrEqual(3);

  await page.locator('[data-window="/contact.txt"] .maxbox').click();
  await expect(page).toHaveURL(/\/contact\/?$/);

  await page.locator('a[aria-label="Return to home"]').click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
  await expect(page.locator('[data-window]')).toHaveCount(open);

  const readyAt = await page.evaluate(
    () => (window as unknown as { __shellReadyAt?: number }).__shellReadyAt,
  );
  expect(readyAt, 'shell-ready was never observed').toBeDefined();
  const ms = Math.round(readyAt ?? Number.NaN);

  if (ms > WARN_MS) {
    test.info().annotations.push({
      type: 'warning',
      description: `re-entry took ${ms} ms, over the ${WARN_MS} ms budget (warn-only)`,
    });
  }
  console.log(`re-entry: shell-ready at ${ms} ms after navigation start`);
  expect(ms, `re-entry over the ${FAIL_MS} ms hard limit`).toBeLessThanOrEqual(FAIL_MS);
});
