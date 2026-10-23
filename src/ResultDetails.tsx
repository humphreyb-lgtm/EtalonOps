import {CmsSurface,CmsSource} from './CmsSurface';
import {useEffect,useLayoutEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
export function ResultDetails({description,specs}:{description:string;specs:string[]}){
 const [open,setOpen]=useState(false),[position,setPosition]=useState<CSSProperties>({});const id=useId();
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),pinned=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const stopTimer=()=>{if(timer.current)clearTimeout(timer.current);};
 const close=()=>{stopTimer();pinned.current=false;setOpen(false);};
 const leave=()=>{stopTimer();if(!pinned.current)timer.current=setTimeout(()=>setOpen(false),160);};
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useLayoutEffect(()=>{
  if(!open)return;
  const positionPanel=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;if(r.bottom<0||r.top>window.innerHeight||r.right<0||r.left>window.innerWidth){close();return;}const width=Math.min(420,window.innerWidth-16),above=window.innerHeight-r.bottom<220;setPosition({position:'fixed',width,left:Math.max(8,Math.min(r.left,window.innerWidth-width-8)),...(above?{bottom:window.innerHeight-r.top+6,maxHeight:Math.max(90,r.top-14)}:{top:r.bottom+6,maxHeight:Math.max(90,window.innerHeight-r.bottom-14)})});};
  const outside=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!panel.current?.contains(e.target as Node))close();};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){close();trigger.current?.focus();}};
  const tabAway=(e:FocusEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!panel.current?.contains(e.target as Node))close();};
  positionPanel();window.addEventListener('resize',positionPanel);window.addEventListener('scroll',positionPanel,true);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.addEventListener('focusin',tabAway);
  return()=>{window.removeEventListener('resize',positionPanel);window.removeEventListener('scroll',positionPanel,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.removeEventListener('focusin',tabAway);};
 },[open]);
 if(!specs.length)return null;
 return <><CmsSurface as="button" surfaceId="resultdetails-button-0" surfaceTitle="result-details-button" ref={trigger} type="button" className="result-details-button" aria-label={`Details for ${description}`} aria-expanded={open} aria-controls={open?id:undefined} onMouseEnter={()=>{stopTimer();setOpen(true);}} onMouseLeave={leave} onClick={()=>{if(pinned.current)close();else{pinned.current=true;stopTimer();setOpen(true);requestAnimationFrame(()=>panel.current?.focus());}}}><CmsSource slot="s0-details" title="Details" editableText="true">Details</CmsSource></CmsSurface>
 {open&&createPortal(<div ref={panel} id={id} className="result-spec-popover" role="region" tabIndex={-1} aria-label={`Specifications for ${description}`} style={position} onMouseEnter={stopTimer} onMouseLeave={leave}><div className="result-spec-heading"><CmsSurface as="strong" surfaceId="resultdetails-strong-1" surfaceTitle="strong"><CmsSource slot="s0-specifications" title="Specifications" editableText="true">Specifications</CmsSource></CmsSurface><CmsSurface as="button" surfaceId="resultdetails-button-2" surfaceTitle="Close specifications" type="button" aria-label="Close specifications" onClick={()=>{close();trigger.current?.focus();}}><CmsSource slot="s0-" title="×" editableText="true">×</CmsSource></CmsSurface></div><CmsSurface as="p" surfaceId="resultdetails-p-3" surfaceTitle="result-spec-description" className="result-spec-description"><CmsSource slot="s0-content" title="Content" editableText="false">{description}</CmsSource></CmsSurface><ul>{specs.map((spec,i)=><li key={i}>{spec}</li>)}</ul></div>,document.body)}</>;
}
