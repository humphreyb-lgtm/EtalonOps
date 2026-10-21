import {materialFamily,inferredFamily} from '../src/material-families';
import {formatInches} from '../src/measurements';
import {ApiError} from './contracts';
const fail=(text:string):never=>{throw new ApiError(400,text);};
export function familyDescription(category:string,a:Record<string,string|number>):string|undefined{
 if(!a.familyId)return;
 const f=materialFamily(a.familyId);if(!f)return fail('Choose a supported material family.');
 if(f.category!==category)fail('Family '+f.name+' requires category '+f.category+'.');
 if(a.configurationStatus&&a.configurationStatus!=='confirmed')fail('Unconfirmed configurations must remain in the workbook for research; they cannot be published.');
 for(const field of f.fields){const v=a[field.key];if(v===undefined||String(v).trim()==='')fail(field.label+' is required for '+f.name+'.');if(field.kind!=='text'&&(typeof v!=='number'||!Number.isFinite(v)||v<=0))fail(field.label+' must be a positive numeric value.');}
 if(!a.type)fail('Type / Name is required.');
 if(!['generic-hardware','generic-drill-bit','generic-material','pvc-box','pvc-consumable','pvc-cap','pvc-strap','pvc-support'].includes(f.id)&&String(a.type).toLowerCase()!==f.type)fail('Use Type / Name: '+f.type+'. Put alternate names in Search Phrases.');
 if(f.id.startsWith('pvc-')&&!['pvc-strap','pvc-support','pvc-consumable'].includes(f.id)&&String(a.material).toLowerCase()!=='pvc')fail('This family is for PVC. Choose another family for other construction materials.');
 if(a.schedule&&!['40','80'].includes(String(a.schedule)))fail('Initial PVC families support Schedule 40 or 80.');
 if(a.angleDeg&&Number(a.angleDeg)>180)fail('Bend angle must be at most 180 degrees.');
 if(a.radiusClass&&!['standard','long radius','custom'].includes(String(a.radiusClass)))fail('Radius Class: use standard, long radius or custom.');
 if(a.sizeAIn&&a.sizeBIn&&Number(a.sizeAIn)<=Number(a.sizeBIn))fail('Reducing fittings: End A must be the larger size; keep its connection paired with that size.');
 if(f.id==='duct-bank-spacer'){
 const sizes=String(a.compatibleSizesIn).split(',').map(s=>Number(s.trim()));if(sizes.some(n=>!Number.isFinite(n)||n<=0)||new Set(sizes).size!==sizes.length)fail('Compatible sizes: use unique decimal inches separated by commas.');if(!Number.isInteger(a.conduitCount))fail('Conduit count must be a positive whole number.');
 }
 const inch=(k:string)=>formatInches(a[k]),size=()=>`${inch('diameterIn')} in.`,ends=()=>`${a.connectionA} × ${a.connectionB}`;
 switch(f.id){
 case 'pvc-conduit':return `${size()} PVC conduit, Schedule ${a.schedule}, ${Number(a.lengthIn)%12===0?`${Number(a.lengthIn)/12} ft.`:`${inch('lengthIn')} in.`} length, ${a.endConnection}`;
 case 'pvc-factory-bend':return `${size()} PVC ${a.radiusClass==='standard'?'factory elbow':'sweep'}, Schedule ${a.schedule}, ${a.angleDeg}°, ${a.radiusClass==='standard'?'standard radius, ':''}${inch('radiusIn')} in. radius, ${a.endConnection}`;
 case 'pvc-box':return `PVC ${a.type}, ${inch('lengthIn')} × ${inch('widthIn')} × ${inch('depthIn')} in., ${a.cover}, ${a.mounting}, ${a.entries}, ${a.rating}`;
 case 'pvc-conduit-body':return `${size()} PVC ${a.bodyType} conduit body, ${a.cover}, ${a.entries}, ${a.rating}`;
 case 'duct-bank-spacer':return `${a.position} duct-bank spacer, ${a.compatibleSizesIn} in. conduit, ${inch('horizontalSpacingIn')} × ${inch('verticalSpacingIn')} in. centers, ${a.conduitCount}-way, ${a.material}, ${a.system}`;
 case 'pvc-consumable':return `${a.type}, ${a.volumeOz} fl oz, ${a.grade}, ${a.specification}`;
 }
 if(a.sizeAIn)return `${inch('sizeAIn')} × ${inch('sizeBIn')} in. ${a.material} ${a.type}, ${ends()}`;
 if(a.connectionA)return `${size()} ${a.material} ${a.type}, ${ends()}${a.travelIn?`, ${inch('travelIn')} in. travel`:''}${a.specification?`, ${a.specification}`:''}`;
 return `${a.diameterIn?size()+' ':''}${a.material?a.material+' ':''}${a.type}, ${a.specification}`;
}
// Identity uses physical fields, not labels, research status, or display wording.
export function familyIdentityFields(category:string,a:Record<string,unknown>){const f=inferredFamily({...a,category});if(!f)return null;return new Set(Object.keys(a).filter(k=>!['familyId','configurationStatus','radiusClass'].includes(k)&&(k!=='specification'||f.identity.includes(k))));}
