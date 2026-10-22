export const designRoles=['heading1','heading2','heading3','body','label','field','button','primaryButton','small','tableHeading','tableCell'] as const;
export const fontFaces=['system','Arial','Segoe UI','Verdana','Georgia','Times New Roman','Courier New'] as const;
export type TextStyle={font:typeof fontFaces[number];size:number;weight:number;color:string;lineHeight:number;paddingX:number;paddingY:number};
export type Design=Record<typeof designRoles[number],TextStyle>;
const style=(size:number,weight=400,color='#111a35',paddingY=0,paddingX=0):TextStyle=>({font:'system',size,weight,color,lineHeight:1.4,paddingX,paddingY});
export const defaultDesign:Design={heading1:style(28,600),heading2:style(20,600),heading3:style(16,600),body:style(14),label:style(12,500,'#52617d',1),field:style(14,400,'#111a35',4,8),button:style(14,600,'#111a35',4,10),primaryButton:style(14,600,'#ffffff',4,10),small:style(12,400,'#64718c'),tableHeading:style(12,500,'#52617d',4,8),tableCell:style(14,400,'#111a35',5,8)};
const font=(value:string)=>value==='system'?'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif':`"${value}", ${/Georgia|Times/.test(value)?'serif':value==='Courier New'?'monospace':'sans-serif'}`;
export function designCSS(d:Design,scope=''){
 const s=(selector:string)=>selector.split(',').map(v=>scope+' '+v.trim()+':not(.designer-paper *):not(.designer-workspace-modal *):not(.appearance-studio *):not([data-cms-editor] *)').join(',');
 const text=(r:TextStyle)=>`font-family:${font(r.font)}!important;font-size:${r.size}px!important;font-weight:${r.weight}!important;color:${r.color}!important;line-height:${r.lineHeight}!important;`;
 const pad=(r:TextStyle)=>`padding:${r.paddingY}px ${r.paddingX}px!important;`;
 const control=Math.ceil(d.field.size*d.field.lineHeight+2*d.field.paddingY+2);
 const buttonHeight=Math.ceil(d.button.size*d.button.lineHeight+2*d.button.paddingY+2);
 return `${scope||'body'}{${text(d.body)}}\n${s('p,.body-copy')}{${text(d.body)}${pad(d.body)}}\n`+
 (['heading1','heading2','heading3'] as const).map((r,i)=>`${s('h'+(i+1))}{${text(d[r])}${pad(d[r])}}`).join('\n')+
 `${s('label,.field > label')}{${text(d.label)}${pad(d.label)}}\n`+
 `${s('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),select,textarea')}{${text(d.field)}${pad(d.field)}min-height:${control}px!important;}\n${s('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),select')}{height:${control}px!important;}\n`+
 `${s('.button')}{${text({...d.button,color:d.button.color})}${pad(d.button)}min-height:${buttonHeight}px!important;}\n`+
 `${s('.button.primary')}{${text(d.primaryButton)}${pad(d.primaryButton)}}\n${s('.button:disabled')}{color:#66718a!important;}\n${s('th,[role=columnheader]')}{${text(d.tableHeading)}${pad(d.tableHeading)}}\n${s('td,[role=cell]')}{${text(d.tableCell)}${pad(d.tableCell)}}\n${s('small,.fine-print,.muted')}{${text(d.small)}${pad(d.small)}}\n`;
}
export function applyDesign(d:Design){let el=document.getElementById('global-design-style') as HTMLStyleElement|null;if(!el){el=document.createElement('style');el.id='global-design-style';document.head.append(el);}el.textContent=designCSS(d);}
