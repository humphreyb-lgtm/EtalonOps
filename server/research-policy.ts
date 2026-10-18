import {ApiError} from './contracts';
// USD retail rates: East US, Data Zone Standard, GPT-5.4 mini; checked 2026-10-18.
// Each bounded model/discovery call reserves a ceiling. Bing discovery: USD14 / 1K requests, checked 2026-10-18.
export const researchPolicy={model:'gpt-5.4-mini',version:'2026-03-17',monthlyMicroUsd:30_000_000,reservationMicroUsd:150_000,inputPerMillion:0.825,outputPerMillion:4.95,maxBodyBytes:120_000,maxOutputTokens:8000,maxItems:5,timeoutMs:60_000,pricingValidThrough:'2026-11-18'} as const;
export function researchCost(input:number,output:number){return Math.ceil(input*researchPolicy.inputPerMillion+output*researchPolicy.outputPerMillion);}
export function checkResearchPricing(date=new Date()){if(date.toISOString().slice(0,10)>researchPolicy.pricingValidThrough)throw new ApiError(503,'AI pricing needs rechecking before another paid request. Catalog search remains available.');}
