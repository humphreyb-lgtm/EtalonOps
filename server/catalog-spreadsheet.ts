import {materialFamily} from '../src/material-families';
export type SpreadsheetKind='material'|'product'|'translation'|'image';
export const materialColumns=['diameterIn','material','type','schedule','lengthIn','endConnection','minSpanIn','maxSpanIn','mounting','nominalSpacing','widthIn','heightIn','depthIn','knockouts','specification'] as const;
const numeric=new Set(['diameterIn','lengthIn','minSpanIn','maxSpanIn','widthIn','heightIn','depthIn']);
const fields:Record<SpreadsheetKind,string[]>={
 material:['displayDescription','details','kind','externalKey','category','productUnit','verification','origin','sourceUrl','verificationBasis',...materialColumns],
 product:['kind','materialKey','manufacturer','partNumber','title','sourceUrl','verification','origin','details'],
 translation:['kind','materialKey','phrase','origin','sourceUrl'],
 image:['kind','materialKey','manufacturer','partNumber','sourceUrl','rightsBasis'],
};
/** Converts visible spreadsheet cells into the existing domain contract; does not relax domain validation. */
export function spreadsheetRecord(kind:SpreadsheetKind,row:Record<string,string>){
 for(const column of Object.keys(row))if(!fields[kind].includes(column)&&!(kind==='material'&&/^attribute\.[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(column)))throw new Error(`Unexpected column ${column} for ${kind}. Keep the template headers unchanged.`);
 const result:Record<string,unknown>={};
 for(const column of fields[kind]){
  if(column==='kind'||(kind==='material'&&(materialColumns as readonly string[]).includes(column)))continue;
  const value=row[column]?.trim();if(value)result[column]=column==='details'?JSON.parse(value):value;
 }
 // Spreadsheet authors must explicitly identify provenance; blank origin must never become admin-reviewed by default.
 if(kind==='material'||kind==='product'||kind==='translation')result.origin=row.origin?.trim()??'';
 if(kind==='material'){
  result.sourceUrl=row.sourceUrl?.trim()??'';
  const attributes:Record<string,string|number>={};
  for(const [column,cell] of Object.entries(row)){
   const value=cell.trim();if(!value)continue;
   if((materialColumns as readonly string[]).includes(column)){
    if(numeric.has(column)){
     if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)||!Number.isFinite(Number(value)))throw new Error(`${column}: use decimal inches, such as 15.75; enter no inch marks, fractions or formulas.`);
     attributes[column]=Number(value);
    }else attributes[column]=value;
   }else if(column.startsWith('attribute.')){
    const name=column.slice(10);if((materialColumns as readonly string[]).includes(name))throw new Error(`Use the ${name} column instead of ${column}.`);
    const family=materialFamily(row['attribute.familyId']);const field=family?.fields.find(f=>f.key===name);attributes[name]=field&&field.kind!=='text'?Number(value):value;
   }
  }
  result.attributes=attributes;
 }
 return result;
}
