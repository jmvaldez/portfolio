import { expect, test } from '@playwright/test';

// The shell entry handover: `HeadGate.astro` deciding boot vs. restore vs. staying on
// the linear layout, `Shell.tsx`'s readiness handshake, and the live two-way breakpoint
// swap. 1280x800 (above `SHELL_QUERY`) unless a test says otherwise.

declare global {
  interface Window {
    __sawKeydown?: boolean;
  }
}

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
const NARROW = { width: 800, height: 600 };

test.describe('first visit', () => {
  test.use({ viewport: DESKTOP });

  test('#boot is visible, shell-ready arrives after >= 600ms, and status reads Desktop ready, focus stays on body', async ({
    page,
  }) => {
    const start = Date.now();
    await page.goto('/');

    await expect(page.locator('#boot')).toBeVisible();

    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(600);

    await expect(page.locator('[role="status"]')).toHaveText(/Desktop ready/, { timeout: 2000 });

    const activeIsBody = await page.evaluate(() => document.activeElement === document.body);
    expect(activeIsBody).toBe(true);
  });
});

test.describe('returning visit (reload)', () => {
  test.use({ viewport: DESKTOP });

  test('#restore shows the correct RESUME wording, no #boot', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });

    await page.reload();
    // `#restore` has no minimum display time (unlike the boot's 600ms), so the shell can
    // reach `shell-ready` and hide it before this test's polling sees it visible. What
    // matters is the text mutation and the absence of a boot, whether or not `#restore`
    // is still on screen when we look.
    //
    // The seed opens real windows (about.txt, projects, terminal.exe), so the wording is
    // the plural "N WINDOWS RESTORED". Matched by pattern, not a hardcoded count, so a
    // change to the seed list doesn't break this test over unrelated wording.
    await expect(page.locator('#restore-line')).toHaveText(
      /^RESUME · (DESKTOP|\d+ WINDOWS?) RESTORED$/,
    );
    const hasBootClass = await page.evaluate(() =>
      document.documentElement.classList.contains('boot'),
    );
    expect(hasBootClass).toBe(false);
  });
});

test.describe('keypress during boot', () => {
  test.use({ viewport: DESKTOP });

  test('the keypress never reaches the page and html jumps to boot-skipped', async ({ page }) => {
    await page.addInitScript(() => {
      window.__sawKeydown = false;
      document.addEventListener('keydown', () => {
        window.__sawKeydown = true;
      });
    });

    await page.goto('/');
    await expect(page.locator('#boot')).toBeVisible();
    await page.keyboard.press('a');

    await expect(page.locator('html')).toHaveClass(/boot-skipped/, { timeout: 1000 });
    const sawKeydown = await page.evaluate(() => window.__sawKeydown);
    expect(sawKeydown).toBe(false);
  });
});

test.describe('mobile viewport', () => {
  test.use({ viewport: MOBILE });

  test('no #boot, html never gets class shell, linear layout is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#boot')).toBeHidden();
    await expect(page.locator('html')).not.toHaveClass(/shell/);
    await expect(page.locator('#linear')).toBeVisible();
  });
});

test.describe('resize across the breakpoint', () => {
  test.use({ viewport: DESKTOP });

  test('narrowing shows the linear layout and announces the switch; widening restores, never boots', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });

    await page.setViewportSize(NARROW);
    await expect(page.locator('#linear')).toBeVisible();
    await expect(page.locator('[role="status"]')).toHaveText(/Switched to text layout/);

    await page.setViewportSize(DESKTOP);
    // Widening has no minimum display time (unlike the boot's 600ms), so the shell can
    // reach `shell-ready` and hide `#restore` before this test's polling sees it visible.
    // What matters is that a boot never happens and the shell does come back.
    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
    const hasBootClass = await page.evaluate(() =>
      document.documentElement.classList.contains('boot'),
    );
    expect(hasBootClass).toBe(false);
  });
});

test.describe('skip link and the Desktop control', () => {
  test.use({ viewport: DESKTOP });

  test('the skip link is the first Tab stop, sets the override, and the Desktop control clears it', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText('Skip to text layout');

    await page.keyboard.press('Enter');
    await expect(page.locator('#linear')).toBeVisible();

    await page.reload();
    await expect(page.locator('#boot')).toBeHidden();
    await expect(page.locator('html')).not.toHaveClass(/shell/);
    await expect(page.locator('#linear')).toBeVisible();

    const desktopControl = page.locator('[data-desktop-control]');
    await expect(desktopControl).toBeVisible();
    await desktopControl.click();

    // The shell already booted once this session (the first `page.goto('/')` above), so
    // clearing the override brings the shell back via the Restore line, never a second
    // boot.
    await page.waitForLoadState();
    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
    const hasBootClass = await page.evaluate(() =>
      document.documentElement.classList.contains('boot'),
    );
    expect(hasBootClass).toBe(false);
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: DESKTOP, reducedMotion: 'reduce' });

  test('all boot lines are visible immediately and VECTOR UNIT reads STANDBY', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#boot')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/reduced/);

    for (let i = 1; i <= 6; i++) {
      await expect(page.locator(`.boot-line-${i}`)).toBeVisible();
    }
    await expect(page.locator('[data-slot="vector-unit"]')).toHaveText('STANDBY');
  });
});

test.describe('island fails to mount', () => {
  test.use({ viewport: DESKTOP });

  test('the hard timeout reveals the linear layout after ~6s', async ({ page }) => {
    await page.route('**/_astro/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('#boot')).toBeVisible();

    await expect(page.locator('#linear')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('html')).not.toHaveClass(/shell/);
  });
});

test.describe('JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false, viewport: DESKTOP });

  test('the linear layout shows: the gate never ran', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#linear')).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/shell/);
    await expect(page.locator('html')).not.toHaveClass(/boot/);
  });
});
