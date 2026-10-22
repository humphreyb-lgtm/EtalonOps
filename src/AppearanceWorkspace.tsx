import {Children,isValidElement,useEffect,useState,type ComponentProps,type ReactNode} from 'react';
import {elements,currentAppearance,type Appearance} from './appearance';
// Reorder React children, so the visual, keyboard and screen-reader orders agree.
export function AppearanceWorkspace({children,...props}:ComponentProps<'main'>){
 const [appearance,setAppearance]=useState<Appearance>(currentAppearance);
 useEffect(()=>{const receive=(e:Event)=>setAppearance((e as CustomEvent<Appearance>).detail);window.addEventListener('appearance-applied',receive);return()=>window.removeEventListener('appearance-applied',receive);},[]);
 const list=Children.toArray(children);let content:ReactNode=list;
 if(appearance.order.length){const sections=elements.filter(e=>e[2].startsWith('.workspace > .'));const id=(child:ReactNode)=>{if(!isValidElement<{className?:string}>(child))return '';return sections.find(e=>child.props.className?.split(' ').includes(e[2].split('.').at(-1)!))?.[0]??'';};
 const slots=list.map((child,i)=>({child,i,id:id(child)})).filter(v=>v.id);const sorted=[...slots].sort((a,b)=>{const rank=(id:string)=>{const n=appearance.order.indexOf(id);return n<0?100: n;};return rank(a.id)-rank(b.id)||a.i-b.i;});let n=0;content=list.map(child=>id(child)?sorted[n++].child:child);}
 return <main {...props}>{content}</main>;
}
