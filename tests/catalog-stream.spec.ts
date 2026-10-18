import { test,expect } from '@playwright/test';
test('large export commits only complete streams and aborts partial files',async({page})=>{
 await page.addInitScript(()=>{
  const state={chunks:[] as number[][],closed:false,aborted:false};
  Object.assign(window,{__catalogFile:state,showSaveFilePicker:async()=>({createWritable:async()=>({write:async(chunk:Uint8Array)=>{state.chunks.push([...chunk]);},close:async()=>{state.closed=true;},abort:async()=>{state.aborted=true;}})})});
 });
 await page.goto('/?database=1&identity=admin');await page.getByRole('button',{name:'Catalog administration',exact:true}).click();
 const button=page.getByRole('button',{name:'Export large catalog to file',exact:true});await expect(button).toBeEnabled();await button.click();await expect(page.getByText('Large catalog export saved. Image files are separate.',{exact:true})).toBeVisible();
 const file=await page.evaluate(()=>{const state=(window as typeof window&{__catalogFile:{chunks:number[][];closed:boolean;aborted:boolean}}).__catalogFile;const text=new TextDecoder().decode(new Uint8Array(state.chunks.flat()));const lines=text.trimEnd().split('\n').map(line=>JSON.parse(line));return {closed:state.closed,aborted:state.aborted,format:lines[0].format,records:lines.length-2,footer:lines.at(-1)};});
 expect(file.closed).toBe(true);expect(file.aborted).toBe(false);expect(file.format).toBe('etalonops-catalog-stream');expect(file.footer.type).toBe('complete');expect(file.footer.recordCount).toBe(file.records);
 await page.evaluate(()=>Object.assign((window as typeof window&{__catalogFile:object}).__catalogFile,{chunks:[],closed:false,aborted:false}));
 await page.route('**/api/admin/catalog-stream.jsonl',route=>route.fulfill({status:200,contentType:'application/x-ndjson',body:JSON.stringify({type:'manifest',format:'etalonops-catalog-stream',version:1,tenant:'local',tables:[]})+'\n'}));
 await button.click();await expect(page.getByRole('alert')).toContainText('export was incomplete');
 expect(await page.evaluate(()=>{const state=(window as typeof window&{__catalogFile:{closed:boolean;aborted:boolean}}).__catalogFile;return {closed:state.closed,aborted:state.aborted};})).toEqual({closed:false,aborted:true});
 await page.evaluate(()=>Object.assign(window,{showSaveFilePicker:async()=>{throw new DOMException('Canceled','AbortError');}}));await button.click();await expect(page.getByText('Catalog export canceled.',{exact:true})).toBeVisible();
});
