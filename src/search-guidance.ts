// Shared advice for incomplete requests; it never changes a material's identity.
export function searchGuidance(query:string):string|undefined {
 if(/\bbrand\s+only\b/i.test(query))return 'Choose a documented manufacturer product. Generic materials cannot satisfy a brand-only request.';
 if(/\b(?:P\d{3,}[\w-]*|B\d{3,}[\w-]*)\b/i.test(query))return 'Verify the requested manufacturer and part number. A supplier reference alone does not establish an exact product match.';
 if(/\bgalvanized\s+strut\b/i.test(query)&&!/(?:pre|hot|electro|dip)/i.test(query))return 'Choose the galvanized finish: pre-galvanized, hot-dip galvanized, or electro-galvanized.';
 if(/\bhard\b.*\bcap\b/i.test(query))return 'Cap hardness must be verified. Do not assume that 7/8 in. and 13/16 in. fit the same channel.';
 if(/\bchannel nut\b/i.test(query)&&!/(?:\d+\/\d+|\d+\.\d+)-\d+|\bthread\b/i.test(query)&&/\d/.test(query))return 'Choose the nut thread size and spring or retainer type. Channel width does not specify the thread.';
 return undefined;
}
