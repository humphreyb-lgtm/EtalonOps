import { useEffect, useRef, useState, type ReactNode } from 'react';
import { databaseMode, imageBlob } from './api';
export function ProductPhoto({materialId,description,path,version,productId,fallback}: {materialId?:string;productId?:string|null;description:string;path?:string;version?:string;fallback:ReactNode}) {
  const [url,setUrl]=useState('');const slot=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!databaseMode||!materialId)return;
    let cancelled=false,owned='',requested=false;setUrl('');
    const load=()=>{
      if(requested||cancelled)return;requested=true;
      imageBlob(path??`/materials/${materialId}/image${productId?`?productId=${encodeURIComponent(productId)}`:''}`).then(blob=>{if(!cancelled){owned=URL.createObjectURL(blob);setUrl(owned);}}).catch(()=>{});
    };
    let observer:IntersectionObserver|undefined;
    if(slot.current&&typeof IntersectionObserver!=='undefined'){
      observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();load();}},{rootMargin:'200px'});observer.observe(slot.current);
    }else load();
    return()=>{cancelled=true;observer?.disconnect();if(owned)URL.revokeObjectURL(owned);};
  },[materialId,path,version,productId]);
  return <div ref={slot} className="product-photo-slot">{url ? <img className="approved-product-photo" src={url} alt={description} onError={()=>setUrl('')} /> : fallback}</div>;
}
