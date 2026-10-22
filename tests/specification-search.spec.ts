import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
test('missing schedule is visible in a dense material result',async({page})=>{
 await page.goto('/?database=1&identity=admin');
 await expect(page.locator('main')).toHaveAttribute('aria-busy','false');
 const {token}=await (await page.request.post('/api/dev/session',{data:{identity:'admin'}})).json();
 const key='SEARCH-'+randomUUID();
 const response=await page.request.post('/api/catalog/material',{headers:{authorization:`Bearer ${token}`},data:{externalKey:key,displayDescription:'1 in. PVC testcoupling '+key,category:'general',productUnit:'EA',verification:'provisional',attributes:{type:'testcoupling',specification:key,diameterIn:1,material:'PVC'},sourceUrl:'',verificationBasis:'Synthetic browser search regression only.'}});
 expect(response.ok()).toBe(true);
 await page.locator('#quantity').fill('4');await page.locator('#quantity-unit').selectOption('EA');await page.locator('#description').fill('1" PVC SCH 40 testcoupling');await page.getByRole('button',{name:'Find Matches',exact:true}).click();
 const row=page.locator('.result-row').filter({hasText:key});await expect(row).toBeVisible();await expect(row).toContainText('Needs verification');await expect(row).toContainText('Schedule 40 not recorded');await expect(row.getByRole('button',{name:/^Add /})).toBeEnabled();
});

test('FA and MA retrieve the correct gender with a missing schedule warning',async({page})=>{
 await page.goto('/?database=1&identity=admin');await expect(page.locator('main')).toHaveAttribute('aria-busy','false');
 const {token}=await (await page.request.post('/api/dev/session',{data:{identity:'admin'}})).json();const key='ADAPTER-'+randomUUID();
 for(const type of ['female adapter','male adapter']){const r=await page.request.post('/api/catalog/material',{headers:{authorization:`Bearer ${token}`},data:{externalKey:key+type.slice(0,1),displayDescription:'1 in. PVC '+type+' '+key,category:'general',productUnit:'EA',verification:'provisional',attributes:{type,specification:key,diameterIn:1,material:'PVC'},sourceUrl:'',verificationBasis:'Synthetic browser abbreviation regression only.'}});expect(r.ok()).toBe(true);}
 await page.locator('#quantity').fill('100');await page.locator('#quantity-unit').selectOption('EA');
 for(const [abbr,type,other] of [['fa','female adapter','male adapter'],['ma','male adapter','female adapter']]){await page.locator('#description').fill('1" PVC sch 40 '+abbr);await page.getByRole('button',{name:'Find Matches',exact:true}).click();const rows=page.locator('.result-row');await expect(rows.filter({hasText:'PVC '+type+' '+key})).toContainText('Schedule 40 not recorded');await expect(rows.filter({hasText:'PVC '+other+' '+key})).toHaveCount(0);}
});
