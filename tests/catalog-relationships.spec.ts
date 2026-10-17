import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

for(const width of [390,1440])test(`manufacturer preference, selection learning and No Substitutions persist at ${width}px`,async({page,request})=>{
  const project=width===390?'northside':'riverside';
  const unique=randomUUID().replaceAll('-','').slice(0,10),type=`Fictional widget ${unique}`;
  const {token}=await(await request.post('http://127.0.0.1:3002/api/dev/session',{data:{identity:'admin'}})).json();const headers={Authorization:`Bearer ${token}`};
  async function command(action:string,data:unknown){const response=await request.post(`http://127.0.0.1:3002/api/catalog/${action}`,{headers,data});expect(response.ok(),await response.text()).toBe(true);return response.json();}
  const material=await command('material',{externalKey:`ui-${unique}`,category:'general',attributes:{type,specification:'Synthetic specification, not a real product'},productUnit:'EA',verification:'provisional',sourceUrl:'https://example.invalid/test',verificationBasis:'Synthetic browser fixture only.'});
  const product=await command('product',{materialKey:`ui-${unique}`,manufacturer:`Fixture Maker ${unique}`,partNumber:`TEST-${unique}`,title:type,sourceUrl:'https://example.invalid/test',verification:'provisional'});
  await page.setViewportSize({width,height:1000});await page.goto('/?database=1&identity=admin');await page.getByRole('button',{name:'Catalog administration',exact:true}).click();
  const admin=page.getByRole('region',{name:'Catalog relationships'});await admin.getByLabel('Material search',{exact:true}).fill(type);await admin.getByRole('button',{name:'Find material relationships'}).click();await admin.getByRole('button',{name:material.description,exact:true}).click();
  await admin.getByLabel('Administrator-designated high use').check();await admin.getByLabel('Preferred manufacturer product',{exact:true}).selectOption(product.id);await admin.getByRole('button',{name:'Save material priority'}).click();await expect(admin.getByRole('status')).toContainText('Priority saved');
  await admin.getByRole('heading',{name:material.description,exact:true}).scrollIntoViewIfNeeded();mkdirSync('artifacts/screenshots',{recursive:true});await page.screenshot({path:`artifacts/screenshots/${width}-manufacturer-admin.png`,fullPage:true});
  const axe=await new AxeBuilder({page}).include('.catalog-relationships').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
  await page.getByRole('button',{name:'Close catalog administration'}).click();
  // Admin has its own draft; use Northside so legacy workflow tests remain independent.
  await page.getByLabel('Project',{exact:true}).selectOption(project);await expect(page.locator('main')).toHaveAttribute('aria-busy','false');
  const count=await page.getByTestId('mrf-line').count();await page.getByLabel('Quantity',{exact:true}).fill('2');await page.getByLabel('Unit',{exact:true}).selectOption('EA');await page.getByLabel('Description',{exact:true}).fill(type);await page.getByRole('button',{name:'Find Matches',exact:true}).click();await expect(page.locator('.results-table').getByText('Provisional catalog · unverified',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:`Add ${material.description}`,exact:true}).click();const line=page.getByTestId('mrf-line').last();await expect(line).toContainText(`TEST-${unique}`);
  await page.getByRole('button',{name:`Edit item ${count+1}`,exact:true}).click();await page.getByLabel('No Substitutions',{exact:true}).check();await page.getByRole('button',{name:'Save item changes',exact:true}).click();await expect(line).toContainText('No Substitutions — exact product required');
  await page.getByRole('button',{name:'Save as Draft',exact:true}).click();await expect(page.getByText('Saved in local database',{exact:true})).toBeVisible();await page.reload();await page.getByLabel('Project',{exact:true}).selectOption(project);await expect(page.getByTestId('mrf-line').last()).toContainText('No Substitutions — exact product required');await expect(page.getByTestId('mrf-line').last()).toContainText(`TEST-${unique}`);
  const alternative=await command('product',{materialKey:`ui-${unique}`,manufacturer:`Alternative Maker ${unique}`,partNumber:`ALT-${unique}`,title:type,sourceUrl:'https://example.invalid/test',verification:'provisional'});
  const policy=await command('policy',{projectId:project,materialKey:`ui-${unique}`,category:null,enabled:true,manufacturerIds:[],productIds:[alternative.id]});
  try{await page.getByRole('button',{name:'Check purchasing requirements',exact:true}).click();await expect(page.getByRole('alert')).toContainText('violates this job restriction');await expect(page.getByTestId('mrf-line').last()).toContainText(`TEST-${unique}`);}finally{await command('disable-policy',{id:policy.id});}
  const phrases=await command('translations',{id:material.id});expect(phrases.some((p:{phrase:string;origin:string})=>p.phrase===type&&p.origin==='user_selection')).toBe(true);
  await page.getByTestId('mrf-line').last().scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/screenshots/${width}-no-substitutions.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
