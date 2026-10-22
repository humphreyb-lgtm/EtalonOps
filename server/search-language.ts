// Retrieval equivalence is separate from identity: never use this as a Material Key.
export function searchLanguage(input:string):string {
 let q=input.replace(/(\d)([¼½¾⅛⅜⅝⅞])/g,'$1 $2').normalize('NFKC').toLowerCase().replace(/[⁄∕]/g,'/');
 q=q.replace(/\bhalf\s+inch\b/g,'0.5 inch').replace(/\bquarter\s+inch\b/g,'0.25 inch').replace(/\bthree[ -]quarter(?:s)?\s+inch\b/g,'0.75 inch');
 const threads:string[]=[];
 q=q.replace(/(?<![\w/-])(\d+\/\d+|\d+\.\d+)-(\d+)(?![\d/])/g,(_,d,p)=>{threads.push(`${Number(d.includes('/')?Number(d.split('/')[0])/Number(d.split('/')[1]):d)}-${p}`);return ` threadtoken${String.fromCharCode(97+threads.length-1)} `;});
 q=q.replace(/(?<![\w/-])(\d+)[ -](\d+)\/(\d+)(?![\w/])/g,(s,w,n,d)=>Number(d)?String(Number(w)+Number(n)/Number(d)):s)
 .replace(/(?<![\w/-])(\d+)\/(\d+)(?![\w/])/g,(s,n,d)=>Number(d)?String(Number(n)/Number(d)):s);
 q=q.replace(/threadtoken([a-z])/g,(_,i)=>threads[i.charCodeAt(0)-97]);
 q=q.replace(/\b(\d+(?:\.\d+)?)\s*(?:feet|foot|ft\.?(?=\W|$)|['′])/g,'$1 ft ')
 .replace(/\b(\d+(?:\.\d+)?)\s*(?:inches|inch|in\b\.?|["″])/g,'$1 ')
 .replace(/(\d)\s*(?:×|\bx\b|\bby\b)\s*(?=\d)/g,'$1 ')
 .replace(/\bunistrut\b/g,'strut')
 .replace(/\bpre[ -]?galv(?:anized)?\b|\bpg\b/g,'pregalvanized')
 .replace(/\bhot[ -]dip[ -]galv(?:anized)?\b|\bhdg\b|\bhg\b/g,'hotdipgalvanized')
 .replace(/\belectro[ -]galv(?:anized)?\b|\beg\b/g,'electrogalvanized')
 .replace(/\bzinc[ -]plated\b|\bzp\b/g,'zincplated')
 .replace(/\bga(?:uge)?\.?\b/g,'gauge').replace(/\bstd\b/g,'standard')
 .replace(/\bback[ -]to[ -]back\b/g,'double')
 .replace(/\bhalf[ -]slot(?:ted)?\b/g,'halfslot').replace(/\blong[ -]slot(?:ted)?\b/g,'longslot')
 .replace(/\b(?:springless|spring[ -]less|no spring)\b/g,'springless')
 .replace(/\bslots\b/g,'slot').replace(/\bcaps\b/g,'cap').replace(/\bchannels\b/g,'channel').replace(/\bplates\b/g,'plate')
 .replace(/\bft\./g,'ft').replace(/\binch\b/g,'');
 return q.replace(/\s+/g,' ').trim();
}
export function explicitBrand(input:string):string|undefined {
 return input.match(/\b([\w-]+)\s+brand\s+only\b/i)?.[1].toLowerCase();
}
// Index documented fields directly, so new catalog records do not depend on an
// exhaustive collection of aliases. Physical roles are checked before ranking.
export function structuredSearchPhrase(a:Record<string,any>):string {
 const values=[a.type,a.specification,a.material,a.finish,a.springType];
 for(const field of ['diameterIn','widthIn','heightIn','depthIn'])if(a[field]!=null)values.push(`${a[field]} inch`);
 if(a.lengthIn!=null)values.push(`${a.lengthIn} inch length ${Number(a.lengthIn)/12} ft`);
 if(a.gauge!=null)values.push(`${a.gauge} gauge`);
 if(a.threadSize!=null)values.push(a.threadPitch!=null&&!String(a.threadSize).includes('-')?`${a.threadSize}-${a.threadPitch} thread`:String(a.threadSize));
 return values.filter(v=>v!=null&&v!=='').join(' ');
}
