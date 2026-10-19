import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
test('aligned header selects registered job foreman and persists the selection',async({page,request})=>{
 const session=await request.post('http://127.0.0.1:3002/api/dev/session',{data:{identity:'admin'}}),token=(await session.json()).token;
 const name='Foreman '+randomUUID().slice(0,8),oid=randomUUID();
 const registered=await request.post('http://127.0.0.1:3002/api/admin/users/save',{headers:{Authorization:`Bearer ${token}`},data:{oid,displayName:name,active:true,roleLimit:'Foreman',projects:['riverside'],version:0,reason:'Browser test for delegated MRF header.'}});expect(registered.ok()).toBe(true);
 await page.goto('/?database=1&identity=admin');await page.getByRole('button',{name:'New MRF',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Add MRF Item',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Start with the material you need.'})).toHaveCount(0);
 await expect(page.getByLabel('MRF Delivery Date',{exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Save as Draft',exact:true})).toHaveCount(1);
 await page.getByLabel('Foreman',{exact:true}).selectOption(oid);await page.getByLabel('MRF name',{exact:true}).fill('Delegated '+name);await page.getByRole('button',{name:'Save as Draft',exact:true}).click();await expect(page.getByText('Saved in local database',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Foreman',{exact:true})).toHaveValue(oid);
 const boxes=await Promise.all(['MRF name','Foreman','MRF Delivery Date'].map(label=>page.getByLabel(label,{exact:true}).boundingBox()));expect(new Set(boxes.map(box=>box!.y)).size).toBe(1);expect(new Set(boxes.map(box=>box!.height)).size).toBe(1);
 await page.screenshot({path:'/tmp/v27-header-desktop.png'});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/v27-header-mobile.png'});
});
