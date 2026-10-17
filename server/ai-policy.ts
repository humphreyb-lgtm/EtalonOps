import { ApiError, type Principal } from './contracts';
export const aiLimits = { monthlySessions:200,monthlyRequests:400,sessionRequests:2,userDailyRequests:20,maxRequestBytes:12000,maxOutputTokens:600,timeoutMs:15000 } as const;
export type AIReservation={actor:string;target:string;at:string};
export function aiPeriod(date=new Date()){return date.toISOString().slice(0,7);}
export function checkAIReservation(rows:AIReservation[],p:Principal,session:string,turn:string,date=new Date()) {
  const prefix=`${aiPeriod(date)}/`,target=`${prefix}${session}/${turn}`;
  if(rows.some(row=>row.target===target))throw new ApiError(409,'This AI request was already reserved. It will not be charged or sent again automatically.');
  const month=rows.filter(row=>row.target.startsWith(prefix)),sessionRows=month.filter(row=>row.target.startsWith(`${prefix}${session}/`));
  if(sessionRows.some(row=>row.actor!==p.oid))throw new ApiError(404,'Lookup session not found.');
  if(month.length>=aiLimits.monthlyRequests)throw new ApiError(429,'The monthly AI request limit has been reached. Use My Description.');
  if(sessionRows.length>=aiLimits.sessionRequests)throw new ApiError(429,'This lookup reached its two AI turns. Use My Description to keep your details.');
  const sessions=new Set(month.map(row=>row.target.split('/')[1]));
  if(!sessions.has(session)&&sessions.size>=aiLimits.monthlySessions)throw new ApiError(429,'The monthly AI discovery-session limit has been reached.');
  const day=date.toISOString().slice(0,10);
  if(month.filter(row=>row.actor===p.oid&&row.at.startsWith(day)).length>=aiLimits.userDailyRequests)throw new ApiError(429,'Your daily AI request limit has been reached. Use My Description.');
  return target;
}
export function aiUsage(rows:AIReservation[],date=new Date()){return {period:aiPeriod(date),sessions:new Set(rows.map(row=>row.target.split('/')[1])).size,requests:rows.length,limits:aiLimits};}
