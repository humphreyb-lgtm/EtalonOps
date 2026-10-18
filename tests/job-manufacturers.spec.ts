import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
for(const width of [390,1440])test(`job manufacturer rules are prepared inactive and edited in place at ${width}px`,async({page,request})=>{
 const name=`Fixture brand ${randomUUID()}`,key=`brand-${randomUUID()}`;
 const {token}=await(await request.post('http://127.0.0.1:3002/api/dev/session',{data:{identity:'admin'}})).json();const headers={Authorization:`Bearer ${token}`};
 async function command(action:string,data:unknown){const response=await request.post(`http://127.0.0.1:3002/api/catalog/${action}`,{headers,data});expect(response.ok()).toBe(true);return response.json();}
 await command('material',{externalKey:key,category:'general',attributes:{type:key,specification:'Synthetic browser data'},productUnit:'EA',verification:'provisional',sourceUrl:'https://example.invalid/spec',verificationBasis:'Fictional test specifications only.'});
 await command('product',{materialKey:key,manufacturer:name,partNumber:'TEST-ONLY',title:'Fictional test part',sourceUrl:'https://example.invalid/product',verification:'provisional'});
 await page.setViewportSize({width,height:1000});await page.goto('/?database=1&identity=admin');await page.getByRole('button',{name:'Catalog administration',exact:true}).click();
 const region=page.getByRole('region',{name:'Job-wide manufacturer restrictions'});
 await expect(region.getByLabel('Activate manufacturer rule now',{exact:true})).not.toBeChecked();
 await region.getByLabel('Find allowed manufacturers',{exact:true}).fill(name);await region.getByRole('button',{name:'Browse manufacturers for rule',exact:true}).click();await region.getByLabel(`Permit manufacturer ${name}`,{exact:true}).check();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/catalog/policy')&&r.request().method()==='POST');await region.getByRole('button',{name:'Save job manufacturer rule',exact:true}).click();const rule=await(await response).json();expect(rule.enabled).toBe(false);
 await expect(region.getByRole('status')).toContainText('Manufacturer rule saved');
 await region.getByRole('button',{name:new RegExp(`^Edit manufacturer rule ${rule.id}$`,'i')}).click();
 await expect(region.getByRole('button',{name:`Remove allowed manufacturer ${name}`,exact:true})).toBeVisible();
 await region.getByLabel('Manufacturer rule scope',{exact:true}).selectOption('category');await region.getByLabel('Restricted material category',{exact:true}).selectOption('box');
 await region.getByRole('button',{name:'Save job manufacturer rule',exact:true}).click();await expect(region.getByRole('status')).toContainText('Manufacturer rule saved');
 const history=await command('page',{section:'policies',ruleScope:'global',ruleId:rule.id});const saved=history.records.filter((r:{id:string})=>r.id.toLowerCase()===rule.id.toLowerCase());expect(saved).toHaveLength(1);expect(saved[0].category).toBe('box');expect(Boolean(saved[0].enabled)).toBe(false);
 const accessibility=await new AxeBuilder({page}).include('.catalog-modal').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(accessibility.violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
