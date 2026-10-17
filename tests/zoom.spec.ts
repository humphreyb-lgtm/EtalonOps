import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// Set Chromium's native default zoom preference in an isolated test profile.
// This does not use CSS zoom, emulated device scale, or an extension.
test('actual 200% browser zoom retains readable task controls and working conversation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'etalonops-zoom-'));
  const profile = join(dir, 'profile');
  await mkdir(join(profile, 'Default'), { recursive: true });
  // Chromium stores levels in a partition-keyed dictionary; the default
  // partition key is "x". Reference: chromium/chromium,
  // chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc.
  await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(2) / Math.log(1.2) } } }));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
    viewport: null,
    args: ['--window-size=1440,1080'],
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5174');
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(720);
    expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
    await page.getByLabel('Quantity', { exact: true }).fill('200');
    await page.getByLabel('Unit', { exact: true }).selectOption('EA');
    await page.getByLabel('Description', { exact: true }).fill('self tappers');
    await page.getByRole('button', { name: 'Find Matches' }).click();
    await page.getByLabel(/Other \/ none of these/).check();
    await page.getByLabel('Tell the assistant what you are looking for').fill('Black device mounting screws');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByRole('button', { name: 'Add Black 6-32 device mounting screws', exact: true }).click();
    await page.getByLabel('Delivery mode for item 1', { exact: true }).selectOption('override');
    await page.getByLabel('Delivery override for item 1', { exact: true }).fill('2026-11-15');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mkdir('artifacts/screenshots', { recursive: true });
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await page.screenshot({ path: 'artifacts/screenshots/200-percent-browser-zoom.png', fullPage: true });
    await expect(page.getByTestId('mrf-line')).toHaveCount(1);
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
});
