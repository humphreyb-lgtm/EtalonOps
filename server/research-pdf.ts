import {Worker} from 'node:worker_threads';
import {ApiError} from './contracts';
// Parse untrusted documents in a short-lived, memory-limited worker, never evaluate PDF JavaScript.
export async function pdfSourceText(buffer:Buffer):Promise<string>{
 if(buffer.length>2_000_000||buffer.subarray(0,5).toString()!=='%PDF-')throw new ApiError(400,'Use a PDF smaller than 2 MB.');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {getDocumentProxy}=await import('unpdf');const pdf=await getDocumentProxy(new Uint8Array(workerData),{isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,verbosity:0});if(pdf.numPages>60)throw Error('Document exceeds 60 pages');let text='';for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();text+=' Page '+n+': '+content.items.map(item=>item.str||'').join(' ');if(text.length>24000){text=text.slice(0,24000)+' [Document text truncated]';break;}}await pdf.loadingTask.destroy();parentPort.postMessage({text});})().catch(()=>parentPort.postMessage({error:true}));`,{eval:true,execArgv:[],workerData:buffer,resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
  const timer=setTimeout(()=>{void worker.terminate();reject(new ApiError(400,'PDF extraction timed out. Use a smaller manufacturer sell sheet.'));},7000);
  worker.once('message',value=>{clearTimeout(timer);void worker.terminate();if(value.error||!value.text?.trim())reject(new ApiError(400,'PDF text could not be extracted. Use a searchable sell sheet of at most 60 pages; scanned documents require manual review.'));else resolve(value.text);});worker.once('error',()=>{clearTimeout(timer);reject(new ApiError(400,'PDF extraction failed. Use a smaller searchable sell sheet.'));});worker.once('exit',code=>{if(code!==0){clearTimeout(timer);reject(new ApiError(400,'PDF extraction exceeded its resource limit.'));}});
 });
}
