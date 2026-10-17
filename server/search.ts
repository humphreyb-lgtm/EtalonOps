export function normalize(input: string): string {
  return input.toLowerCase().normalize('NFKC').replace(/["″]/g, ' inch ')
    .replace(/\b(\d+(?:\/\d+)?)\s*pvc\b/g, '$1 inch pvc')
    .replace(/\b(inches|in\.?)(?=\s|$)/g, 'inch').replace(/\b(pvc pipe|pvc conduit)\b/g, 'pvc')
    .replace(/\belec(?:trical)?\b/g, 'electrical').replace(/\bfeet\b/g, 'ft')
    .replace(/[^\p{L}\p{N}./-]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length <= b.length) j++;
    if (b.length <= a.length) i++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function terms(value: string) {
  return normalize(value.normalize('NFKC').replace(/[⁄∕]/g,'/')).replace(/\bsch\.?\s*(\d+)\b/g,'schedule $1')
    .replace(/\bemt\b/g,'electrical metallic tubing').replace(/\bgalv\b/g,'galvanized')
    .replace(/\bblk\b/g,'black').replace(/\bwht\b/g,'white')
    .replace(/\bself[ -]?tappers?\b/g,'self tapping screws');
}
export function score(query: string, phrase: string): number {
  const cleanQuery=query.replace(/^(?:i need|i am looking for|looking for|please get me)\s+(?:(?:some|a|an)\s+)?/i,'').replace(/\s+please[.!]?$/i,'');
  const q=terms(cleanQuery),p=terms(phrase);
  if(!q||!p)return 0;
  // A reviewed #8 alias is not interchangeable with an 8-inch dimension.
  const tagged=cleanQuery.match(/#\d+(?![\d-])/g)??[];
  if(tagged.some(tag=>!new RegExp(`${tag}(?![\\d-])`,'i').test(phrase)))return 0;
  const numbers=q.match(/\d+(?:[./-]\d+)*/g)??[];
  const productNumbers: string[]=p.match(/\d+(?:[./-]\d+)*/g)??[];
  if(numbers.some(number=>!productNumbers.includes(number)))return 0;
  if(normalize(cleanQuery)===normalize(phrase))return 100;
  if(q===p)return 90;
  const tokens=q.split(' '),words=p.split(' ');
  const hits=tokens.filter(token=>words.some(word=>token===word||(/^[a-z]{5,}$/.test(token)&&/^[a-z]{5,}$/.test(word)&&oneEditApart(token,word)))).length;
  return hits===tokens.length?85:0;
}
