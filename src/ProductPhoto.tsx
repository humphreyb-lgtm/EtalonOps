import { useEffect, useState, type ReactNode } from 'react';
import { databaseMode, imageBlob } from './api';
export function ProductPhoto({materialId,description,path,version,fallback}: {materialId?:string;description:string;path?:string;version?:string;fallback:ReactNode}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{
    if(!databaseMode||!materialId)return;
    let cancelled=false,owned='';setUrl('');
    imageBlob(path??`/materials/${materialId}/image`).then(blob=>{if(!cancelled){owned=URL.createObjectURL(blob);setUrl(owned);}}).catch(()=>{});
    return()=>{cancelled=true;if(owned)URL.revokeObjectURL(owned);};
  },[materialId,path,version]);
  return url ? <img className="approved-product-photo" src={url} alt={description} onError={()=>setUrl('')} /> : fallback;
}
