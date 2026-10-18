import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInches } from '../src/measurements';
test('explicit inch fractions and decimals agree without inferring units or part numbers',()=>{
 for(const input of ['15.75','15 3/4','15¾','15 3 / 4"','15 3/4″'])assert.equal(parseInches(input),15.75);
 assert.equal(parseInches('½'),0.5);assert.equal(parseInches('1/8'),0.125);assert.equal(parseInches('.375'),0.375);assert.equal(parseInches('25'),25);
 for(const input of ['', '0','-1','1/0','15 4/3','1 ft','16 to 24','TSGB1624','1e3','Infinity','NaN','<script>'])assert.throws(()=>parseInches(input),/inch measurement/);
});
