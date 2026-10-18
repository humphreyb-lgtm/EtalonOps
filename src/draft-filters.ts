export type DraftFilters={text?:string;deliveryFrom?:string;deliveryTo?:string};
export function draftFilterError(filters:DraftFilters):string|null{
 if((filters.text?.trim().length??0)>120)return 'Search draft names using at most 120 characters.';
 for(const value of [filters.deliveryFrom,filters.deliveryTo])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))return 'Choose a valid delivery date.';
 if(filters.deliveryFrom&&filters.deliveryTo&&filters.deliveryFrom>filters.deliveryTo)return 'Delivery from must be on or before delivery through.';
 return null;
}
