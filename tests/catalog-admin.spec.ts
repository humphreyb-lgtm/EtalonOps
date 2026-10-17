import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390,1440]) test(`admin previews, explicitly approves, exports and rolls back a catalog batch at ${width}px`, async ({ page, request }) => {
  const row = (parse(readFileSync('db/fixtures/catalog.csv','utf8'),{columns:true}) as Record<string,string>[])[0];
  const key = `admin-browser-${randomUUID()}`;
  row.external_key=key;row.description='Fictional browser administration regression';row.aliases_json=JSON.stringify([key]);
  const csv=stringify([row],{header:true});
  await page.setViewportSize({width,height:1000});
  await page.goto('/?database=1&identity=admin');
  await page.getByRole('button',{name:'Catalog administration',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Catalog administration'});
  await page.getByLabel('Choose CSV file (maximum 500 KB)',{exact:true}).setInputFiles({name:'review.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.getByLabel('CSV contents',{exact:true})).toHaveValue(csv);
  const previewResponse=page.waitForResponse(r=>r.url().endsWith('/admin/imports/preview')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Preview import',exact:true}).click();
  expect((await previewResponse).ok()).toBe(true);
  await expect(page.getByRole('region',{name:'Import preview'})).toContainText(row.description);
  const apply=page.getByRole('button',{name:'Apply reviewed batch',exact:true});
  await expect(apply).toBeDisabled();
  mkdirSync('artifacts/screenshots', { recursive: true });
  await dialog.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: `artifacts/screenshots/${width}-catalog-admin-preview.png`, fullPage: true });
  await page.getByLabel('I reviewed this batch, its aliases, units and source evidence.').check();
  await expect(apply).toBeEnabled();
  await page.getByLabel('CSV contents',{exact:true}).fill(csv+'\n');
  await expect(apply).toHaveCount(0);
  await page.getByRole('button',{name:'Preview import',exact:true}).click();
  await page.getByLabel('I reviewed this batch, its aliases, units and source evidence.').check();
  // Whitespace changes are a different hash, so capture the actual reviewed batch.
  await apply.click();
  await expect(dialog).toContainText('Reviewed batch applied. No images were approved.');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export active catalog',exact:true}).click();
  const download=await downloadPromise;
  expect(readFileSync((await download.path())!,'utf8')).toContain(key);
  const {token}=await (await request.post('http://127.0.0.1:3002/api/dev/session',{data:{identity:'admin'}})).json();
  const headers={Authorization:`Bearer ${token}`};
  // Identify our applied batch from its content hash rather than another worker's history.
  const applied=await (await request.post('http://127.0.0.1:3002/api/admin/imports/preview',{headers,data:{csv:csv+'\n'}})).json();
  expect(applied.state).toBe('applied');
  const rowElement=dialog.locator('.catalog-history-row').filter({hasText:applied.id});
  await rowElement.getByRole('button',{name:'Review rollback',exact:true}).click();
  await expect(page.getByRole('group',{name:'Confirm catalog rollback'})).toContainText('historical');
  await page.getByRole('button',{name:'Deactivate batch',exact:true}).click();
  await expect(rowElement).toContainText('rolled_back');
  const search=await request.get(`http://127.0.0.1:3002/api/materials?q=${encodeURIComponent(key)}`,{headers});
  expect((await search.json()).matches).toEqual([]);
  const accessibility=await new AxeBuilder({page}).include('.catalog-modal').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Close catalog administration',exact:true}).click();
  await expect(page.getByRole('button',{name:'Catalog administration',exact:true})).toBeFocused();
});

test('foreman cannot open catalog administration',async({page,request})=>{
  await page.goto('/?database=1&identity=foreman-one');
  await expect(page.locator('main')).toHaveAttribute('aria-busy','false');
  await expect(page.getByRole('button',{name:'Catalog administration',exact:true})).toHaveCount(0);
  const {token}=await(await request.post('http://127.0.0.1:3002/api/dev/session',{data:{identity:'foreman-one'}})).json();
  expect((await request.get('http://127.0.0.1:3002/api/admin/imports',{headers:{Authorization:`Bearer ${token}`}})).status()).toBe(403);
});
