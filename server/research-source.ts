import {pdfSourceText} from './research-pdf';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';
import {ApiError} from './contracts';
const blocked=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(address,prefix,'ipv4');
export function publicSourceUrl(value:string){let url:URL;try{url=new URL(value);}catch{throw new ApiError(400,'Use a complete public HTTPS manufacturer page URL.');}if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||isIP(url.hostname)||!url.hostname.includes('.')||/\.(local|internal|localhost)$/i.test(url.hostname))throw new ApiError(400,'Use a public HTTPS manufacturer page without credentials or a custom port.');url.hash='';return url;}
export function publicSourceIp(address:string){return isIP(address)===4&&!blocked.check(address,'ipv4');}
export type ResearchSource={url:string;text:string;imageUrls:string[];linkedDocuments?:string[]};
function decode(text:string){return text.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
export function sourceText(url:string,html:string):ResearchSource{
 const images=[...html.matchAll(/(?:src|content)=["']([^"']+)["']/gi)].map(match=>{try{return new URL(decode(match[1]),url).href;}catch{return '';}}).filter(value=>/^https:\/\//.test(value)&&/\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(value));
 const structured=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(match=>match[1].slice(0,20000)).join('\n');
 const text=decode(html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
 const linkedDocuments=[...html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)].flatMap(match=>{try{const link=publicSourceUrl(new URL(decode(match[1]),url).href);return link.origin===new URL(url).origin?[link.href]:[];}catch{return [];}});
 return {url,text:(text+'\nStructured source data (untrusted): '+structured).slice(0,24000),imageUrls:[...new Set(images)].filter(value=>value.length<=500).slice(0,10),linkedDocuments:[...new Set(linkedDocuments)].slice(0,2)};
}
export async function fetchResearchSource(value:string,redirects=0):Promise<ResearchSource>{
 const url=publicSourceUrl(value);let addresses;
 try{addresses=await lookup(url.hostname,{all:true,family:4});}catch{throw new ApiError(400,'Manufacturer page hostname could not be resolved.');}
 if(!addresses.length||addresses.some(item=>!publicSourceIp(item.address)))throw new ApiError(400,'Manufacturer page resolves to a restricted network.');
 return new Promise((resolve,reject)=>{
  const request=https.get(url,{headers:{'User-Agent':'EtalonOpsProductResearch/1.0','Accept':'text/html,text/plain,application/pdf','Accept-Encoding':'identity'},lookup:((_name:unknown,options:any,callback:any)=>options.all?callback(null,[{address:addresses[0].address,family:4}]):callback(null,addresses[0].address,4)) as any},response=>{
   if(response.statusCode&&[301,302,303,307,308].includes(response.statusCode)){
    response.resume();if(redirects>=3||!response.headers.location){reject(new ApiError(400,'Too many manufacturer page redirects.'));return;}let next:URL;try{next=new URL(response.headers.location,url);}catch{reject(new ApiError(400,'Invalid manufacturer page redirect.'));return;}void fetchResearchSource(next.href,redirects+1).then(resolve,reject);return;
   }
   if(response.statusCode!==200||!/^(?:text\/(?:html|plain)|application\/pdf)(?:;|$)/i.test(response.headers['content-type']??'')||!['identity',undefined].includes(response.headers['content-encoding'])){response.resume();reject(new ApiError(400,'Use an accessible manufacturer HTML page or PDF sell sheet. Compressed, blocked or login pages are not supported.'));return;}
   let size=0;const chunks:Buffer[]=[];response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2_000_000){request.destroy(new Error('Source page exceeds limit.'));return;}chunks.push(chunk);});response.on('end',()=>{const buffer=Buffer.concat(chunks);if(/^application\/pdf/i.test(response.headers['content-type']??''))void pdfSourceText(buffer).then(text=>resolve({url:url.href,text,imageUrls:[]}),reject);else resolve(sourceText(url.href,buffer.toString('utf8')));});response.on('error',()=>reject(new ApiError(502,'Manufacturer page could not be read.')));
  });
  const timer=setTimeout(()=>request.destroy(new Error('Manufacturer page timed out.')),7000);request.once('close',()=>clearTimeout(timer));request.on('error',()=>reject(new ApiError(502,'Manufacturer page could not be read within the size/time limit.')));
 });
}
