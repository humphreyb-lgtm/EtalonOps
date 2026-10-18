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
