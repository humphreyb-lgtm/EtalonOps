import { test, expect } from '@playwright/test';
for (const width of [390,1440]) test(`cloud sign-in gate cannot be bypassed with demo query parameters at ${width}px`, async ({ page }) => {
  const devSessions: string[] = [];
  page.on('request', req => { if (req.url().includes('/api/dev/session')) devSessions.push(req.url()); });
  await page.addInitScript(() => { window.__ETALONOPS_CONFIG__ = { tenant: '11111111-1111-4111-8111-111111111111', clientId: '22222222-2222-4222-8222-222222222222' }; });
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/?database=0&identity=admin');
  await expect(page.getByRole('heading', { name: 'Sign in to EtalonOps' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Microsoft', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save as Draft', exact: true })).toHaveCount(0);
  expect(devSessions).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
