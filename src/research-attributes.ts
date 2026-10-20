import type {ResearchCandidate} from './catalog-research';
export function isProductDetail(category:string,name:string){return (['conduit','bracket','box'].includes(category)&&name==='specification')||['packQuantity','packWeightLbs','packageQuantity','packageWeightLbs','palletQuantity','palletWeightLbs','bundleQuantity','cartonQuantity','tradeSizeIn','standards','ratings','countryOfOrigin','countryOfManufacture','manufacturerCatalogSection','productSeries'].includes(name);}
/** Preserve observations, including ambiguous packaging units, without treating them as material-defining facts. */
export function separateResearchDetails<T extends ResearchCandidate>(item:T):T{
 const attributes={...item.attributes},productDetails={...item.productDetails};
 for(const [name,value] of Object.entries(attributes))if(isProductDetail(item.category,name)){productDetails[name]=value;delete attributes[name];}
 return {...item,attributes,...(Object.keys(productDetails).length?{productDetails}:{})};
}
