// Bounded validation for a streamed review export. The footer is mandatory:
// losing the connection must never commit an apparently successful partial file.
export function catalogStreamValidator(){
 const decoder=new TextDecoder('utf-8',{fatal:true});let pending='',started=false,complete=false,count=0;
 const counts:Record<string,number>=Object.create(null);let tenant='';
 function line(text:string){
  if(complete)throw new Error('Unexpected data after export completion.');
  const value=JSON.parse(text);
  if(!started){
   if(value.type!=='manifest'||value.format!=='etalonops-catalog-stream'||value.version!==1||typeof value.tenant!=='string'||!Array.isArray(value.tables)||new Set(value.tables).size!==value.tables.length||!value.tables.every((table:unknown)=>typeof table==='string'))throw new Error('Unexpected catalog export format.');
   for(const table of value.tables)counts[table]=0;tenant=value.tenant;started=true;return;
  }
  if(value.type==='record'){
   if(!Object.hasOwn(counts,value.table)||!value.row||value.row.tenant!==tenant)throw new Error('Catalog export contains an invalid record.');
   counts[value.table]++;count++;return;
  }
  if(value.type!=='complete'||value.recordCount!==count||!value.tableCounts||Object.keys(value.tableCounts).length!==Object.keys(counts).length||Object.keys(counts).some(table=>value.tableCounts[table]!==counts[table])||typeof value.sha256!=='string'||!/^[a-f\d]{64}$/.test(value.sha256))throw new Error('Catalog export completion check failed.');
  complete=true;
 }
 return {
  push(chunk:Uint8Array){pending+=decoder.decode(chunk,{stream:true});let index:number;while((index=pending.indexOf('\n'))>=0){if(index>8000000)throw new Error('Catalog export record exceeds the supported size.');line(pending.slice(0,index));pending=pending.slice(index+1);}if(pending.length>8000000)throw new Error('Catalog export record exceeds the supported size.');return count;},
  finish(){pending+=decoder.decode();if(pending||!started||!complete)throw new Error('Catalog export was incomplete. No file was committed.');return count;}
 };
}
