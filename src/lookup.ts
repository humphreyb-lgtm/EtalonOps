/** Deterministic context preparation; never claims to be AI or discovers products. */
export type LookupTurn = { author: 'user' | 'assistant'; text: string };
type Field = 'thread' | 'length' | 'finish' | 'application';
const questions: Record<Field, string> = {
  thread: 'What thread or diameter do you need?',
  length: 'What length do you need?',
  finish: 'What material or finish do you need?',
  application: 'What size or application should we use to narrow this down?',
};
const uncertain = /\b(don'?t know|do not know|not sure|unsure|unknown|no preference|any finish)\b/i;
const inchWords = (text: string) => text.replace(/\b(one|two|three|four|half)(?=[ -]+inch)/gi, value => ({ one: '1', two: '2', three: '3', four: '4', half: '1/2' }[value.toLowerCase()]!));
export function lookupContext(description: string, turns: LookupTurn[], choice = '') {
  const facts: Partial<Record<Field, string>> = {};
  const unspecified = new Set<Field>();
  const supplied = [description, ...turns.filter(t => t.author === 'user').map(t => t.text)];
  const fastener = /screw|fastener|self[ -]?tapp|6[ -]32|device mounting/i.test(supplied.join(' ')) || ['hex', 'tek', 'pan'].includes(choice);
  function ingest(text: string, answering?: Field) {
    const value = inchWords(text);
    // Numeric facts must be provided by the user; option labels are not facts.
    const negated = (at: number) => /(?:not|no|instead of|rather than)\s*$/i.test(value.slice(Math.max(0, at - 18), at));
    for (const match of value.matchAll(/\b\d{1,2}-\d{1,2}\b|\bM\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)?|#\d{1,2}\b/gi)) {
      if (!negated(match.index!)) facts.thread = match[0];
      else if (facts.thread?.toLowerCase() === match[0].toLowerCase()) delete facts.thread;
    }
    const sizePattern = String.raw`\b\d+(?:[./]\d+)?(?:\s+\d+\/\d+)?[ -]*(?:inches|inch|in\b|mm\b|cm\b)|\b\d+(?:[./]\d+)?\s*["″]`;
    const sizes = [...value.matchAll(new RegExp(sizePattern, 'gi'))];
    for (const match of sizes) {
      const after = value.slice(match.index! + match[0].length), before = value.slice(0, match.index);
      if (/^\s*(?:long|length)\b/i.test(after) || /\blength(?: of)?[: ]*$/i.test(before)) facts.length = match[0];
      if (/^\s*(?:diameter|dia)\b/i.test(after) || /\b(?:diameter|dia)[: ]*$/i.test(before)) facts.thread = match[0];
    }
    if (answering === 'length' && sizes.length === 1 && !/\bdiameter\b/i.test(value)) facts.length = sizes[0][0];
    if (!fastener && (sizes.length || /\b(for |interior|exterior|outdoor|indoor)\b/i.test(value))) facts.application = text.trim();
    const finishes = [...value.matchAll(/\b(?:black|zinc(?:[ -]plated)?|galvanized|stainless(?: steel)?|brass|plain|uncoated)\b/gi)];
    for (const match of finishes) {
      const prefix = value.slice(Math.max(0, match.index! - 18), match.index);
      if (!/(?:not|no|instead of|rather than)\s*$/i.test(prefix)) facts.finish = match[0];
      else if (facts.finish?.toLowerCase() === match[0].toLowerCase()) delete facts.finish;
    }
    for (const field of Object.keys(facts) as Field[]) if (facts[field]) unspecified.delete(field);
    if (answering && uncertain.test(value)) { unspecified.add(answering); delete facts[answering]; }
    else if (answering === 'application' && value.trim()) facts.application = text.trim();
    else if (answering && !facts[answering] && !uncertain.test(value)) {
      // Unparsed wording is preserved in the transcript/fallback, not mislabeled as a dimension.
      unspecified.add(answering);
    }
  }
  ingest(description);
  let answering: Field | undefined;
  for (const turn of turns) {
    if (turn.author === 'assistant') answering = (Object.keys(questions) as Field[]).find(field => turn.text.includes(questions[field]));
    else { ingest(turn.text, answering); answering = undefined; }
  }
  const fields: Field[] = fastener ? ['thread', 'length', 'finish'] : ['application'];
  const next = fields.find(field => !facts[field] && !unspecified.has(field));
  const question = next ? questions[next] : null;
  const summary = [facts.thread && `Thread/diameter: ${facts.thread}`, facts.length && `Length: ${facts.length}`, facts.finish && `Material/finish: ${facts.finish}`, facts.application && `Application: ${facts.application}`].filter(Boolean).join('; ');
  const reply = question
    ? `${summary ? `Retained: ${summary}. ` : ''}${question} You can say “not sure” to leave it unspecified.`
    : `Your details are retained${summary ? `: ${summary}` : ''}. ${unspecified.size ? 'Unspecified details will stay unspecified. ' : ''}Live product discovery is not connected. Use My Description to keep your request without inventing a product match.`;
  return { facts, question, reply };
}
export function fallbackDescription(description: string, turns: LookupTurn[]) {
  const details = turns.filter(t => t.author === 'user').map(t => t.text.trim()).filter(Boolean);
  return details.length ? `${description.trim()}\nClarification: ${details.join(' · ')}` : description.trim();
}
