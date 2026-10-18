import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`database save/resume, date overrides, original input and cross-session ownership at ${width}px`, async ({ page, request, browser }) => {
    const identity = width === 1440 ? 'foreman-one' : 'foreman-two';
    const { token } = await (await request.post('http://127.0.0.1:3002/api/dev/session', { data: { identity } })).json();
    const headers = { Authorization: `Bearer ${token}` };
    const { draft } = await (await request.get('http://127.0.0.1:3002/api/projects/riverside/draft', { headers })).json();
    if (draft) expect((await request.put(`http://127.0.0.1:3002/api/drafts/${draft.id}`, { headers, data: { projectId: 'riverside', deliveryDate: '2026-11-10', version: draft.version, lines: [] } })).ok()).toBe(true);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/?database=1&identity=${identity}`);
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
    await page.getByLabel('MRF Delivery Date', { exact: true }).fill('2026-11-10');
    await page.getByLabel('Quantity', { exact: true }).fill('1000');
    await page.getByLabel('Unit', { exact: true }).selectOption('FT');
    await page.getByLabel('Description', { exact: true }).fill('1" PVC');
    await page.getByRole('button', { name: 'Find Matches' }).click();
    await page.getByRole('button', { name: 'Add 1 in. PVC conduit, Schedule 40', exact: true }).click();
    await page.getByRole('button', { name: 'Add 1 in. PVC conduit, Schedule 80', exact: true }).click();
    await page.getByLabel('Delivery mode for item 2', { exact: true }).selectOption('override');
    await page.getByLabel('Delivery override for item 2', { exact: true }).fill('2026-11-15');
    await page.getByLabel('MRF Delivery Date', { exact: true }).fill('2026-11-12');
    await page.getByRole('button', { name: 'Save as Draft' }).click();
    await expect(page.getByText('Saved in local database', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Demo session menu' }).click();
    await page.getByRole('button', { name: 'Leave demo' }).click();
    await page.getByRole('button', { name: 'Resume demo' }).click();
    await expect(page.getByTestId('mrf-line')).toHaveCount(2);
    await expect(page.getByLabel('Delivery override for item 2', { exact: true })).toHaveValue('2026-11-15');
    await expect(page.getByTestId('effective-date')).toHaveText('Nov 12, 2026');
    await page.getByText('Original input', { exact: true }).first().click();
    await expect(page.getByTestId('mrf-line').first()).toContainText('1000 FT · 1" PVC');
    // A completely new browser context has no localStorage or in-memory token.
    const second = await browser.newContext();
    try {
      const fresh = await second.newPage();
      await fresh.goto(`http://127.0.0.1:5174/?database=1&identity=${identity}`);
      await expect(fresh.getByTestId('mrf-line')).toHaveCount(2);
      expect(await fresh.evaluate(() => Object.keys(localStorage).filter(k => /token/i.test(k)))).toEqual([]);
    } finally { await second.close(); }
    const { token: otherToken } = await (await request.post('http://127.0.0.1:3002/api/dev/session', { data: { identity: 'admin' } })).json();
    const saved = await (await request.get('http://127.0.0.1:3002/api/projects/riverside/draft', { headers })).json();
    expect((await request.get(`http://127.0.0.1:3002/api/drafts/${saved.draft.id}`, { headers: { Authorization: `Bearer ${otherToken}` } })).status()).toBe(404);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('Northside date-only draft and selected project survive reload independently of Riverside', async ({ page }) => {
  await page.goto('/?database=1&identity=foreman-one');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Project', { exact: true }).selectOption('northside');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('MRF Delivery Date', { exact: true }).fill('2026-12-19');
  await page.getByRole('button', { name: 'Save as Draft', exact: true }).click();
  await expect(page.getByText('Saved in local database', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByLabel('Project', { exact: true })).toHaveValue('northside');
  await expect(page.getByLabel('MRF Delivery Date', { exact: true })).toHaveValue('2026-12-19');
  await page.getByLabel('Project', { exact: true }).selectOption('riverside');
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByLabel('MRF Delivery Date', { exact: true })).not.toHaveValue('2026-12-19');
});
