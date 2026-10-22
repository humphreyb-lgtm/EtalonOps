import {appearanceComponents} from './appearance-components';
// Label-derived identifiers cover forms that do not have a hand-authored input ID.
// Repeated rows deliberately share styling instead of binding a design to a record UUID.
export function instrumentAppearanceFields(doc:Document){
 const update=()=>{for(const input of doc.querySelectorAll<HTMLInputElement>('input,select,textarea')){
  if(input.closest('.appearance-studio,.designer-paper')||['hidden','checkbox','radio'].includes(input.type))continue;
  const label=input.labels?.[0];if(!label)continue;
  const copy=label.cloneNode(true) as Element;copy.querySelectorAll('input,select,textarea,button,small').forEach(e=>e.remove());
  const text=copy.textContent?.trim();if(!text)continue;
  let parent:Element|null=label;let scope='site';while(parent){const name=Array.from(parent.classList).reverse().find(c=>appearanceComponents.includes(c as typeof appearanceComponents[number]));if(name){scope=name;break;}parent=parent.parentElement;}
  const slug=text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);if(!slug)continue;
  const key=scope+':'+slug;input.dataset.appearanceField=key;const container=label.contains(input)?label:input.parentElement;if(container)container.setAttribute('data-appearance-container',key);
 }};update();const observer=new MutationObserver(update);observer.observe(doc.body,{childList:true,subtree:true});return()=>observer.disconnect();
}
