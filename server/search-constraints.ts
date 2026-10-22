import {searchLanguage} from './search-language';
// These checks apply to explicit, typed requests, including exact learned aliases.
// Unknown requirements are returned for review, never asserted as verified.
export function searchConstraints(query:string,a:Record<string,any>){
 const q=searchLanguage(query),missing:string[]=[],conflicts:string[]=[];
 const canonical=(v:any)=>searchLanguage(String(v??'')).replace(/[- ]+/g,' ').trim();
 const number=(v:any)=>{const s=canonical(v);return /^\d+(?:\.\d+)?(?:\s*(?:tpi|unc|unf))?$/.test(s)?Number.parseFloat(s):NaN;};
 const check=(field:string,value:any,label:string,numeric=false)=>{if(a[field]==null||a[field]==='')missing.push(label+' not recorded');else if(numeric?number(a[field])!==Number(value):canonical(a[field])!==canonical(value))conflicts.push(label+' differs');};
 const thread=q.match(/(?<![\w.])(\d+(?:\.\d+)?)-(\d+)\s*(?:unc\b|unf\b|thread\b|spring\b|channel\b|strut\b|nut\b|swivel\b|u[ -]bolt\b)/);
 if(thread&&a.threadSize!=null){const size=String(a.threadSize);const diameter=Number.parseFloat(searchLanguage(size).split('-')[0]);if(diameter!==Number(thread[1]))conflicts.push('Thread diameter differs');check('threadPitch',Number(thread[2]),'Thread pitch',true);}
 const nutSize=q.match(/^(\d+(?:\.\d+)?)\s+(?:(?:strut|channel|standard|short|long|spring|springless|steel|zincplated)\s+)*nut\b/);if(nutSize&&a.threadSize!=null){const actual=Number.parseFloat(searchLanguage(String(a.threadSize)).split('-')[0]);if(actual!==Number(nutSize[1]))conflicts.push('Thread diameter differs');}
 const gauge=q.match(/\b(\d+)\s*gauge\b/);if(gauge)check('gauge',gauge[1],'Gauge',true);
 const coating=q.match(/\b(pregalvanized|hotdipgalvanized|electrogalvanized|zincplated)\b/);if(coating){if(a.finish==null)missing.push('Finish not recorded');else if(!canonical(a.finish).includes(coating[1]))conflicts.push('Finish differs');}
 const type=canonical(a.type);
 const bare=q.replace(/[.,](?!\d)/g,' ').replace(/\s+/g,' ').trim();
 // An unqualified strut size/profile asks for channel stock, not every accessory
 // whose compatibility notes happen to mention that channel.
 if(/^(?:(?:\d+(?:\.\d+)?|shallow|deep|double|single|solid|slotted|halfslot|longslot)\s+)*(?:strut|strut channel)(?:\s+\d+(?:\.\d+)?)?$/.test(bare)&&type!=='strut channel')conflicts.push('Requested channel stock');
 if(/\bchannel nut\b/.test(q.split(',')[0])&&!/beam|clamp|washer|bolt|hanger|swivel/.test(q.split(',')[0])&&type!=='strut channel nut')conflicts.push('Requested channel nut');
 const tuple=q.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(?:(?:steel|strut|soft|vinyl|polyurethane|end|single|double|plastic|back-to-back)\s+)*(?:channel|cap|insert)\b/);
 if(tuple&&/cap|end insert/.test(type)&&!q.includes('combined')){
  check('compatibleChannelWidthIn',tuple[1],'Channel fit width',true);
  check('compatibleChannelDepthIn',tuple[2],'Channel fit depth',true);
 }
 const orientation=q.match(/(\d+(?:\.\d+)?)\s*(?:°|degrees?)\s*orientation/);
 if(orientation&&type==='strut post base')check(a.postRotationDegrees!=null?'postRotationDegrees':'postOrientationDegrees',orientation[1],'Post orientation',true);
 if(type==='rubber vibration isolation pad'){const size=q.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s/);if(size){check('widthIn',size[1],'Pad width',true);check('heightIn',size[2],'Pad height',true);}}
 const thick=q.match(/(\d+(?:\.\d+)?)\s*(?:thick|thickness)\b/);
 if(thick&&a.bodyThicknessIn!=null)check('bodyThicknessIn',thick[1],'Body thickness',true);

 if(type==='strut channel'){
  // Only a dimension tuple preceding the channel name denotes its width/depth.
  const tuple=q.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(?:steel\s+)?(?:strut\s+)?channel\b/);
  if(tuple){check('widthIn',tuple[1],'Channel width',true);check('depthIn',tuple[2],'Channel depth',true);}
  if(/\bshallow\b/.test(q)&&Number(a.depthIn)>=1.625)conflicts.push('Channel depth differs');
  if(/\bdeep\b/.test(q)&&Number(a.depthIn)<1.625)conflicts.push('Channel depth differs');
  if(/\bdouble\b/.test(q))check('construction','back-to-back','Channel construction');
  if(/\bsingle\b/.test(q))check('construction','single','Channel construction');
  if(/\bsolid\b/.test(q))check('slotPattern','none','Slot pattern');
  if(/\bhalfslot\b/.test(q)&&!/half|short oblong/.test(canonical(a.slotPattern)))conflicts.push('Slot pattern differs');
  if(/\blongslot\b/.test(q)&&!/long/.test(canonical(a.slotPattern)))conflicts.push('Slot pattern differs');
  if(/\bslotted\b/.test(q)&&a.slotPattern==='none')conflicts.push('Slot pattern differs');
 }
 if(/\bspringless\b/.test(q)&&a.springType!=null&&!/none|absent|no spring|springless/.test(canonical(a.springType)))conflicts.push('Spring type differs');
 if(/\b(?:spring nut|(?:standard|short|long) spring)\b/.test(q)&&type==='strut channel nut'&&(!a.springType||!/spring/.test(canonical(a.springType))||/springless|no spring|absent|none/.test(canonical(a.springType))))conflicts.push('Spring type differs');
 if(/\b(?:emt|imc|rmc|rigid)\b/.test(q)&&/conduit clamp/.test(type)){
  const systems=canonical([a.conduitSystem,a.additionalVerifiedConduitSystem].join(' '));
  for(const system of ['emt','imc','rigid'])if(new RegExp(`\\b${system}\\b`).test(q)&&!new RegExp(`\\b${system}\\b`).test(systems))conflicts.push('Conduit system differs');
 }
 if(/\bhard\b/.test(q)&&/cap|insert/.test(type)&&!a.hardnessDurometer&&!a.flexibility)missing.push('Cap hardness not recorded');
 if(/\bsoft\b/.test(q)&&/cap|insert/.test(type))check('flexibility','soft','Cap flexibility');
 return {missing,conflicts};
}
