import { expect, test, type Page } from '@playwright/test';
import { binNodes } from '../../src/fs/bin';
import { mounts } from '../../src/fs/mounts';

// The launch/continuity subsystem. 1440x900, same as `wm.spec.ts`, unless a test says
// otherwise.
const DESKTOP = { width: 1440, height: 900 };

test.use({ viewport: DESKTOP });

async function waitReady(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
}

async function launchIcon(page: Page, label: string): Promise<void> {
  await page.locator('.desktop-icon', { hasText: label }).first().dblclick();
}

test('desktop icons and taskbar launchers match the mount table', async ({ page }) => {
  await waitReady(page);

  // Spot check a few launcher/icon mounts rather than every mount: both
  // `DesktopIcons.tsx` and `Taskbar.tsx` are built from the same mount table, so
  // agreement on a sample is agreement on the mechanism.
  const spotChecks = ['about.txt', 'projects', 'resume.txt'];
  for (const name of spotChecks) {
    await expect(page.locator('.desktop-icon-label', { hasText: name })).toBeVisible();
    await expect(page.locator('.taskbar-launchers button', { hasText: name })).toBeVisible();
  }

  // Every mount flagged `icon: true` has a matching desktop icon, plus one per `/bin` app
  // flagged `icon` (the synthetic `/bin` mount itself carries no icon).
  const iconMounts = mounts.filter((m) => m.kind !== 'bin' && m.icon);
  const binIcons = binNodes.filter((n) => n.icon);
  await expect(page.locator('.desktop-icon')).toHaveCount(iconMounts.length + binIcons.length);
  for (const node of binIcons) {
    await expect(page.locator('.desktop-icon-label', { hasText: node.name })).toBeVisible();
  }
});

test('opening projects shows a folder window listing its children', async ({ page }) => {
  await waitReady(page);
  await launchIcon(page, 'projects');

  const folder = page.locator('[data-window="/projects"]');
  await expect(folder).toBeVisible();
  await expect(folder.locator('.folder-row-link', { hasText: 'aetherforge' })).toBeVisible();
});

test('opening aetherforge from the projects folder shows the body and the spec strip', async ({
  page,
}) => {
  await waitReady(page);
  await launchIcon(page, 'projects');

  // `aetherforge` is a directory (it nests a `roadmap.md`), so it opens a folder window;
  // its `readme.md` row carries the project's body and spec strip (a readme sorts first
  // in its directory's listing).
  await page
    .locator('[data-window="/projects"] .folder-row-link', { hasText: 'aetherforge' })
    .dblclick();

  const aetherforgeFolder = page.locator('[data-window="/projects/aetherforge"]');
  await expect(aetherforgeFolder).toBeVisible();
  await aetherforgeFolder.locator('.folder-row-link', { hasText: 'readme.md' }).dblclick();

  const content = page.locator('[data-window="/projects/aetherforge/readme.md"]');
  await expect(content).toBeVisible();
  await expect(content.locator('.prose')).not.toBeEmpty();
  // `projectStrip` (`src/fs/tree.ts`) renders `STATUS · PERIOD · ROLE` in uppercase from
  // the entry's frontmatter (`status: wip`, `period.start: 2026`,
  // `period.end: present`, `role: Solo builder`).
  await expect(content.locator('.spec-strip')).toHaveText('WIP · 2026–PRESENT · SOLO BUILDER');
});

test('a link inside a content window follows on the first click', async ({ page }) => {
  await waitReady(page);
  await launchIcon(page, 'projects');
  await page
    .locator('[data-window="/projects"] .folder-row-link', { hasText: 'aetherforge' })
    .dblclick();
  await page
    .locator('[data-window="/projects/aetherforge"] .folder-row-link', { hasText: 'readme.md' })
    .dblclick();

  // Pressing the link focuses it, which raises the window and re-renders it. If that
  // re-render re-set the body's HTML, the link was gone by pointerup and no click fired.
  await page
    .locator('[data-window="/projects/aetherforge/readme.md"] .prose a', { hasText: 'roadmap' })
    .click();
  await expect(page).toHaveURL(/\/projects\/aetherforge\/roadmap\/$/);
});

