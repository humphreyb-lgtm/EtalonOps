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
export function score(query: string, phrase: string): number {
  const q = normalize(query), p = normalize(phrase);
  if (!q || !p) return 0;
  if (q === p) return 100;
  // Numeric sizes/threads are constraints, never fuzzy product identifiers.
  const numbers = q.match(/\b\d+(?:[./-]\d+)?\b/g) ?? [];
  const productNumbers: string[] = p.match(/\b\d+(?:[./-]\d+)?\b/g) ?? [];
  if (numbers.some(n => !productNumbers.includes(n))) return 0;
  const tokens = q.split(' '), words = p.split(' ');
  const hits = tokens.filter(token => words.some(word => token === word || (token.length >= 5 && word.length >= 5 && oneEditApart(token, word)))).length;
  return hits === tokens.length ? 85 : 0;
}
