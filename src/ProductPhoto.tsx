import {CmsSurface,CmsSource} from './CmsSurface';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { databaseMode, imageBlob, request } from './api';
export function ProductPhoto({materialId,description,path,version,productId,fallback,zoomable=false}: {zoomable?:boolean;materialId?:string;productId?:string|null;description:string;path?:string;version?:string;fallback:ReactNode}) {
  const preview=useRef<HTMLDialogElement>(null);
  const [url,setUrl]=useState(''),[refresh,setRefresh]=useState(0);const failed=useRef(false);useEffect(()=>{const reload=()=>setRefresh(value=>value+1);window.addEventListener('catalog-images-changed',reload);return()=>window.removeEventListener('catalog-images-changed',reload);},[]);const slot=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    preview.current?.close();setUrl('');failed.current=false;if(!databaseMode||!materialId)return;
    let cancelled=false,owned='',requested=false;setUrl('');
    const load=()=>{
      if(requested||cancelled)return;requested=true;
      imageBlob(path??`/materials/${materialId}/image${productId?`?productId=${encodeURIComponent(productId)}`:''}`).then(blob=>{if(!cancelled){owned=URL.createObjectURL(blob);setUrl(owned);}}).catch(()=>{if(path||cancelled)return;void request<{url:string|null}>(`/materials/${materialId}/image-reference${productId?`?productId=${encodeURIComponent(productId)}`:''}`).then(result=>{if(!cancelled&&result.url&&/^https:\/\//i.test(result.url))setUrl(result.url);}).catch(()=>{});});
    };
    let observer:IntersectionObserver|undefined;
    if(slot.current&&typeof IntersectionObserver!=='undefined'){
      observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();load();}},{rootMargin:'200px'});observer.observe(slot.current);
    }else load();
    return()=>{cancelled=true;observer?.disconnect();if(owned)URL.revokeObjectURL(owned);};
  },[materialId,path,version,productId,refresh]);
  const photo=url ? <img className="approved-product-photo" referrerPolicy="no-referrer" src={url} alt={description} onError={()=>{setUrl('');if(!path&&materialId&&!failed.current&&url.startsWith('blob:')){failed.current=true;void request<{url:string|null}>(`/materials/${materialId}/image-reference${productId?'?productId='+encodeURIComponent(productId):''}`).then(value=>{if(value.url&&/^https:\/\//i.test(value.url))setUrl(value.url);}).catch(()=>{});}}} /> : fallback;
  return <div ref={slot} className="product-photo-slot">{url&&zoomable?<CmsSurface as="button" surfaceId="productphoto-button-0" surfaceTitle="product-photo-zoom" type="button" className="product-photo-zoom" title="Click to enlarge" aria-label={`Enlarge image: ${description}`} onClick={()=>preview.current?.showModal()}><CmsSource slot="s0-content" title="Content" editableText="false">{photo}</CmsSource></CmsSurface>:photo}
  {zoomable&&<CmsSurface as="dialog" surfaceId="productphoto-dialog-1" surfaceTitle="Product image preview" ref={preview} className="product-image-preview" aria-label="Product image preview" onClick={event=>{if(event.target===event.currentTarget)preview.current?.close();}}><CmsSource slot="s0-image-preview-heading" title="image-preview-heading" editableText="false"><div className="image-preview-heading"><CmsSurface as="strong" surfaceId="productphoto-strong-2" surfaceTitle="strong"><CmsSource slot="s0-product-image" title="Product image" editableText="true">Product image</CmsSource></CmsSurface><CmsSurface as="button" surfaceId="productphoto-button-3" surfaceTitle="Close image preview" type="button" className="button secondary" aria-label="Close image preview" onClick={()=>preview.current?.close()}><CmsSource slot="s0-close" title="Close" editableText="true">Close</CmsSource></CmsSurface></div></CmsSource><CmsSource slot="s1-img" title="img" editableText="false">{url&&<img src={url} alt={description} referrerPolicy="no-referrer"/>}</CmsSource><CmsSource slot="s2-p" title="p" editableText="false"><CmsSurface as="p" surfaceId="productphoto-p-4" surfaceTitle="p"><CmsSource slot="s0-content" title="Content" editableText="false">{description}</CmsSource></CmsSurface></CmsSource></CmsSurface>}</div>;
}
