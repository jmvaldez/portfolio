import { expect, test, type Page } from '@playwright/test';
import { mounts } from '../../src/fs/mounts';

// The launch/continuity subsystem (ticket 09 § The transition, § State across the
// round trip; ticket 05 § Terminal and desktop surfaces; Task 10.3). 1440x900, same
// as `wm.spec.ts`, unless a test says otherwise.
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

  // Spot check a few of D11's launcher/icon mounts (`about.txt`, `projects`,
  // `resume.txt`) rather than every mount — the mount table itself is what both
  // `DesktopIcons.tsx` and `Taskbar.tsx` are built from (ticket 05: "derived from
  // the same mount table... cannot disagree"), so agreement on a sample is
  // agreement on the mechanism.
  const spotChecks = ['about.txt', 'projects', 'resume.txt'];
  for (const name of spotChecks) {
    await expect(page.locator('.desktop-icon-label', { hasText: name })).toBeVisible();
    await expect(page.locator('.taskbar-launchers button', { hasText: name })).toBeVisible();
  }

  // Every mount flagged `icon: true` (other than the synthetic `/bin` mount, which
  // carries no icon at all) has a matching desktop icon.
  const iconMounts = mounts.filter((m) => m.kind !== 'bin' && m.icon);
  await expect(page.locator('.desktop-icon')).toHaveCount(iconMounts.length);
});

test('opening projects shows a folder window listing its children', async ({ page }) => {
  await waitReady(page);
  await launchIcon(page, 'projects');

  const folder = page.locator('[data-window="/projects"]');
  await expect(folder).toBeVisible();
  await expect(folder.locator('.folder-row-link', { hasText: 'orbital-mesh' })).toBeVisible();
});

test('opening orbital-mesh from the projects folder shows the body and the spec strip', async ({
  page,
}) => {
  await waitReady(page);
  await launchIcon(page, 'projects');

  // `orbital-mesh` is a directory (it nests a `notes.md`, D5), so it opens a folder
  // window of its own; its `readme.md` row is the one carrying the project's body
  // and spec strip (D10: a readme sorts first in its directory's listing).
  await page
    .locator('[data-window="/projects"] .folder-row-link', { hasText: 'orbital-mesh' })
    .dblclick();

  const orbitalFolder = page.locator('[data-window="/projects/orbital-mesh"]');
  await expect(orbitalFolder).toBeVisible();
  await orbitalFolder.locator('.folder-row-link', { hasText: 'readme.md' }).dblclick();

  const content = page.locator('[data-window="/projects/orbital-mesh/readme.md"]');
  await expect(content).toBeVisible();
  await expect(content.locator('.prose')).not.toBeEmpty();
  // `projectStrip` (`src/fs/tree.ts`): `STATUS · PERIOD · ROLE`, uppercase — the
  // entry's own frontmatter is `status: wip`, `period.start: 2025-03`,
  // `period.end: present`, `role: Lead engineer`.
  await expect(content.locator('.spec-strip')).toHaveText('WIP · 2025–PRESENT · LEAD ENGINEER');
});

test('a node with no URL opens a window with no maximise box', async ({ page }) => {
  await waitReady(page);
  // `/bin` has neither an icon nor a launcher in this phase (no terminal yet to
  // browse into it, Phase 11) — `readme.txt` is the desktop's own reachable stand-in
  // for "a node with no URL": a `text` mount, and `text` nodes never carry a `url`
  // (D12), same as `/bin`'s own children would.
  await launchIcon(page, 'readme.txt');

  const win = page.locator('[data-window="/readme.txt"]');
  await expect(win).toBeVisible();
  await expect(win.locator('.maxbox')).toHaveCount(0);
});

test('a maximise box click names exactly one element page-frame and lands on the page', async ({
  page,
}) => {
  await waitReady(page);

  // The name is applied synchronously in the click handler, immediately before the
  // real `<a>` navigation (ticket 09 § The transition), so it can't be read back
  // from *this* page once the click has fired — the navigation tears the DOM down
  // in the same tick. A `pagehide` listener is the one hook that's guaranteed to
  // run after the click handler and before the old document is gone; it stashes
  // the count in `sessionStorage`, which survives the navigation (same tab, same
  // origin), for the next page to read back.
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
  await page.locator('button[aria-label="Close projects"]').click();
  await launchIcon(page, 'about.txt');

  expect(new URL(page.url()).pathname).toBe('/');
});
