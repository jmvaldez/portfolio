import { expect, test, type Page } from '@playwright/test';

// The hand-rolled window manager (ticket 04 § Behaviour, ticket 14 § Round 2): drag,
// snap, magnetism, resize, z-order, minimise/close, and the rescue clamp. 1440x900
// (well above `SHELL_QUERY`) unless a test says otherwise — D16's own seed windows,
// `about.txt` and `projects/`, are what every test here drives; `viewer.exe` and
// `terminal.exe` are skipped in this phase (neither app is registered yet).
const DESKTOP = { width: 1440, height: 900 };

test.use({ viewport: DESKTOP });

async function waitReady(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
}

async function desktopBox(page: Page) {
  const box = await page.locator('#desktop').boundingBox();
  if (!box) throw new Error('#desktop has no box');
  return box;
}

async function windowRect(page: Page, path: string) {
  return page.locator(`[data-window="${path}"]`).evaluate((el) => ({
    x: Number(el.getAttribute('data-rect-x')),
    y: Number(el.getAttribute('data-rect-y')),
    w: Number(el.getAttribute('data-rect-w')),
    h: Number(el.getAttribute('data-rect-h')),
  }));
}

async function titlebarCenter(page: Page, path: string) {
  const box = await page.locator(`[data-window="${path}"] .titlebar`).boundingBox();
  if (!box) throw new Error(`no titlebar box for ${path}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function near(a: number, b: number, tolerance = 2): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);
}

test('dragging by the title bar moves the window by the drag delta', async ({ page }) => {
  await waitReady(page);
  const before = await windowRect(page, '/about.txt');
  const start = await titlebarCenter(page, '/about.txt');
  const dx = 120;
  const dy = 60;

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx / 2, start.y + dy / 2, { steps: 5 });
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 5 });
  await page.mouse.up();

  const after = await windowRect(page, '/about.txt');
  near(after.x, before.x + dx);
  near(after.y, before.y + dy);
});

test('releasing at the left edge snaps to the left half, then dragging away tears it free', async ({
  page,
}) => {
  await waitReady(page);
  const desktop = await desktopBox(page);
  const before = await windowRect(page, '/about.txt');
  const start = await titlebarCenter(page, '/about.txt');

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(desktop.x + 10, desktop.y + desktop.height / 2, { steps: 10 });
  await page.mouse.up();

  const snapped = await windowRect(page, '/about.txt');
  near(snapped.x, 0);
  near(snapped.y, 0);
  near(snapped.w, desktop.width / 2);
  near(snapped.h, desktop.height);

  // Drag it away from the edge: the first movement past the threshold tears it
  // free back to its pre-snap size, and the drag continues from there — so by
  // release the window is centred under wherever the pointer ends up.
  const snappedTitlebar = await titlebarCenter(page, '/about.txt');
  const target = { x: desktop.x + desktop.width / 2, y: desktop.y + desktop.height / 2 };
  await page.mouse.move(snappedTitlebar.x, snappedTitlebar.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();

  const torn = await windowRect(page, '/about.txt');
  near(torn.w, before.w);
  near(torn.h, before.h);
  near(torn.x + torn.w / 2, target.x - desktop.x, 5);
  near(torn.y + torn.h / 2, target.y - desktop.y, 5);
});

test('releasing at a corner tiles a quarter, and releasing at the top maximises', async ({
  page,
}) => {
  await waitReady(page);
  const desktop = await desktopBox(page);

  let start = await titlebarCenter(page, '/about.txt');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(desktop.x + desktop.width - 10, desktop.y + 10, { steps: 10 });
  await page.mouse.up();

  let rect = await windowRect(page, '/about.txt');
  near(rect.x, desktop.width / 2);
  near(rect.y, 0);
  near(rect.w, desktop.width / 2);
  near(rect.h, desktop.height / 2);

  // Tear it free, then release along the top edge away from either corner.
  start = await titlebarCenter(page, '/about.txt');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(desktop.x + desktop.width / 2, desktop.y + 10, { steps: 10 });
  await page.mouse.up();

  rect = await windowRect(page, '/about.txt');
  near(rect.x, 0);
  near(rect.y, 0);
  near(rect.w, desktop.width);
  near(rect.h, desktop.height);
});

test('two windows dragged close together end up flush (magnetism)', async ({ page }) => {
  await waitReady(page);
  const about = await windowRect(page, '/about.txt');
  const projects = await windowRect(page, '/projects');
  const start = await titlebarCenter(page, '/projects');

  // Land projects/ 5px clear of about.txt's right edge — inside the 8px magnet
  // radius, but not already touching.
  const dx = about.x + about.w + 5 - projects.x;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y, { steps: 10 });
  await page.mouse.up();

  const after = await windowRect(page, '/projects');
  near(after.x, about.x + about.w, 1);
});

test('resizing from the bottom-right handle never goes below 200x120', async ({ page }) => {
  await waitReady(page);
  const handle = page.locator('[data-window="/about.txt"] .resize-se');
  const box = await handle.boundingBox();
  if (!box) throw new Error('missing bottom-right resize handle');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 1000, start.y - 1000, { steps: 10 });
  await page.mouse.up();

  const after = await windowRect(page, '/about.txt');
  near(after.w, 200);
  near(after.h, 120);
});

test('clicking a background window brings it to the front without changing DOM order', async ({
  page,
}) => {
  await waitReady(page);
  const before = await page
    .locator('[data-window]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-window')));

  // /projects opened after /about.txt, so it's the one already on top.
  await page.locator('[data-window="/about.txt"] .titlebar').click();

  const after = await page
    .locator('[data-window]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-window')));
  expect(after).toEqual(before);

  const aboutZ = await page
    .locator('[data-window="/about.txt"]')
    .evaluate((el) => Number(getComputedStyle(el).zIndex));
  const projectsZ = await page
    .locator('[data-window="/projects"]')
    .evaluate((el) => Number(getComputedStyle(el).zIndex));
  expect(aboutZ).toBeGreaterThan(projectsZ);

  await expect(page.locator('[data-window="/about.txt"]')).toHaveAttribute('data-focused', 'true');
});

test('minimising hides a window; closing removes it and focus lands sensibly', async ({ page }) => {
  await waitReady(page);

  await page.locator('button[aria-label="Minimise about.txt"]').click();
  await expect(page.locator('[data-window="/about.txt"]')).toBeHidden();

  await page.locator('button[aria-label="Close projects"]').click();
  await expect(page.locator('[data-window="/projects"]')).toHaveCount(0);

  // The only window left is minimised, so there is no visible title to hand focus
  // to and no taskbar yet (Phase 10) — the desktop heading is Desktop.tsx's own
  // fallback for exactly this case.
  await expect(page.locator('h1.sr-only')).toBeFocused();
});

test('narrowing the browser viewport keeps every title bar reachable', async ({ page }) => {
  await waitReady(page);
  const desktop = await desktopBox(page);
  const start = await titlebarCenter(page, '/about.txt');

  // Drag it out near the right edge — clear of the snap zone — so shrinking the
  // viewport pushes it toward the new edge.
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(desktop.x + desktop.width - 60, start.y, { steps: 10 });
  await page.mouse.up();

  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(async () => {
    const narrowed = await desktopBox(page);
    expect(narrowed.width).toBeLessThan(desktop.width);
  }).toPass({ timeout: 2000 });

  // The rescue clamp (Task 9.4) runs off the same `ResizeObserver`, a tick behind
  // the viewport resize itself — poll rather than assume it's already landed.
  for (const path of ['/about.txt', '/projects']) {
    await expect(async () => {
      const narrowDesktop = await desktopBox(page);
      const box = await page.locator(`[data-window="${path}"] .titlebar`).boundingBox();
      if (!box) throw new Error(`missing titlebar for ${path}`);
      expect(box.x).toBeLessThan(narrowDesktop.x + narrowDesktop.width);
      expect(box.x + box.width).toBeGreaterThan(narrowDesktop.x);
      expect(box.y).toBeGreaterThanOrEqual(narrowDesktop.y - 1);
      expect(box.y).toBeLessThan(narrowDesktop.y + narrowDesktop.height);
    }).toPass({ timeout: 2000 });
  }
});

test('seed geometry is the same fraction of the desktop at 1440x900 and 2560x1440', async ({
  page,
  context,
}) => {
  await waitReady(page);
  const desktop1 = await desktopBox(page);
  const about1 = await windowRect(page, '/about.txt');
  const projects1 = await windowRect(page, '/projects');

  const page2 = await context.newPage();
  await page2.setViewportSize({ width: 2560, height: 1440 });
  await waitReady(page2);
  const desktop2 = await desktopBox(page2);
  const about2 = await windowRect(page2, '/about.txt');
  const projects2 = await windowRect(page2, '/projects');

  const fracsMatch = (
    a: { x: number; y: number; w: number; h: number },
    dA: number,
    dAh: number,
    b: { x: number; y: number; w: number; h: number },
    dB: number,
    dBh: number,
  ) => {
    near(a.x / dA, b.x / dB, 0.01);
    near(a.y / dAh, b.y / dBh, 0.01);
    near(a.w / dA, b.w / dB, 0.01);
    near(a.h / dAh, b.h / dBh, 0.01);
  };

  fracsMatch(about1, desktop1.width, desktop1.height, about2, desktop2.width, desktop2.height);
  fracsMatch(
    projects1,
    desktop1.width,
    desktop1.height,
    projects2,
    desktop2.width,
    desktop2.height,
  );

  await page2.close();
});
