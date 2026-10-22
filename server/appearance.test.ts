import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appearanceSchema} from './appearance';
import {appearanceCSS,emptyAppearance} from '../src/appearance';
import {designCSS,defaultDesign} from '../src/global-design';
test('appearance uses bounded code-owned components and safe per-field identities',()=>{
 assert.ok(appearanceSchema.safeParse({rules:{fields:{desktop:{paddingTop:0,height:22,color:'#abcdef'}}},order:['entry','items']}).success);
 for(const rules of [{unknown:{desktop:{color:'#ffffff'}}},{fields:{desktop:{color:'red;display:none'}}},{fields:{desktop:{paddingTop:99999}}},{fields:{desktop:{backgroundImage:'url(evil)'}}},{'field:x\"] body':{desktop:{color:'#ffffff'}}}])assert.equal(appearanceSchema.safeParse({rules,order:[]}).success,false);
 assert.equal(appearanceSchema.safeParse({rules:{},order:['entry','entry']}).success,false);
 assert.ok(appearanceSchema.safeParse({rules:{workspace:{desktop:{width:'100%',maxWidth:'80rem'}}},order:[]}).success);assert.equal(appearanceSchema.safeParse({rules:{workspace:{desktop:{width:'expression(evil)'}}},order:[]}).success,false);
 assert.ok(appearanceSchema.safeParse({rules:{'control:workforce-fields:job-name':{desktop:{fontSize:16}},'container:workforce-fields:job-name':{desktop:{width:'50%'}}},order:[]}).success);
 assert.ok(appearanceSchema.safeParse({rules:{'field:quantity':{mobile:{width:120}}},order:[]}).success);
});
test('responsive CSS inherits base styles, separates PDF/editor and makes field padding effective',()=>{
 const css=appearanceCSS({rules:{fields:{desktop:{paddingTop:0,paddingBottom:0},mobile:{fontSize:12}},'field:quantity':{desktop:{width:80}}},order:['items','entry']});
 assert.match(css,/height:auto!important;min-height:0!important/);assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/\[id="quantity"\]/);assert.match(css,/:not\(\.appearance-studio \*\)/);assert.ok(!css.includes('.workspace{display:flex'));assert.equal(appearanceCSS(emptyAppearance()).includes('!important'),false);
 const d=structuredClone(defaultDesign);d.field.paddingY=0;d.button.paddingY=20;const global=designCSS(d);assert.match(global,/height:22px!important/);assert.match(global,/min-height:62px!important/);
});
