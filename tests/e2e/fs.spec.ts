import { expect, test } from '@playwright/test';

test('a rendered body is served as static HTML', async ({ request }) => {
  const response = await request.get('/fs/body/projects/orbital-mesh/readme.md.html');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('<h2');
});

test('a raw source file is served with its frontmatter intact', async ({ request }) => {
  const response = await request.get('/fs/src/about.txt.txt');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body.startsWith('---')).toBe(true);
  expect(body).toContain('type: page');
});
