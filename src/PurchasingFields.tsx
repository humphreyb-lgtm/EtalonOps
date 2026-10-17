import { useEffect,useState } from 'react';
import { databaseMode,request } from './api';
import type { Line,ManufacturerProduct,Purchasing } from './domain';
export const emptyPurchasing:Purchasing={productId:null,manufacturer:'',partNumber:'',noSubstitutions:false};
export function PurchasingFields({line,projectId,onChange}:{line:Line;projectId:string;onChange:(value:Purchasing)=>void}){
  const [products,setProducts]=useState<ManufacturerProduct[]>([]),[error,setError]=useState('');
  const value=line.purchasing??emptyPurchasing;
  useEffect(()=>{let active=true;setProducts([]);setError('');if(databaseMode&&line.candidate&&/^[a-f\d-]{36}$/i.test(line.candidate.id))request<{products:ManufacturerProduct[]}>('/catalog/details','POST',{id:line.candidate.id,projectId}).then(details=>{if(active)setProducts(details.products);}).catch(()=>{if(active)setError('Manufacturer choices unavailable. Existing line details are retained.');});return()=>{active=false;};},[line.candidate?.id,projectId]);
  return <fieldset className="purchasing-fields"><legend>Manufacturer and substitutions</legend>{products.length>0&&<label>Catalog manufacturer product<select aria-label="Catalog manufacturer product" value={value.productId??''} onChange={event=>{const product=products.find(p=>p.id===event.target.value);onChange(product?{...value,productId:product.id,manufacturer:product.manufacturer,partNumber:product.partNumber}:{...value,productId:null});}}><option value="">Enter manufacturer / part manually</option>{products.map(product=><option disabled={product.allowed===false} key={product.id} value={product.id}>{product.manufacturer} · {product.partNumber}{product.verification==='provisional'?' · provisional':''}{product.allowed===false?' · not allowed for this job':''}</option>)}</select></label>}
    <label>Manufacturer<input aria-label="Manufacturer" maxLength={200} value={value.manufacturer} readOnly={Boolean(value.productId)} onChange={event=>onChange({...value,manufacturer:event.target.value})}/></label>
    <label>Manufacturer part number<input aria-label="Manufacturer part number" maxLength={200} value={value.partNumber} readOnly={Boolean(value.productId)} onChange={event=>onChange({...value,partNumber:event.target.value})}/></label>
    <label className="catalog-review"><input type="checkbox" checked={value.noSubstitutions} onChange={event=>onChange({...value,noSubstitutions:event.target.checked})}/>No Substitutions</label><p className="muted">{value.noSubstitutions?'Purchasing must buy this exact manufacturer and part number. Both are required.':'Manufacturer and part number identify the requested example; substitutions remain subject to job restrictions.'}</p>{error&&<p role="alert">{error}</p>}
  </fieldset>;
}
