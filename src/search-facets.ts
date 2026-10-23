import {parseInches,formatInchText} from './measurements';
export type SearchFacets=Record<string,string[]>;
export const facetLabels:Record<string,string>={family:'Family',type:'Part type',channelSize:'Channel size group',size:'Trade size',finish:'Finish',schedule:'Schedule',construction:'Construction',thread:'Thread size',length:'Stock length',gauge:'Gauge',slots:'Slot pattern',holes:'Hole count'};
const inch=(n:number)=>formatInchText(`${n} in.`).replace(/\s+in\.?$/,' in.');
function numbers(value:unknown):number[]{return String(value??'').split(/\s+\/\s+|[,;]|\s+and\s+/i).flatMap(v=>{try{return [parseInches(v.trim().replace(/(?:inches|inch|in\.?|["″])$/i,'').trim().replace(/^(\d+)-(\d+\/\d+)$/,'$1 $2'))];}catch{return [];}});}
// Owner-approved browsing groups, not a change to any measured specification or
// assertion of interchangeability. Other dimensions retain their recorded size.
export function channelGroup(n:number):number {return ({'0.8125':0.875,'0.9375':0.875,'1.5625':1.625} as Record<string,number>)[String(n)]??n;}
export function materialFacets(a:Record<string,any>,description=''):SearchFacets{
 const f:SearchFacets={},type=String(a.type??'').trim(),strut=/\bstrut\b/i.test(type)||type==='rubber vibration isolation pad';
 const pvc=!strut&&/\bpvc\b/i.test([a.material,a.type,a.specification,a.compatibleConduit,description].join(' '));
 if(strut)f.family=['Unistrut'];else if(pvc)f.family=['PVC'];
 if(type)f.type=[type];if(a.finish)f.finish=[String(a.finish)];if(a.schedule!=null)f.schedule=[String(a.schedule)];
 if(a.diameterIn!=null)f.size=[inch(Number(a.diameterIn))];
 const fit=strut?(type==='strut channel'?numbers(a.depthIn):numbers(a.compatibleChannelDepthIn??a.compatibleChannelDepthsIn)):[];
 if(strut)f.channelSize=fit.length?[...new Set(fit.map(channelGroup).map(inch))]:['Not specified'];
 if(strut&&(a.construction||a.channelConstruction))f.construction=[String(a.construction??a.channelConstruction)];
 if(a.gauge!=null)f.gauge=[String(a.gauge)];if(a.slotPattern)f.slots=[String(a.slotPattern)];if(a.holeCount!=null)f.holes=[String(a.holeCount)];
 if(a.threadSize)f.thread=[String(a.threadSize)+(a.threadPitch&&!String(a.threadSize).includes('-')?'-'+a.threadPitch:'')];
 if(a.lengthIn&&(type==='strut channel'||type==='conduit'))f.length=[Number(a.lengthIn)%12===0?`${Number(a.lengthIn)/12} ft`:inch(Number(a.lengthIn))];
 return f;
}
export function facetMatches(f:SearchFacets|undefined,selected:Record<string,string>){return Object.entries(selected).every(([key,value])=>!value||f?.[key]?.includes(value));}
export function facetOptions(rows:{searchFacets?:SearchFacets}[],selected:Record<string,string>,key:string){return [...new Set(rows.filter(r=>facetMatches(r.searchFacets,{...selected,[key]:''})).flatMap(r=>r.searchFacets?.[key]??[]))].sort((a,b)=>{if(['size','channelSize','length','gauge','holes','thread'].includes(key)){const x=numbers(a.split('-')[0])[0],y=numbers(b.split('-')[0])[0];if(x!=null&&y!=null&&x!==y)return x-y;if(x!=null&&y==null)return -1;if(x==null&&y!=null)return 1;}return a.localeCompare(b,undefined,{numeric:true});});}
export function strutCoupling(a:Record<string,any>){return /^strut (?:flat straight splice plate|splice clevis)$/i.test(String(a.type));}
export function couplingPhrases(a:Record<string,any>):string[]{if(!strutCoupling(a))return [];const size=(materialFacets(a).channelSize??[]).filter(s=>s!=='Not specified');const base=['unistrut coupling','strut coupling','channel coupling','unistrut splice coupling','strut splice coupling','strut joining fitting','unistrut channel joiner','strut channel connector','unistrut coupler','strut coupler','channel joiner','channel splice coupling'];const variants=String(a.type).includes('clevis')?['U shaped strut coupling','unistrut splice clevis coupling']:['flat strut coupling plate','unistrut flat splice coupling','straight strut coupling plate'];
 if(a.holeCount)variants.push(`${a.holeCount} hole strut coupling`,`${a.holeCount} hole unistrut coupling`);
 if(a.finish)variants.push(`${a.finish} strut coupling`,`${a.finish} unistrut coupling`);
 return [...base,...variants,...size.flatMap(s=>{const n=s.replace(/\s*in\.$/,'').replace(/(\d)\s+(\d+\/\d+)/,'$1-$2');return [`${n} unistrut coupling`,`${n} strut coupling`,`${n} strut splice coupling`];})];}
