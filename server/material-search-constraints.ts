import {parseInches} from '../src/measurements';
// Explicit physical constraints override even an exact learned phrase.
const measurement='(?:\\d+(?:[ -]\\d+\\/\\d+|\\/\\d+|\\.\\d+)?|[¼½¾])';
const number=(v:string)=>{try{return parseInches(v.replace(/^(\d+)-(\d+\/\d+)$/,'$1 $2'));}catch{return NaN;}};
export function matchesPhysicalSearch(query:string,a:Record<string,any>){
 const q=query.toLowerCase();
 const radius=q.match(new RegExp(`(${measurement})\\s*(?:inches|inch|in\\b|["″])?\\s*(?:radius|rad\\b)`));
 if(radius&&(a.radiusIn==null||number(radius[1])!==Number(a.radiusIn)))return false;
 const angle=q.match(/(\d+(?:\.\d+)?)\s*(?:°|deg(?:ree)?s?\b)/)??q.match(/\b(90|60|45|30|22\.5|15|11\.25|5)\s*(?:elbow|ell|bend|sweep)\b/);
 if(angle&&(a.angleDeg==null||Number(angle[1])!==Number(a.angleDeg)))return false;
 if(/\bstandard radius\b/.test(q)&&a.radiusClass&&a.radiusClass!=='standard')return false;
 const type=String(a.type??'').toLowerCase();
 if(/\b(?:female adapter|female adaptor|fa)\b/.test(q)&&!type.includes('female'))return false;
 if(/\b(?:male adapter|male adaptor|ma)\b/.test(q)&&!/^male /.test(type))return false;
 if(/\b(?:repair|slip) coupling\b/.test(q)&&!/(?:repair|without center stop)/.test(type))return false;
 if(/\b(?:standard|center[- ]stop) coupling\b|coupling with (?:center )?stop/.test(q)&&!/with center stop/.test(type))return false;
 const reducer=q.match(new RegExp(`(${measurement})\\s*(?:inches|inch|in\\b|["″])?\\s*[x×]\\s*(${measurement})\\s*(?:inches|inch|in\\b|["″])?`));
 if(reducer&&(a.sizeAIn!=null||a.sizeBIn!=null)){const requested=[number(reducer[1]),number(reducer[2])].sort((x,y)=>y-x);if(requested[0]!==Number(a.sizeAIn)||requested[1]!==Number(a.sizeBIn))return false;}
 if(a.compatibleSizesIn){const requested=q.match(new RegExp(`(${measurement})\\s*(?:inches|inch|in\\b|["″])`));if(requested&&!String(a.compatibleSizesIn).split(',').map(Number).includes(number(requested[1])))return false;}
 return true;
}
export function sizeQueryWithoutRadius(query:string){return query.replace(new RegExp(`${measurement}\\s*(?:inches|inch|in\\b|["″])?\\s*(?:radius|rad\\b)`,'gi'),'');}
