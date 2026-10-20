import {cellBorders,cellRect,completeGrid,paperSize,type DocumentLayout,type LayoutCell,type LayoutGrid} from './document-layout';
export type RowMode='auto'|'locked';
export type CellMeasure=(cell:LayoutCell,width:number)=>number;
export const rowMode=(grid:LayoutGrid,index:number):RowMode=>grid.rowModes?.[index]??'locked';
const sum=(values:number[])=>values.reduce((a,b)=>a+b,0);
export function requiredCellHeight(c:LayoutCell,width:number,text:string,measure:(text:string)=>number){
 if(c.kind==='empty'||c.kind==='logo'||c.kind==='items'||c.kind==='field'&&c.binding==='item.image')return 0;
 if(c.hideEmpty&&!text)return 0;
 if(c.kind==='field'&&c.binding==='item.noSubstitutions')return 12+c.padding*2+(c.label?8:0);
 const available=Math.max(5,width-c.padding*2);let count=0;
 for(const paragraph of text.split('\n')){let current='';for(const word of paragraph.split(/\s+/)){const candidate=current?current+' '+word:word;if(measure(candidate)<=available){current=candidate;continue;}if(current)count++;current='';for(const char of word){if(current&&measure(current+char)>available){count++;current='';}current+=char;}}count++;}
 return Math.max(1,count)*c.fontSize*1.2+c.padding*2+(c.label?8:0)+(c.kind==='field'?4:2);
}
export function editorMeasure(c:LayoutCell,width:number){
 if(['empty','logo','items'].includes(c.kind)||c.kind==='field'&&c.binding==='item.image')return 0;
 const text=c.kind==='text'?c.text.replace(/\{[^}]+\}/g,'Example'):'';
 let context:CanvasRenderingContext2D|null=null;if(typeof document!=='undefined'){context=document.createElement('canvas').getContext('2d');if(context)context.font=`${c.italic?'italic ':''}${c.bold?'bold ':''}${c.fontSize}px ${c.font==='Times'?'Times New Roman':c.font==='Courier'?'Courier New':'Arial'}`;}
 return requiredCellHeight(c,width,text,t=>context?context.measureText(t).width:[...t].reduce((n,ch)=>n+c.fontSize*(c.font==='Courier'?.6:/[ilI.,' ]/.test(ch)?.28:/[MW@]/.test(ch)?.85:.53),0));
}
function spareRow(grid:LayoutGrid,index:number){return rowMode(grid,index)==='auto'&&grid.cells.filter(c=>c.row<=index&&c.row+c.rowSpan>index).every(c=>c.kind==='empty'&&c.rowSpan===1&&c.background==='#ffffff'&&Object.values(cellBorders(c)).every(v=>v===(grid.emptyBorder??true))&&!c.bold&&!c.italic);}
export function sizeGrid(input:LayoutGrid,width:number,measure:CellMeasure=editorMeasure,pageHeight?:number){
 if(!input.rowModes)return {grid:input,warnings:pageHeight!==undefined&&sum(input.rows)>pageHeight+.1?['Grid exceeds the page margins. Reduce row heights or unlock blank rows.']:[]};
 const base=input.rowBaseHeight??Math.min(...input.rows),rows=input.rows.map((h,i)=>rowMode(input,i)==='auto'?base:h);let grid:LayoutGrid={...input,rows,rowModes:[...input.rowModes]},warnings:string[]=[];
 // Meet every merged cell's minimum height without changing locked rows.
 for(const c of grid.cells){const rect=cellRect(grid,c,width),required=c.kind==='items'?60:measure(c,rect.width),missing=required-rect.height;if(missing<=.1)continue;const auto=Array.from({length:c.rowSpan},(_,i)=>c.row+i).filter(i=>rowMode(grid,i)==='auto');if(auto.length){let left=missing;for(const i of auto){const add=Math.min(2000-grid.rows[i],left/(auto.length-auto.indexOf(i)));grid.rows[i]+=add;left-=add;}if(left>.1)warnings.push(`Row ${c.row+1}: content exceeds the maximum automatic row height. Shorten the text or merge additional rows.`);}else warnings.push(`Row ${c.row+1}: content needs ${Math.ceil(required)} pt, but its height is locked. Enlarge or unlock the row.`);}
 if(pageHeight!==undefined){
  // Delete only spare, unmerged, automatic blank rows, starting at the bottom.
  for(let i=grid.rows.length-1;i>=0&&sum(grid.rows)>pageHeight+.1;i--){if(!spareRow(grid,i)||grid.rows.length===1)continue;const excess=sum(grid.rows)-pageHeight;if(grid.rows[i]-excess>=12){grid.rows[i]-=excess;break;}grid={...grid,rows:grid.rows.filter((_,r)=>r!==i),rowModes:grid.rowModes!.filter((_,r)=>r!==i),cells:grid.cells.filter(c=>c.row!==i).map(c=>c.row>i?{...c,row:c.row-1}:c)};}
  let free=pageHeight-sum(grid.rows);while(free>=base-.1&&grid.rows.length<40){grid={...grid,rows:[...grid.rows,base],rowModes:[...grid.rowModes!,'auto']};free-=base;}
  grid=completeGrid(grid);if(free>0){for(let i=grid.rows.length-1;i>=0;i--)if(spareRow(grid,i)){grid.rows[i]+=free;break;}}
  if(sum(grid.rows)>pageHeight+.1)warnings.push(`Not enough blank space: ${Math.ceil(sum(grid.rows)-pageHeight)} pt exceeds the page margins. Content is preserved. Shorten text, reduce padding, enlarge the page or unlock blank rows.`);
 }
 return {grid,warnings:[...new Set(warnings)]};
}
export function sizeLayout(input:DocumentLayout,measure:CellMeasure=editorMeasure){const [w,h]=paperSize(input),width=w-input.margins.left-input.margins.right,height=h-input.margins.top-input.margins.bottom,first=sizeGrid(input.first,width,measure,height),continuation=sizeGrid(input.continuation,width,measure,height),item=sizeGrid(input.item,width,measure);return {layout:{...input,first:first.grid,continuation:continuation.grid,item:item.grid},warnings:[...first.warnings.map(w=>'First page: '+w),...continuation.warnings.map(w=>'Continuation page: '+w),...item.warnings.map(w=>'Repeating item: '+w)]};}

export function resizeGrid(grid:LayoutGrid,count:number,columns:number,pageHeight?:number){
 if(!Number.isInteger(count)||count<1||count>40||!Number.isInteger(columns)||columns<2||columns>16)throw Error('Choose 1–40 rows and 2–16 columns.');
 if(count<grid.rows.length){if(grid.rows.some((_,i)=>i>=count&&rowMode(grid,i)==='locked'))throw Error('Unlock the blank rows you want to remove first.');if(grid.cells.some(c=>c.row+c.rowSpan>count&&(c.kind!=='empty'||c.rowSpan>1)))throw Error('The smaller grid would cut through content or merged cells. Move or split them first.');}
 if(columns<grid.columns&&grid.cells.some(c=>c.col+c.colSpan>columns&&(c.kind!=='empty'||c.colSpan>1)))throw Error('The smaller grid would cut through content or merged cells. Move or split them first.');
 const base=count!==grid.rows.length&&pageHeight!==undefined?Math.max(12,pageHeight/count):grid.rowBaseHeight??Math.min(...grid.rows),rows=Array.from({length:count},(_,i)=>grid.rows[i]??base),rowModes=grid.rowModes||count>grid.rows.length?rows.map((_,i)=>i<grid.rows.length?rowMode(grid,i):'auto' as const):undefined;
 return completeGrid({...grid,columns,rows,rowModes,rowBaseHeight:base,columnWidths:grid.columnWidths?Array.from({length:columns},(_,i)=>grid.columnWidths?.[i]??100):undefined,cells:grid.cells.filter(c=>c.row<count&&c.col<columns)});
}
