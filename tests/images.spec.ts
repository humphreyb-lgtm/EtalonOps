import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync,mkdirSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
for(const width of [390,1440])test(`admin image review, foreman visibility, replacement and rejection at ${width}px`,async({page,request,browser})=>{
  const key=`image-ui-${randomUUID()}`,description=`Fictional image-review fixture ${key.slice(-8)}`;
  const row=(parse(readFileSync('db/fixtures/catalog.csv','utf8'),{columns:true}) as Record<string,string>[])[0];row.external_key=key;row.description=description;row.aliases_json=JSON.stringify([key]);
  const {token}=await(await request.post('http://127.0.0.1:3002/api/dev/session',{data:{identity:'admin'}})).json();const headers={Authorization:`Bearer ${token}`};
  const preview=await(await request.post('http://127.0.0.1:3002/api/admin/imports/preview',{headers,data:{csv:stringify([row],{header:true})}})).json();
  expect((await request.post(`http://127.0.0.1:3002/api/admin/imports/${preview.id}/apply`,{headers,data:{approval:'I reviewed this batch'}})).ok()).toBe(true);
  const bytes=await sharp({create:{width:40,height:40,channels:3,background:'#1155cc'}}).png().toBuffer();const replacement=await sharp({create:{width:40,height:40,channels:3,background:'#22aa44'}}).png().toBuffer();
  await page.setViewportSize({width,height:1000});await page.goto('/?database=1&identity=admin');await page.getByRole('button',{name:'Catalog administration',exact:true}).click();
  const region=page.getByRole('region',{name:'Product image administration'});
  await region.getByLabel('Find catalog material',{exact:true}).fill(key);await region.getByRole('button',{name:'Find material for image review'}).click();
  await region.locator('.image-material-choice').filter({hasText:description}).click();
  await region.getByLabel('Public HTTPS source/evidence URL').fill('https://manufacturer.example/security-test');
  await region.getByLabel('Usage rights or permission basis').fill('Generated security-test pixels, not a real product photograph. Local fictional fixture only.');
  const choose=async(buffer:Buffer)=>region.getByLabel('Product photo (JPEG, PNG or WebP, maximum 5 MB)').setInputFiles({name:'test.png',mimeType:'image/png',buffer});
  async function upload(buffer:Buffer){await choose(buffer);const response=page.waitForResponse(r=>r.url().endsWith('/images')&&r.request().method()==='POST');await region.getByRole('button',{name:'Upload image for review'}).click();return (await(await response).json()).image;}
  const image=await upload(bytes);const first=region.locator('.image-review-record').filter({hasText:image.contentHash});
  await expect(first.getByRole('button',{name:'Approve product image'})).toBeDisabled();
  await expect(first.getByRole('img',{name:`Image under review for ${description}`})).toBeVisible();
  const foreman=await browser.newContext({viewport:{width,height:1000}});const view=await foreman.newPage();
  try{
    await view.goto('/?database=1&identity=foreman-one');await expect(view.locator('main')).toHaveAttribute('aria-busy','false');
    await view.getByLabel('Quantity',{exact:true}).fill('3');await view.getByLabel('Unit',{exact:true}).selectOption('EA');await view.getByLabel('Description',{exact:true}).fill(key);await view.getByRole('button',{name:'Find Matches',exact:true}).click();
    await expect(view.getByRole('region',{name:'Translation results'})).toContainText(description);
    await expect(view.getByRole('img',{name:`Approved product image for ${description}`})).toHaveCount(0);
    mkdirSync('artifacts/screenshots',{recursive:true});await first.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/screenshots/${width}-image-admin-pending.png`,fullPage:true});
    await first.getByLabel('I verified the product image and usage rights.').check();await first.getByRole('button',{name:'Approve product image'}).click();
    await expect(first.getByText('approved',{exact:true})).toBeVisible();
    await view.getByRole('button',{name:'Find Matches',exact:true}).click();await expect(view.getByRole('img',{name:`Approved product image for ${description}`})).toBeVisible();
    await view.screenshot({path:`artifacts/screenshots/${width}-approved-image-results.png`,fullPage:true});
    const secondImage=await upload(replacement);const second=region.locator('.image-review-record').filter({hasText:secondImage.contentHash});
    await second.getByLabel('I verified the product image and usage rights.').check();await second.getByRole('button',{name:'Approve product image'}).click();await expect(first.getByText('rejected',{exact:true})).toBeVisible();
    await second.getByRole('button',{name:'Remove approved image'}).click();await expect(second.getByText('rejected',{exact:true})).toBeVisible();
    await view.getByRole('button',{name:'Find Matches',exact:true}).click();await expect(view.getByRole('img',{name:`Approved product image for ${description}`})).toHaveCount(0);
    await upload(bytes);await expect(region.getByRole('alert')).toContainText('rejected for this product');
    const axe=await new AxeBuilder({page}).include('.catalog-modal').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    mkdirSync('artifacts/screenshots',{recursive:true});await second.scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/screenshots/${width}-image-admin.png`,fullPage:true});
  }finally{await foreman.close();}
});
