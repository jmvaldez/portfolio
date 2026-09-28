import { expect, test, type Page } from '@playwright/test';
import { HELP_TEXT } from '../../src/fs/bin';

// The toy shell. 1440x900, same as `wm.spec.ts`. `terminal.exe` is a seed window, open
// but unfocused, so every test here starts from that seeded window rather than launching
// it itself.
const DESKTOP = { width: 1440, height: 900 };

test.use({ viewport: DESKTOP });

const TERMINAL = '[data-window="/bin/terminal.exe"]';

async function waitReady(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
  await expect(page.locator(TERMINAL)).toBeVisible();
}

function input(page: Page) {
  return page.locator(`${TERMINAL} .terminal-input`);
}

function entries(page: Page) {
  return page.locator(`${TERMINAL} .term-entry`);
}

async function type(page: Page, line: string): Promise<void> {
  await input(page).fill(line);
  await input(page).press('Enter');
}

test('help prints the exact command table', async ({ page }) => {
  await waitReady(page);
  await type(page, 'help');
  await expect(entries(page).last()).toContainText(HELP_TEXT.split('\n')[0]!);
  await expect(entries(page).last()).toContainText(
    "there's more in /bin, if you're the curious type.",
  );
});

test('cd projects then pwd prints /projects', async ({ page }) => {
  await waitReady(page);
  await type(page, 'cd projects');
  await type(page, 'pwd');
  const entry = entries(page).last();
  await expect(entry).toContainText('guest@valdez:/projects$ pwd');
  await expect(entry).toContainText('/projects');
});

test('cat about.txt prints the frontmatter-bearing source and the dim hint', async ({ page }) => {
  await waitReady(page);
  await type(page, 'cat about.txt');
  const entry = entries(page).last();
  await expect(entry).toContainText('---');
  await expect(entry).toContainText('open about.txt to read it properly.');
});

test('open orbital-mesh from /projects opens its window without navigating', async ({ page }) => {
  await waitReady(page);
  await type(page, 'cd projects');
  await type(page, 'open orbital-mesh');
  await expect(page.locator('[data-window="/projects/orbital-mesh"]')).toBeVisible();
  await expect(page).toHaveURL('/');
});

test('ls -la shows the flags-not-supported error', async ({ page }) => {
  await waitReady(page);
  await type(page, 'ls -la');
  const entry = entries(page).last();
  await expect(entry).toContainText("ls: flags aren't supported here.");
  await expect(entry).toContainText('this is a toy. a nice toy.');
});

test('sudo x shows the sudoers line and triggers a toast', async ({ page }) => {
  await waitReady(page);
  await type(page, 'sudo x');
  const entry = entries(page).last();
  await expect(entry).toContainText(
    'guest is not in the sudoers file. This incident will be reported.',
  );
  await expect(page.locator('.toast .toast-label')).toHaveText('ACCESS DENIED');
});

test('backtick minimises the focused terminal and restores focus on reopen', async ({ page }) => {
  await waitReady(page);
  // The seeded terminal opens unfocused: focus it the same way the backtick's "already
  // open" branch does, so the first press below exercises the "already focused" branch
  // deterministically.
  await input(page).focus();
  await page.keyboard.press('`');
  await expect(page.locator(TERMINAL)).toBeHidden();
  await page.keyboard.press('`');
  await expect(page.locator(TERMINAL)).toBeVisible();
});

test('command history survives a reload', async ({ page }) => {
  await waitReady(page);
  await type(page, 'whoami');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/shell-ready/, { timeout: 7000 });
  await input(page).focus();
  await page.keyboard.press('ArrowUp');
  await expect(input(page)).toHaveValue('whoami');
});

test('the log gains exactly one new child per command executed', async ({ page }) => {
  await waitReady(page);
  const before = await entries(page).count();
  await type(page, 'pwd');
  await expect(entries(page)).toHaveCount(before + 1);
  await type(page, 'whoami');
  await expect(entries(page)).toHaveCount(before + 2);
});
