import {facetLabels,facetMatches,facetOptions,type SearchFacets} from './search-facets';
export function SearchFilters({rows,selected,onChange}:{rows:{searchFacets?:SearchFacets}[];selected:Record<string,string>;onChange:(value:Record<string,string>)=>void}){
 const keys=Object.keys(facetLabels).filter(key=>facetOptions(rows,{},key).length>0);if(!keys.length)return null;
 const count=rows.filter(r=>facetMatches(r.searchFacets,selected)).length;
 return <div className="search-filters" role="group" aria-label="Filter material matches">
 {keys.map(key=><label key={key}>{facetLabels[key]}<select aria-label={facetLabels[key]} value={selected[key]??''} onChange={e=>onChange({...selected,[key]:e.target.value})}><option value="">All</option>{facetOptions(rows,selected,key).map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}
 <button type="button" className="button secondary" disabled={!Object.values(selected).some(Boolean)} onClick={()=>onChange({})}>Clear filters</button><span role="status">{count} of {rows.length} matches</span>
 </div>;
}
