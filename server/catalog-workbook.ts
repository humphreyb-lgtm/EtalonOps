import readXlsxFile from 'read-excel-file/node';
import {unzipSync,strFromU8} from 'fflate';
import {parse} from 'csv-parse/sync';
import {randomUUID} from 'node:crypto';
import {ApiError} from './contracts';
import type {InboxItem} from './catalog-inbox';
const sheetKinds:Record<string,InboxItem['kind']>={Conduit:'material',Supports:'material',Boxes:'material','Other Parts':'material','Manufacturer Products':'product',Translations:'translation','Image References':'image'};
function rowsToItems(sheet:string,rows:unknown[][],kind?:InboxItem['kind']):InboxItem[]{
 if(!rows.length)return [];const headers=rows[0].map(v=>v==null?'':String(v).trim());if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new ApiError(400,`${sheet}: use nonempty unique column headers.`);
 return rows.slice(1).flatMap((row,index)=>{if(!row.some(v=>v!=null&&String(v).trim()))return [];if(row.length>headers.length)throw new ApiError(400,`${sheet} row ${index+2}: too many cells.`);const fields:Record<string,string>={};headers.forEach((header,i)=>{const value=row[i];if(value instanceof Date||typeof value==='boolean')throw new ApiError(400,`${sheet} row ${index+2}: use text or numeric cells.`);fields[header]=value==null?'':String(value);});const recordKind=kind??fields.kind;if(!['material','product','translation','image'].includes(recordKind))throw new ApiError(400,`${sheet} row ${index+2}: unknown record kind.`);if(kind&&fields.kind&&fields.kind!==kind)throw new ApiError(400,`${sheet}: record kind does not match its worksheet.`);fields.kind=recordKind;
 if(fields.data_json){let value:any;try{value=JSON.parse(fields.data_json);}catch{throw new ApiError(400,`${sheet} row ${index+2}: invalid data_json.`);}delete fields.data_json;for(const [key,v] of Object.entries(value)){if(key==='attributes'&&v&&typeof v==='object'){for(const [attribute,cell] of Object.entries(v))fields[attribute]=String(cell);}else fields[key]=key==='details'&&v&&typeof v==='object'?JSON.stringify(v):String(v??'');}}
 return [{id:randomUUID(),kind:recordKind as InboxItem['kind'],sheet,row:index+2,fields,state:'unpublished' as const}];});
}
export async function parseWorkbookUpload(filename:string,buffer:Buffer){
 if(buffer.length>3000000)throw new ApiError(413,'Use an Excel or CSV file smaller than 3 MB.');let items:InboxItem[]=[];const ignoredSheets:string[]=[];
 if(filename.toLowerCase().endsWith('.xlsx')){
  const sheets=await readSafeWorkbook(buffer);for(const sheet of sheets){const kind=sheetKinds[sheet.sheet];if(kind)items.push(...rowsToItems(sheet.sheet,sheet.data,kind));else ignoredSheets.push(sheet.sheet);}
 }else if(filename.toLowerCase().endsWith('.csv')){let rows:unknown[][];try{rows=parse(buffer.toString('utf8'),{bom:true,skip_empty_lines:true,max_record_size:20000});}catch{throw new ApiError(400,'Invalid CSV file.');}items=rowsToItems('CSV',rows);}
 else throw new ApiError(400,'Choose an .xlsx workbook or .csv file.');
 if(!items.length||items.length>2000)throw new ApiError(400,'Upload 1–2,000 data rows using the catalog template worksheets.');
 return {filename,items,ignoredSheets};
}

export async function readSafeWorkbook(buffer:Buffer){
 if(buffer.length>3000000)throw new ApiError(413,'Use a workbook smaller than 3 MB.');
  let total=0,count=0;
  try{const entries=unzipSync(buffer,{filter:entry=>{count++;total+=entry.originalSize;if(count>500||entry.originalSize>8000000||total>20000000)throw Error('Workbook expands beyond the supported size.');return true;}});for(const [name,value] of Object.entries(entries)){if(/vbaProject|externalLinks/i.test(name))throw Error('Use a workbook without macros or external workbook links.');if(/\.xml$/i.test(name)&&/<!DOCTYPE|<!ENTITY/i.test(strFromU8(value)))throw Error('Workbook XML entity declarations are not supported.');if(/\.xml$/i.test(name)&&/<(?:[A-Za-z]+:)?f(?:\s|>)/.test(strFromU8(value)))throw Error('Save formula cells as values before uploading. Formulas are not imported.');}}
  catch(e){throw new ApiError(400,e instanceof Error?e.message:'Invalid Excel workbook.');}
 return readXlsxFile(buffer);
}
