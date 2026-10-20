/** Never show another manufacturer's image when a particular product is selected. */
export function selectImage<T extends {product_id?:unknown;id?:unknown;reviewed_at?:unknown}>(rows:T[],productId:string|null):T|undefined{
 const normalized=(value:unknown)=>value?String(value).toLowerCase():null;
 const ordered=[...rows].sort((a,b)=>String(b.reviewed_at??'').localeCompare(String(a.reviewed_at??''))||String(a.id??'').localeCompare(String(b.id??'')));
 return (productId?ordered.find(row=>normalized(row.product_id)===productId.toLowerCase()):undefined)??ordered.find(row=>!row.product_id)??(!productId?ordered[0]:undefined);
}
