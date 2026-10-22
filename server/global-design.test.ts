import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultDesign,designCSS} from '../src/global-design';
test('global design emits real CSS rules and keeps single-line field/button heights consistent',()=>{
 const css=designCSS(defaultDesign);assert.ok(!css.includes('\\n'));assert.match(css,/height:30px!important/);assert.match(css,/:not\(\.designer-paper \*\)/);assert.match(css,/.button.primary/);
 const preview=designCSS(defaultDesign,'.global-design-preview');assert.ok(preview.startsWith('.global-design-preview{'));
});