test('the LinkedIn and GitHub icons open their profiles in a new tab', async ({ page }) => {
  await waitReady(page);
  for (const [label, url] of [
    ['linkedin.url', 'https://www.linkedin.com/in/joseph-m-valdez/'],
    ['github.url', 'https://github.com/jmvaldez'],
  ] as const) {
    // Stops the popup at the network, so the test never reaches the real site.
    await page.context().route(url + '**', (route) => route.fulfill({ body: '' }));
    const popup = page.waitForEvent('popup');
    await launchIcon(page, label);
    expect((await popup).url()).toBe(url);
  }
  await expect(page).toHaveURL(/\/$/);
});

test('a node with no URL opens a window with no maximise box', async ({ page }) => {
  await waitReady(page);
  // `/bin` has neither an icon nor a launcher, so `readme.txt` stands in for "a node
  // with no URL": it is a `text` mount, and `text` nodes never carry a `url`.
  await launchIcon(page, 'readme.txt');

  const win = page.locator('[data-window="/readme.txt"]');
  await expect(win).toBeVisible();
  await expect(win.locator('.maxbox')).toHaveCount(0);
});

test('a maximise box click names exactly one element page-frame and lands on the page', async ({
  page,
}) => {
  await waitReady(page);

  // The name is applied synchronously in the click handler, right before the real `<a>`
  // navigation, so it can't be read back from this page: the navigation tears the DOM
  // down in the same tick. A `pagehide` listener runs after the click handler and before
  // the old document is gone; it stashes the count in `sessionStorage`, which survives
  // the same-tab, same-origin navigation, for the next page to read.
  await page.evaluate(() => {
    window.addEventListener('pagehide', () => {
      const named = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
        (el) => el.style.viewTransitionName === 'page-frame',
      );
      sessionStorage.setItem('e2e:namedCount', String(named.length));
    });
  });

  await page.locator('[data-window="/about.txt"] .maxbox').click();
  await expect(page).toHaveURL(/\/about\/?$/);

  const namedCount = await page.evaluate(() => sessionStorage.getItem('e2e:namedCount'));
  expect(namedCount).toBe('1');
});

test('the close box returns to / with the restored window count and layout', async ({ page }) => {
  await waitReady(page);

  const before = await page.locator('[data-window]').evaluateAll((els) => els.length);

  await page.locator('[data-window="/about.txt"] .maxbox').click();
  await expect(page).toHaveURL(/\/about\/?$/);

  await page.locator('a[aria-label="Return to home"]').click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });

  await expect(page.locator('#restore-line')).toHaveText(
    new RegExp(`RESUME · ${before} WINDOWS? RESTORED`),
  );
  await expect(page.locator('[data-window]')).toHaveCount(before);
});

test('a fresh browser context gets the seed layout, not a restored one', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize(DESKTOP);
  await waitReady(page);

  await expect(page.locator('html')).not.toHaveClass(/restore/);
  await expect(page.locator('[data-window="/about.txt"]')).toBeVisible();
  await expect(page.locator('[data-window="/projects"]')).toBeVisible();

  await context.close();
});

test('the resume.pdf icon downloads without navigating away from /', async ({ page }) => {
  await waitReady(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    launchIcon(page, 'resume.pdf'),
  ]);
  expect(download.suggestedFilename()).toBe('joe-valdez-resume.pdf');

  expect(new URL(page.url()).pathname).toBe('/');
});

test('the shell never touches the URL for desktop-only interaction', async ({ page }) => {
  await waitReady(page);

  await launchIcon(page, 'projects');
  await page.locator('button[aria-label="Minimise projects"]').click();
  // A minimised window's own title bar (and its Close button) is `display: none` —
  // restore it via its taskbar button first, matching how a visitor would actually
  // reach Close again, rather than clicking a hidden control.
  await page.locator('.taskbar-windows button', { hasText: 'projects' }).click();
  await page.locator('button[aria-label="Close projects"]').click();
  await launchIcon(page, 'about.txt');

  expect(new URL(page.url()).pathname).toBe('/');
});
