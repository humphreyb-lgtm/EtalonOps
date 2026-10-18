// The form labels these values in inches. Parse explicit notation only;
// never infer a dimension from a model/part number or another unit.
export function parseInches(input:string):number {
 const fractions:Record<string,string>={'¼':'1/4','½':'1/2','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
 const value=input.trim().replace(/[¼½¾⅛⅜⅝⅞]/g,c=>' '+fractions[c]).replace(/\s+/g,' ').trim().replace(/\s*["″]$/,'').trim();
 if(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)){
  const number=Number(value);if(Number.isFinite(number)&&number>0)return number;
 }
 const fraction=/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(value);
 if(fraction){
  const whole=Number(fraction[1]??0),numerator=Number(fraction[2]),denominator=Number(fraction[3]);
  if(Number.isSafeInteger(whole)&&Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)&&denominator>0&&numerator>0&&(!fraction[1]||numerator<denominator)){
   const number=whole+numerator/denominator;if(Number.isFinite(number)&&number>0)return number;
  }
 }
 throw new Error('Enter a positive inch measurement, such as 15.75 or 15 3/4. Other units are not converted.');
}

/** Exact common trade fractions only: never round technical dimensions. */
export function formatInches(value:number|string):string {
 const number=Number(value);if(!Number.isFinite(number)||number<0)return String(value);
 const whole=Math.floor(number),numerator=Math.round((number-whole)*64);
 if(Math.abs(number-(whole+numerator/64))>1e-8)return String(value);
 if(numerator===0)return String(whole);if(numerator===64)return String(whole+1);
 const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;const divisor=gcd(numerator,64);
 return `${whole?whole+' ':''}${numerator/divisor}/${64/divisor}`;
}
export function formatInchText(text:string):string {
 return text.replace(/\b(\d+(?:\.\d+)?(?:\s*[×–-]\s*\d+(?:\.\d+)?){0,2})\s*(?:inches|inch|in\.?)(?=\s|$|[,.;)])/gi,(original,values:string)=>{const formatted=values.replace(/\d+(?:\.\d+)?/g,value=>formatInches(value));return formatted===values?original:formatted+' in';});
}

export function formatSpecification(text:string):string {return text.replace(/\b(diameterIn|lengthIn|minSpanIn|maxSpanIn|widthIn|heightIn|depthIn):\s*(\d+(?:\.\d+)?)/g,(_all,key:string,value:string)=>`${({diameterIn:'Diameter',lengthIn:'Length',minSpanIn:'Minimum span',maxSpanIn:'Maximum span',widthIn:'Width',heightIn:'Height',depthIn:'Depth'} as Record<string,string>)[key]}: ${formatInches(value)} in`);}
