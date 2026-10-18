import {createGunzip,createInflate,createBrotliDecompress} from 'node:zlib';
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
 const structuredBlocks=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0,10).map(match=>match[1].slice(0,20000));
 const structured=structuredBlocks.join('\n');
 const productImages:string[]=[];
 function visit(value:any,depth=0){if(depth>6||!value||typeof value!=='object')return;if(Array.isArray(value)){value.slice(0,30).forEach(item=>visit(item,depth+1));return;}const type=Array.isArray(value['@type'])?value['@type']:[value['@type']];if(type.some((name:unknown)=>name==='Product'))for(const image of [value.image].flat().slice(0,10)){try{const link=typeof image==='string'?image:image?.url;if(link)productImages.push(publicSourceUrl(new URL(link,url).href).href);}catch{/* Ignore unusable optional image evidence. */}}for(const [name,item] of Object.entries(value))if(name==='@graph'||name==='mainEntity'||name==='itemListElement')visit(item,depth+1);}
 for(const block of structuredBlocks){try{visit(JSON.parse(block));}catch{/* Untrusted malformed JSON-LD remains text only. */}}
 images.unshift(...productImages);

 const text=decode(html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
 const linkedDocuments=[...html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)].flatMap(match=>{try{const link=publicSourceUrl(new URL(decode(match[1]),url).href);return [link.href];}catch{return [];}});
 return {url,text:(text+'\nStructured source data (untrusted): '+structured).slice(0,24000),imageUrls:[...new Set(images)].filter(value=>value.length<=500).slice(0,10),linkedDocuments:[...new Set(linkedDocuments)].slice(0,2)};
}
export async function fetchResearchSource(value:string,redirects=0,focus=''):Promise<ResearchSource>{
 const url=publicSourceUrl(value);let addresses;
 try{addresses=await lookup(url.hostname,{all:true,family:4});}catch{throw new ApiError(400,'Manufacturer page hostname could not be resolved.');}
 if(!addresses.length||addresses.some(item=>!publicSourceIp(item.address)))throw new ApiError(400,'Manufacturer page resolves to a restricted network.');
 return new Promise((resolve,reject)=>{
  const request=https.get(url,{headers:{'User-Agent':'EtalonOpsProductResearch/1.0','Accept':'text/html,text/plain,application/pdf','Accept-Encoding':'identity'},lookup:((_name:unknown,options:any,callback:any)=>options.all?callback(null,[{address:addresses[0].address,family:4}]):callback(null,addresses[0].address,4)) as any},response=>{
   if(response.statusCode&&[301,302,303,307,308].includes(response.statusCode)){
    response.resume();if(redirects>=3||!response.headers.location){reject(new ApiError(400,'Too many manufacturer page redirects.'));return;}let next:URL;try{next=new URL(response.headers.location,url);}catch{reject(new ApiError(400,'Invalid manufacturer page redirect.'));return;}void fetchResearchSource(next.href,redirects+1,focus).then(resolve,reject);return;
   }
   if(response.statusCode!==200||!/^(?:text\/(?:html|plain)|application\/(?:pdf|xhtml\+xml))(?:;|$)/i.test(response.headers['content-type']??'')||!['identity','gzip','deflate','br',undefined].includes(response.headers['content-encoding'])){response.resume();reject(new ApiError(400,'Manufacturer source HTTP '+response.statusCode+'; content type '+(response.headers['content-type']??'missing').slice(0,80)+'; encoding '+(response.headers['content-encoding']??'identity')+'. Use an accessible HTML page or PDF without a login.'));return;}
   const encoding=response.headers['content-encoding'];const stream=encoding==='gzip'?response.pipe(createGunzip()):encoding==='deflate'?response.pipe(createInflate()):encoding==='br'?response.pipe(createBrotliDecompress()):response;let size=0;const chunks:Buffer[]=[];stream.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>(/^application\/pdf/i.test(response.headers['content-type']??'')?8_000_000:2_000_000)){reject(new ApiError(413,'Source page exceeds the extracted size limit.'));stream.destroy();request.destroy();return;}chunks.push(chunk);});stream.on('end',()=>{const buffer=Buffer.concat(chunks);if(/^application\/pdf/i.test(response.headers['content-type']??''))void pdfSourceText(buffer,focus).then(text=>resolve({url:url.href,text,imageUrls:[]}),reject);else resolve(sourceText(url.href,buffer.toString('utf8')));});stream.on('error',()=>reject(new ApiError(502,'Manufacturer page could not be read.')));
  });
  const timer=setTimeout(()=>request.destroy(new Error('Manufacturer page timed out.')),7000);request.once('close',()=>clearTimeout(timer));request.on('error',()=>reject(new ApiError(502,'Manufacturer page could not be read within the size/time limit.')));
 });
}
