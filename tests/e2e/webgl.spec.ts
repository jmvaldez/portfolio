import { expect, test, type Page } from '@playwright/test';

// The WebGL scene (Phase 12; tickets 01, 07, 14 § The 3D, 19). Chromium is pointed at
// SwiftShader so CI, which has no GPU, still renders a real canvas. 1440x900, same as
// `wm.spec.ts`: above the shell breakpoint, with D16's seed windows (including
// `viewer.exe`) open.
const DESKTOP = { width: 1440, height: 900 };

test.use({
  viewport: DESKTOP,
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
});

const VIEWER = '[data-window="/bin/viewer.exe"]';
const TERMINAL = '[data-window="/bin/terminal.exe"]';

interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Empty desktop: right of `viewer.exe` (seed spans x 0.50–0.84), below the toasts, above
 * the taskbar. Only the canvas paints here, so any non-background pixel is the grid. */
const GRID_CLIP: Clip = { x: 1270, y: 480, width: 150, height: 340 };

async function waitReady(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
  await expect(page.locator(VIEWER)).toBeVisible();
  // The lazy chunk lands after the shell is ready (the 3D "may arrive after that").
  await expect(page.locator('canvas')).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator('.gauge', { hasText: 'VEC' }).locator('.bars s.lit')).toHaveCount(5);
}

/** The box of a locator's body, inset so only its interior is sampled. */
async function bodyClip(page: Page, selector: string): Promise<Clip> {
  const box = await page.locator(`${selector} .window-body`).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return { x: box.x + 4, y: box.y + 4, width: box.width - 8, height: box.height - 8 };
}

interface Counts {
  blue: number;
  amber: number;
  green: number;
  data: number[];
}

/** Screenshots `clip`, decodes it in the page, and classifies pixels by hue. */
async function sample(page: Page, clip: Clip): Promise<Counts> {
  const png = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let blue = 0;
    let amber = 0;
    let green = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (b > r + 40 && b > g + 40) blue++;
      else if (r > b + 60 && g > b + 30 && r > 100) amber++;
      else if (g > r + 50 && g > b + 50) green++;
    }
    return { blue, amber, green, data: Array.from(data) };
  }, png);
}

function differing(a: Counts, b: Counts): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2]
    )
      n++;
  }
  return n;
}

test('exactly one canvas: with the viewer open, and after it is closed', async ({ page }) => {
  await waitReady(page);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator(`${VIEWER} .closebox`).click();
  await expect(page.locator(VIEWER)).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('the canvas is hidden from assistive tech and out of the tab order', async ({ page }) => {
  await waitReady(page);
  const wrapper = page.locator('canvas').locator('xpath=ancestor::div[@aria-hidden="true"][1]');
  await expect(wrapper).toHaveAttribute('tabindex', '-1');
  await expect(page.locator(`${VIEWER} .sr-only`)).toHaveText(
    'Wireframe model of a 5-inch FPV quadcopter, slowly rotating.',
  );
});

test('the canvas paints the grid and the drone: no opaque surface covers it', async ({ page }) => {
  await waitReady(page);
  const grid = await sample(page, GRID_CLIP);
  expect(grid.blue).toBeGreaterThan(50);

  const viewer = await sample(page, await bodyClip(page, VIEWER));
  // The drone's ink-green edges, and the grid showing through the transparent body.
  expect(viewer.green).toBeGreaterThan(50);
  expect(viewer.blue).toBeGreaterThan(50);
});

test('toggling CRT off changes the canvas pixels', async ({ page }) => {
  await waitReady(page);
  const on = await sample(page, GRID_CLIP);
  await page.locator('.crt-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-crt', 'off');
  await page.waitForTimeout(300);
  const off = await sample(page, GRID_CLIP);
  expect(off.blue).toBeGreaterThan(50);
  expect(differing(on, off)).toBeGreaterThan(50);
});

test('terminal arm toasts ARMED, disarm toasts DISARMED', async ({ page }) => {
  await waitReady(page);
  const input = page.locator(`${TERMINAL} .terminal-input`);
  await input.fill('arm');
  await input.press('Enter');
  await expect(page.locator('.toast-label', { hasText: /^ARMED$/ })).toBeVisible();
  await input.fill('disarm');
  await input.press('Enter');
  await expect(page.locator('.toast-label', { hasText: /^DISARMED$/ })).toBeVisible();
});

test('the Konami code shifts the grid toward amber', async ({ page }) => {
  await waitReady(page);
  const before = await sample(page, GRID_CLIP);
  expect(before.amber).toBe(0);

  await page.locator('#desktop').click({ position: { x: 1350, y: 200 } });
  for (const key of [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'KeyB',
    'KeyA',
  ]) {
    await page.keyboard.press(key);
  }
  await expect(page.locator('.toast-label', { hasText: 'TINT' })).toBeVisible();
  await page.waitForTimeout(300);
  const after = await sample(page, GRID_CLIP);
  expect(after.amber).toBeGreaterThan(50);
  expect(after.blue).toBeLessThan(before.blue);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no canvas; the viewer shows the SVG; VEC reads standby', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
    await expect(page.locator(VIEWER)).toBeVisible();
    await expect(page.locator(`${VIEWER} .viewer-fallback svg`)).toBeVisible();
    await expect(page.locator(`${VIEWER} .readout`)).toContainText('ORBIT');
    await expect(page.locator('.scene-floor')).toBeVisible();
    await expect(page.locator('.gauge', { hasText: 'VEC' }).locator('.bars s.lit')).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('arming only toasts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
    await page.locator(`${VIEWER} .closebox`).click();
    const input = page.locator(`${TERMINAL} .terminal-input`);
    await input.fill('arm');
    await input.press('Enter');
    await expect(page.locator('.toast-label', { hasText: /^ARMED$/ })).toBeVisible();
    await expect(page.locator(VIEWER)).toHaveCount(0);
  });
});

test('reduced motion flipped on mid-session stops the scene and shows the fallback', async ({
  page,
}) => {
  await waitReady(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.scene-floor')).toBeVisible();
  await expect(page.locator(`${VIEWER} .viewer-fallback svg`)).toBeVisible();
  await expect(page.locator('.gauge', { hasText: 'VEC' }).locator('.bars s.lit')).toHaveCount(0);
  // Still the one context: stopped, not torn down.
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.gauge', { hasText: 'VEC' }).locator('.bars s.lit')).toHaveCount(5);
});
