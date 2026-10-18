import {ApiError} from './contracts';
export type ResearchDiagnostic={code:string;stage:string;azureStatus?:number;azureCode?:string;azureRequestId?:string;issuePaths?:string[]};
export class ResearchFailure extends ApiError{
 constructor(public diagnostic:ResearchDiagnostic,detail:string){super(502,`AI research [${diagnostic.code}]: ${detail} No automatic paid retry. Your input is retained; the request reservation remains.`);}
}
export function safeResearchMessage(value:unknown,key?:string){let text=typeof value==='string'?value:'No additional Azure error description.';if(key)text=text.split(key).join('[redacted]');return text.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi,'Bearer [redacted]').replace(/api[-_ ]?key["']?\s*[:=]\s*["']?[^\s,"'}]+/gi,'api-key=[redacted]').replace(/[\r\n]+/g,' ').slice(0,600);}
