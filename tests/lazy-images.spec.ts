import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { searchFixtures } from '../src/domain';
test('long MRFs request photos near the viewport rather than every saved row',async({page})=>{
 const candidate=searchFixtures('1" PVC')[0];const requests:string[]=[];
 await page.route('**/api/projects/riverside/draft',route=>route.fulfill({json:{draft:{id:randomUUID(),projectId:'riverside',deliveryDate:'2026-11-10',version:1,savedAt:'2026-10-17T22:00:00Z',lines:Array.from({length:80},()=>({id:randomUUID(),quantity:'1',requestedUnit:'STICK',description:candidate.description,rawInput:{quantity:'1',requestedUnit:'STICK',description:'1" PVC'},candidate,source:candidate.source,deliveryMode:'inherit',overrideDate:null}))}}}));
 await page.route('**/api/materials/*/image*',route=>{requests.push(route.request().url());return route.fulfill({status:404,json:{error:'No image for this synthetic fixture.'}});});
 await page.setViewportSize({width:1440,height:900});await page.goto('/?database=1&identity=foreman-two');await expect(page.getByTestId('mrf-line')).toHaveCount(80);await expect.poll(()=>requests.length).toBeGreaterThan(0);expect(requests.length).toBeLessThan(15);
 const initial=requests.length;await page.getByTestId('mrf-line').last().scrollIntoViewIfNeeded();await expect.poll(()=>requests.length).toBeGreaterThan(initial);expect(requests.length).toBeLessThan(30);
});
