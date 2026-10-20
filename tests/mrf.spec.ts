import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

async function search(page: Page, description = '1" PVC', unit = 'FT', quantity = '1000') {
  await page.getByLabel('Quantity', { exact: true }).fill(quantity);
  if (unit) await page.getByLabel('Unit', { exact: true }).selectOption(unit);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Find Matches', exact: true }).click();
}

async function addPVC(page: Page) {
  await search(page);
  await page.getByRole('button', { name: 'Add 1 in. PVC conduit, Schedule 40', exact: true }).click();
  await expect(page.getByTestId('mrf-line')).toHaveCount(1);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => ({ width: window.innerWidth, content: document.documentElement.scrollWidth }))).toEqual({ width: page.viewportSize()!.width, content: page.viewportSize()!.width });
  for (const button of await page.getByRole('button', { name: /^Add / }).all()) {
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
}

for (const width of [1440, 390, 320]) {
  test.describe(`Core workflow at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });
    test.beforeEach(async ({ page }) => { await page.goto('/'); });

    test('requires explicit units, adds exact row once, edits and removes without changing original input', async ({ page }) => {
      await search(page, '1" PVC', '');
      await page.getByRole('button', { name: 'Add 1 in. PVC conduit, Schedule 40', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Choose your quantity unit');
      await expect(page.getByTestId('mrf-line')).toHaveCount(0);
      await page.getByLabel('Unit', { exact: true }).selectOption('FT');
      const add = page.getByRole('button', { name: 'Add 1 in. PVC conduit, Schedule 40', exact: true });
      await add.dblclick();
      await expect(page.getByTestId('mrf-line')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Added 1 in. PVC conduit, Schedule 40', exact: true })).toBeDisabled();
      await expect(page.getByTestId('mrf-line')).toContainText('1000');
      await expect(page.getByTestId('mrf-line')).toContainText('FT');
      await page.getByRole('button', { name: 'Edit item 1', exact: true }).click();
      await page.getByLabel('Material description', { exact: true }).fill('1 in. PVC conduit — confirm length on site');
      await page.getByLabel('Quantity', { exact: true }).last().fill('250');
      await page.getByRole('button', { name: 'Save item changes' }).click();
      await expect(page.getByRole('button', { name: 'Edit item 1', exact: true })).toBeFocused();
      await expect(page.getByTestId('mrf-line')).toContainText('250');
      await expect(page.getByText('Original input',{exact:true})).toHaveCount(0);
      await page.getByRole('button', { name: 'Remove item 1', exact: true }).click();
      await page.getByRole('button', { name: 'Keep item' }).click();
      await expect(page.getByTestId('mrf-line')).toHaveCount(1);
      await page.getByRole('button', { name: 'Remove item 1', exact: true }).click();
      await page.getByRole('button', { name: 'Remove item', exact: true }).click();
      await expect(page.getByTestId('mrf-line')).toHaveCount(0);
      await noOverflow(page);
    });

    test('uses a compact manual fallback when catalog matches are unsuitable', async ({page})=>{
      await search(page);await page.getByRole('button',{name:'None of these is what I want'}).click();await expect(page.getByRole('region',{name:'No match found',exact:true})).toBeVisible();await page.getByLabel('Description to add',{exact:true}).fill('Special conduit for room 201');await page.getByRole('button',{name:'Add to MRF',exact:true}).click();await expect(page.getByTestId('mrf-line')).toHaveCount(1);await expect(page.getByTestId('mrf-line')).toContainText('Special conduit for room 201');await expect(page.getByTestId('mrf-line')).toContainText('Your description');await noOverflow(page);
    });

    test('preserves inherited and overridden dates across save, leave and resume', async ({ page }) => {
      await page.getByLabel('MRF Delivery Date', { exact: true }).fill('2026-11-10');
      await addPVC(page);
      await page.getByRole('button', { name: 'Add 1 in. PVC conduit, Schedule 80', exact: true }).click();
      await page.getByLabel('Delivery mode for item 2', { exact: true }).selectOption('override');
      await page.getByLabel('Delivery override for item 2', { exact: true }).fill('2026-11-15');
      await page.getByLabel('MRF Delivery Date', { exact: true }).fill('2026-11-12');
      await expect(page.getByTestId('effective-date')).toHaveText('Nov 12, 2026');
      await expect(page.getByLabel('Delivery override for item 2', { exact: true })).toHaveValue('2026-11-15');
      await page.getByRole('button', { name: 'Save as Draft', exact: true }).click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('etalonops:demo:v1:riverside')!));
      expect(saved.lines[0].deliveryMode).toBe('inherit');
      expect(saved.lines[0].overrideDate).toBeNull();
      expect(saved.lines[1].deliveryMode).toBe('override');
      expect(saved.lines[1].rawInput.description).toBe('1" PVC');
      await page.getByRole('button', { name: 'Demo session menu' }).click();
      await page.getByRole('button', { name: 'Leave demo' }).click();
      await page.getByRole('button', { name: 'Resume demo' }).click();
      await expect(page.getByTestId('mrf-line')).toHaveCount(2);
      await expect(page.getByLabel('Delivery override for item 2', { exact: true })).toHaveValue('2026-11-15');
      await page.getByLabel('Delivery mode for item 2', { exact: true }).selectOption('inherit');
      await expect(page.getByTestId('effective-date')).toHaveCount(2);
      await expect(page.getByLabel('Delivery override for item 2', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Save as Draft', exact: true }).click();
      await page.reload();
      await expect(page.getByTestId('mrf-line')).toHaveCount(2);
      await expect(page.getByTestId('effective-date').nth(1)).toHaveText('Nov 12, 2026');
      await noOverflow(page);
    });
  });
}

test('invalid input is recoverable; storage failure retains the draft', async ({ page }) => {
  await page.goto('/');
  await search(page, 'PVC', 'FT', '-20');
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await addPVC(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Save as Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not save');
  await expect(page.getByTestId('mrf-line')).toHaveCount(1);
  await page.getByRole('button', { name: 'Demo session menu' }).click();
  await page.getByRole('button', { name: 'Leave demo' }).click();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('dialog', { name: 'Save your draft first?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay here' }).click();
  await expect(page.getByTestId('mrf-line')).toHaveCount(1);
});

test('project switching offers save and preserves separate local drafts', async ({ page }) => {
  await page.goto('/');
  await addPVC(page);
  await page.getByLabel('Project', { exact: true }).selectOption('northside');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByTestId('mrf-line')).toHaveCount(0);
  await page.getByLabel('Project', { exact: true }).selectOption('riverside');
  await expect(page.getByTestId('mrf-line')).toHaveCount(1);
});

test('corrupt local data is not silently deleted', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('etalonops:demo:v1:riverside', '{invalid json'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('has not been deleted');
  expect(await page.evaluate(() => localStorage.getItem('etalonops:demo:v1:riverside'))).toBe('{invalid json');
  await search(page);
  await expect(page.getByRole('heading', { name: 'Material matches' })).toBeVisible();
});

test('mobile navigation is keyboard accessible and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Project', { exact: true })).toBeFocused();
});

test('keyboard-only search and addition work', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Quantity', { exact: true }).focus();
  await page.keyboard.type('100');
  await page.keyboard.press('Tab');
  await page.keyboard.press('e');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1" PVC');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Add 1 in. PVC conduit, Schedule 40', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('mrf-line')).toHaveCount(1);
});

test('empty and edit states pass automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Add MRF Item' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await addPVC(page);
  await page.getByRole('button', { name: 'Edit item 1', exact: true }).click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit item 1', exact: true })).toBeFocused();
});

test.describe('Touch interaction', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('manual fallback stays usable with limited vertical space',async({page})=>{
    await page.goto('/');await search(page,'self tappers','EA','200');await page.setViewportSize({width:390,height:400});await page.getByLabel('Description to add',{exact:true}).fill('Black device screws');await page.getByRole('button',{name:'Add to MRF',exact:true}).tap();await expect(page.getByTestId('mrf-line')).toHaveCount(1);await noOverflow(page);
  });
});

for(const width of [320,375,390,768,1440,844,1024])test(`responsive captures and accessibility at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===844?390:1080});await page.goto('/');await addPVC(page);await search(page,'unlisted special screws','EA','200');await expect(page.getByRole('region',{name:'No match found',exact:true})).toBeVisible();await noOverflow(page);await mkdir('/tmp/v33-screenshots',{recursive:true});await page.screenshot({path:`/tmp/v33-screenshots/${width}-manual-fallback.png`,fullPage:true});expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.getByLabel('Description to add',{exact:true}).fill('Special screws, room 201');await page.getByRole('button',{name:'Add to MRF',exact:true}).click();await expect(page.getByTestId('mrf-line')).toHaveCount(2);await page.getByLabel('Delivery mode for item 2',{exact:true}).selectOption('override');await page.getByLabel('Delivery override for item 2',{exact:true}).fill('2026-11-15');await noOverflow(page);
});
