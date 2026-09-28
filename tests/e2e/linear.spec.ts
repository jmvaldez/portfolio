import { expect, test } from '@playwright/test';

// The linear layout: `/`'s one long scroll, exercised at the mobile and desktop
// viewports where it is meant to look identical (one max-width from phone to wide
// screen; the reading order never changes with width).

const SECTIONS = ['about', 'projects', 'drones', 'resume', 'contact'];

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`linear layout at ${name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test('Sections appear in mount-table order: about, projects, drones, resume, contact', async ({
      page,
    }) => {
      await page.goto('/');
      const ids = await page
        .locator('#linear > section')
        .evaluateAll((els) => els.map((el) => el.id));
      expect(ids).toEqual(SECTIONS);
    });

    test('each Section id equals its section name', async ({ page }) => {
      await page.goto('/');
      for (const id of SECTIONS) {
        await expect(page.locator(`section#${id}`)).toHaveCount(1);
      }
    });

    test('every Section has exactly one maximise link named "Open <title> page"', async ({
      page,
    }) => {
      // Above the breakpoint with JS on, the shell hides `#linear` (`html.shell`), and a
      // hidden element has no computed accessible name. The layout override keeps the
      // linear layout visible, which is also how it works as the conforming alternate
      // version.
      await page.addInitScript(() => localStorage.setItem('vos:layout-override', 'linear'));
      await page.goto('/');
      for (const id of SECTIONS) {
        const maxbox = page.locator(`section#${id} .maxbox`);
        await expect(maxbox).toHaveCount(1);
        await expect(maxbox).toHaveAccessibleName(/^Open .+ page$/);
      }
    });

    test('the Contents listing inside a Section has no maximise link of its own', async ({
      page,
    }) => {
      // Negative case for the "iff the node has a URL" rule: the folder rows a Section
      // renders (plain links via FolderListing) are not maximise boxes themselves.
      await page.goto('/');
      const projectRows = page.locator('section#projects .folder-listing .maxbox');
      await expect(projectRows).toHaveCount(0);
    });

    test('taskbar launchers point at their matching #<section> anchor', async ({ page }) => {
      await page.goto('/');
      for (const id of SECTIONS) {
        const link = page.locator(`nav[aria-label="Taskbar"] a[href="#${id}"]`);
        await expect(link).toHaveCount(1);
      }
    });

    test('the drone SVG renders inside the drones Section', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('section#drones svg[role="img"]')).toHaveCount(1);
    });

    test('no horizontal scroll', async ({ page }) => {
      await page.goto('/');
      const overflowing = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflowing).toBe(false);
    });
  });
}

test('a Section’s max-width is identical at mobile and desktop (single column, no breakpoint)', async ({
  browser,
}) => {
  const maxWidths: string[] = [];
  for (const viewport of Object.values(VIEWPORTS)) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto('/');
    const maxWidth = await page
      .locator('section#about')
      .evaluate((el) => getComputedStyle(el).maxWidth);
    maxWidths.push(maxWidth);
    await context.close();
  }
  expect(maxWidths[0]).toBe(maxWidths[1]);
});

test('/ renders every Section with JavaScript disabled', async ({ browser }) => {
  // The linear layout is genuinely zero-JS, not merely "no-JS as a fallback": proven
  // directly rather than inferred from zero-js.spec.ts's static-HTML byte check.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  for (const id of SECTIONS) {
    await expect(page.locator(`section#${id}`)).toHaveCount(1);
  }
  await context.close();
});
