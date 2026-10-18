import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInches,formatInches,formatInchText } from '../src/measurements';
test('explicit inch fractions and decimals agree without inferring units or part numbers',()=>{
 for(const input of ['15.75','15 3/4','15¾','15 3 / 4"','15 3/4″'])assert.equal(parseInches(input),15.75);
 assert.equal(parseInches('½'),0.5);assert.equal(parseInches('1/8'),0.125);assert.equal(parseInches('.375'),0.375);assert.equal(parseInches('25'),25);
 for(const input of ['', '0','-1','1/0','15 4/3','1 ft','16 to 24','TSGB1624','1e3','Infinity','NaN','<script>'])assert.throws(()=>parseInches(input),/inch measurement/);
});

test('inch displays use exact fractions without rounding specifications or changing part numbers',()=>{assert.equal(formatInches(.5),'1/2');assert.equal(formatInches(.75),'3/4');assert.equal(formatInches(1.25),'1 1/4');assert.equal(formatInches(15.75),'15 3/4');assert.equal(formatInches(1.315),'1.315');assert.equal(formatInchText('0.5 in. PVC conduit, Schedule 40, 120 in. Length'),'1/2 in PVC conduit, Schedule 40, 120 in. Length');assert.equal(formatInchText('Bracket 15.75–25 in. span, TSGB1624'),'Bracket 15 3/4–25 in span, TSGB1624');assert.equal(formatInchText('1.25 × 2.5 × 3.75 in., part 123.5'),'1 1/4 × 2 1/2 × 3 3/4 in, part 123.5');});
