import {parseInches} from '../src/measurements';
// Strip only recognized constraints for retrieval; compare them separately so
// missing data never becomes an implicit assertion of compatibility.
export function compareSpecifications(query:string,attributes:Record<string,any>,description=''){
 const a={...attributes},missing:string[]=[],conflicts:string[]=[];
 let retrieval=query.normalize('NFKC').replace(/[⁄∕]/g,'/').replace(/\bgalv\b/gi,'galvanized').replace(/\bpvc\s+(40|80)\b/gi,'PVC schedule $1');
 const text=description.toLowerCase();
 const number=(s:string)=>{try{return parseInches(s.replace(/^(\d+)-(\d+\/\d+)$/,'$1 $2'));}catch{return NaN;}};
 const measure='(\\d+(?:[ -]\\d+/\\d+|/\\d+|\\.\\d+)?)';
 function check(field:string,label:string,value:any,fallback?:any){const actual=a[field]??fallback;if(actual==null||actual==='')missing.push(label+' not recorded');else if(typeof value==='number'?Math.abs(number(String(actual))-value)>0.00001:String(actual).toLowerCase()!==String(value).toLowerCase())conflicts.push(label+' differs');}
 retrieval=retrieval.replace(/\bsch(?:edule)?\.?\s*(\d+)\b/gi,(_,v)=>{check('schedule','Schedule '+v,v,text.match(/\bschedule\s*(\d+)/)?.[1]);return ' ';});
 retrieval=retrieval.replace(new RegExp(measure+'\\s*(?:inches|inch|in\\b|["″])?\\s*(?:radius|rad\\b)','gi'),(_,v)=>{check('radiusIn','Radius '+v+' in.',number(v));return ' ';});
 retrieval=retrieval.replace(/\b(90|60|45|30|22\.5|15|11\.25)\s*(?=elbow|ell\b|bend|sweep)/gi,(_,v)=>{check('angleDeg','Angle '+v+'°',Number(v));return ' ';});
 retrieval=retrieval.replace(/(\d+(?:\.\d+)?)\s*(?:°|deg(?:ree)?s?\b)/gi,(_,v)=>{check('angleDeg','Angle '+v+'°',Number(v));return ' ';});
 retrieval=retrieval.replace(new RegExp(measure+"\\s*(?:ft\\b|feet\\b|foot\\b|['′])",'gi'),(_,v)=>{check('lengthIn','Length '+v+' ft',number(v)*12);return ' ';});
 // A labelled length is distinct from trade diameter or a bolt/thread dimension.
 retrieval=retrieval.replace(new RegExp(measure+'\\s*(?:inches|inch|in\\b|["″])\\s*(?:length|long)\\b','gi'),(_,v)=>{check('lengthIn','Length '+v+' in.',number(v));return ' ';});
 const size=retrieval.match(new RegExp(measure+'\\s*(?:inches|inch|in\\b|["″])','i'));
 if(size&&a.diameterIn!=null){check('diameterIn','Trade size',number(size[1]));retrieval=retrieval.replace(size[0],' ');}
 // Keep unclassified sizes in lexical retrieval (washer ID/OD, box dimensions,
 // threads, etc.) rather than guessing which structured dimension they mean.
 for(const [pattern,field,label,value] of [
  [/\bpvc\b/gi,'material','PVC material','pvc'],
  [/\bstainless(?: steel)?\b/gi,'material','Stainless steel material','stainless steel'],
  [/\bgalvanized\b/gi,'finish','Galvanized finish','galvanized'],
  [/\bzinc[ -]plated\b/gi,'finish','Zinc plated finish','zinc plated'],
  [/\bbell(?:ed)?[ -]end\b/gi,'endConnection','Bell end','bell end'],
  [/\bplain[ -]end\b/gi,'endConnection','Plain end','plain end'],
  [/\bshort[ -]spring\b/gi,'springType','Short spring','short spring'],
  [/\blong[ -]spring\b/gi,'springType','Long spring','long spring'],
 ] as const){retrieval=retrieval.replace(pattern,match=>{const actual=a[field];if(actual==null){if(!text.includes(match.toLowerCase()))missing.push(label+' not recorded');}else{const clean=(s:string)=>s.toLowerCase().replace(/pregalvanized/,'galvanized').replace(/belled/,'bell').replace(/[- ]+/g,' ').trim();if(clean(String(actual))!==clean(value)&&!clean(String(actual)).includes(clean(value)))conflicts.push(label+' differs');}return ' ';});}
 return {retrieval:retrieval.replace(/(^|\s)[.,;](?=\s|$)/g,' ').replace(/\s+/g,' ').trim(),missing:[...new Set(missing)],conflicts:[...new Set(conflicts)]};
}
