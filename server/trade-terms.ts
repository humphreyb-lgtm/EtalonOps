// Shared vocabulary for retrieval AND physical checks. Expand whole trade words,
// never fragments of manufacturer part numbers (e.g. FA-123).
export function tradeTerms(input:string){
 let q=input.replace(/(\d)([¼½¾⅛⅜⅝⅞])/g,'$1 $2').normalize('NFKC').replace(/[⁄∕]/g,'/');
 q=q.replace(/\b(\d+)[ -](\d+)\/(\d+)(?=\s*(?:°|deg(?:ree)?s?\b))/gi,(all,w,n,d)=>Number(d)?String(Number(w)+Number(n)/Number(d)):all);
 const fittingContext=/\bpvc\b|\bconduit\b|\bpipe\b|\d\s*(?:["″]|in(?:ch(?:es)?)?\b)/i.test(q);
 const words:[RegExp,string][]=[
  [/\badaptors?\b/gi,'adapter'],[/\badapters\b/gi,'adapter'],
  [/\bcplgs?\b|\bcouplings\b/gi,'coupling'],
  [/\bconns?\b|\bconnectors\b/gi,'connector'],
  [/\bjb(?:ox)?\b|\bj[ -]boxes\b|\bj[ -]box\b/gi,'junction box'],
  [/\bwashers\b/gi,'washer'],[/\bnuts\b/gi,'nut'],[/\bbolts\b/gi,'bolt'],
  [/\bbrackets\b/gi,'bracket'],[/\bbushings\b/gi,'bushing'],
  [/\bstraps\b/gi,'strap'],[/\bclamps\b/gi,'clamp'],
  [/\belbows\b|\bells\b/gi,'elbow'],[/\bsweeps\b/gi,'sweep'],
 ];
 for(const [pattern,value] of words)q=q.replace(pattern,value);
 if(fittingContext)q=q.replace(/(?<![\w/-])f\.?a\.?(?![\w/-])/gi,'female adapter').replace(/(?<![\w/-])m\.?a\.?(?![\w/-])/gi,'male adapter').replace(/\bell\b/gi,'elbow');
 return q;
}
