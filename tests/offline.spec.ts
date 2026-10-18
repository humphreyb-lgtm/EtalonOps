import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('downloadable preview runs as one document with no external assets or requests', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  // This managed browser blocks file:// navigation. Serve the unchanged HTML as
  // the only allowed response; do not weaken browser policy to open local files.
  const html = await readFile('artifacts/EtalonOps-preview.html', 'utf8');
  await page.route('**/*', async route => {
    if (new URL(route.request().url()).pathname === '/standalone-review') await route.fulfill({ contentType: 'text/html', body: html });
    else await route.abort();
  });
  await page.goto('/standalone-review');
  await page.getByRole('button', { name: 'self tappers', exact: true }).click();
  await page.getByRole('button', { name: 'Find Matches' }).click();
  await page.getByLabel(/Other \/ none of these/).check();
  await page.getByLabel('Tell the assistant what you are looking for').fill('Black device screws');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.getByRole('button', { name: 'Add Black 6-32 device mounting screws', exact: true }).click();
  await page.getByRole('button', { name: 'Save as Draft', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('mrf-line')).toHaveCount(1);
  await expect(page.getByTestId('mrf-line')).toContainText('Black 6-32 device mounting screws');
  expect(requests).toHaveLength(2);expect(requests.every(url=>new URL(url).pathname==='/standalone-review')).toBe(true);
  expect(errors).toEqual([]);
});
