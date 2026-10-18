import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`research review imports only selected edited products and invalidates stale previews at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const suffix=Date.now().toString(),part='REVIEW-'+suffix;
 const item={externalKey:'RESEARCH-'+suffix,category:'general',productUnit:'EA',attributes:{type:'Fictional review widget',specification:'Synthetic test item '+suffix},manufacturer:'Fictional Review Maker',partNumber:part,title:'Fictional research widget',sourceUrl:'https://example.invalid/review',verificationBasis:'Synthetic evidence for a browser test only.',phrases:[part]};
 await page.goto('/?database=1&identity=admin');await expect(page.locator('main')).toHaveAttribute('aria-busy','false');
 await page.getByRole('button',{name:'Administration',exact:true}).click();const admin=page.getByRole('dialog',{name:'Administration',exact:true});
 await admin.getByRole('button',{name:'Product research',exact:true}).click();const review=admin.getByRole('region',{name:'Product research review'});
 await expect(review.getByRole('button',{name:'Research manufacturer products',exact:true})).toBeDisabled();
 await review.getByLabel('Load prepared research JSON').setInputFiles({name:'research.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({scope:'Two fictional widgets',coverageNotes:'Two examples only; not a complete manufacturer family.',items:[item,{...item,externalKey:'OMITTED-'+suffix,partNumber:'OMIT-'+suffix,attributes:{...item.attributes,specification:'Different item'}}]}))});
 await expect(review.getByText('2 candidates · 0 selected.',{exact:false})).toBeVisible();await review.getByLabel('Select candidate 1',{exact:true}).check();
 await review.getByRole('button',{name:'Validate and preview selected products'}).click();await expect(review.getByText('1 products · 1 potential phrases.',{exact:false})).toBeVisible();
 await review.getByLabel('Manufacturer product title',{exact:true}).first().fill('Edited synthetic widget');await expect(review.getByRole('button',{name:'Add selected products to catalog'})).toHaveCount(0);
 await review.getByRole('button',{name:'Validate and preview selected products'}).click();const add=review.getByRole('button',{name:'Add selected products to catalog'});await expect(add).toBeDisabled();
 await review.getByLabel('I reviewed these products, specifications, phrases and source evidence.').check();await expect(admin).toBeVisible();expect(await admin.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await admin.screenshot({path:`.runtime/catalog-005/research-review-${width}.png`});await add.click();await expect(review.getByText('1 selected products processed as provisional.',{exact:false})).toBeVisible();
 const results=await page.evaluate(async q=>{const session=await fetch('/api/dev/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:'admin'})}).then(r=>r.json());return Promise.all(q.map(async query=>fetch('/api/materials?q='+encodeURIComponent(query),{headers:{Authorization:'Bearer '+session.token}}).then(r=>r.json())));},[part,'OMIT-'+suffix]);
 expect(JSON.stringify(results[0])).toContain(part);expect(JSON.stringify(results[1])).not.toContain('OMIT-'+suffix);
});
