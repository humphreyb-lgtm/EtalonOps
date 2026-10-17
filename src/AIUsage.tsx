import { useEffect,useState } from 'react';
import { request,type AIStatus } from './api';
type Usage=AIStatus&{period:string;sessions:number;requests:number};
export function AIUsage(){
  const [usage,setUsage]=useState<Usage|null>(null),[error,setError]=useState('');
  async function refresh(){try{setUsage(await request<Usage>('/admin/ai/usage'));setError('');}catch{setError('AI usage is unavailable.');}}
  useEffect(()=>{void refresh();},[]);
  return <section aria-label="AI usage limits" className="image-admin"><h3>AI usage limits</h3>{error&&<p role="alert">{error}</p>}{usage&&<><p>Live AI: <strong>{usage.enabled?'Enabled':'Disabled'}</strong>. External product search is not enabled.</p><p>{usage.period} (UTC): {usage.sessions} / {usage.limits.monthlySessions} sessions; {usage.requests} / {usage.limits.monthlyRequests} reserved requests.</p><p className="muted">Each lookup permits {usage.limits.sessionRequests} AI turns. Each user permits {usage.limits.userDailyRequests} requests per UTC day. Failed or interrupted calls keep their reservation; no automatic paid retry. These controls and Azure budget alerts do not guarantee a fixed bill.</p></>}<button className="button" onClick={()=>void refresh()}>Refresh AI usage</button></section>;
}
