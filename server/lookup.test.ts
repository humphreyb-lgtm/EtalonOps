import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupContext, fallbackDescription, type LookupTurn } from '../src/lookup';

test('clarification uses original input and asks only for missing fastener details', () => {
  const start = lookupContext('black 6-32 device screws, 1 inch long', []);
  assert.equal(start.question, null);
  assert.deepEqual(start.facts, { thread: '6-32', length: '1 inch', finish: 'black' });
  const partial = lookupContext('black 6-32 device screws', []);
  assert.equal(partial.question, 'What length do you need?');
  const next = lookupContext('black 6-32 device screws', [{ author: 'assistant', text: partial.reply }, { author: 'user', text: 'One inch, please.' }]);
  assert.equal(next.question, null);
  assert.equal(next.facts.length, '1 inch');
});
test('uncertainty advances without inventing facts and corrections preserve user wording', () => {
  const turns: LookupTurn[] = [];
  for (let i = 0; i < 3; i++) {
    const next = lookupContext('self tappers', turns);
    turns.push({ author: 'assistant', text: next.reply }, { author: 'user', text: 'not sure' });
  }
  const done = lookupContext('self tappers', turns);
  assert.equal(done.question, null);
  assert.deepEqual(done.facts, {});
  assert.match(done.reply, /stay unspecified/);
  const later = lookupContext('self tappers', [...turns, { author: 'user', text: 'black 6-32, 1 inch long' }]);
  assert.equal(later.question, null);
  assert.doesNotMatch(later.reply, /Unspecified details/);
  const corrected = lookupContext('black 6-32 screws', [{ author: 'user', text: 'Not black, zinc plated instead; 2 inch long.' }]);
  assert.equal(corrected.facts.finish, 'zinc plated');
  assert.equal(corrected.facts.length, '2 inch');
  assert.match(fallbackDescription('self tappers', turns), /Clarification: not sure/);
});
test('option labels do not invent dimensions and lookup contexts are independent', () => {
  const first = lookupContext('self tappers', [], 'hex');
  assert.equal(first.facts.thread, undefined);
  assert.equal(first.facts.length, undefined);
  assert.equal(first.question, 'What thread or diameter do you need?');
  const other = lookupContext('paint', []);
  assert.equal(other.facts.finish, undefined);
  assert.equal(other.question, 'What size or application should we use to narrow this down?');
});

test('different diameter/length values and negative corrections are not conflated', () => {
  const result = lookupContext('6-32 black screws', [{ author: 'user', text: 'Not 6-32, 8-32 instead. 1/4 inch diameter, 2 inch long. Not black, galvanized.' }]);
  assert.equal(result.facts.thread, '1/4 inch');
  assert.equal(result.facts.length, '2 inch');
  assert.equal(result.facts.finish, 'galvanized');
  assert.equal(lookupContext('red paint for interior walls', []).question, null);
});

test('an application answer is never relabeled as a numeric thread specification', () => {
  const start = lookupContext('self tappers', []);
  const next = lookupContext('self tappers', [{ author: 'assistant', text: start.reply }, { author: 'user', text: 'Black device screws' }]);
  assert.equal(next.facts.thread, undefined);
  assert.equal(next.facts.finish, 'Black');
  assert.equal(next.question, 'What length do you need?');
});
