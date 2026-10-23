import {test} from 'node:test';import assert from 'node:assert/strict';
import {materialFacets,facetOptions,facetMatches,couplingPhrases,channelGroup} from '../src/search-facets';
import {Store} from './store';import{readFileSync}from'node:fs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/strut-search-coverage.json',import.meta.url),'utf8'));
test('channel groups preserve dimensions and use documented depth rather than plate or opening dimensions',()=>{
 for(const [n,group]of [[0.9375,0.875],[1.5625,1.625],[3.25,3.25],[2.4375,2.4375]])assert.equal(channelGroup(n),group);
 const deep=fixture.records.find((r:any)=>r.ref.endsWith('002.xlsx:83')).material.attributes;
 const shallow=fixture.records.find((r:any)=>r.ref.endsWith('002.xlsx:85')).material.attributes;
 assert.deepEqual(materialFacets(deep).channelSize,['1 5/8 in.']);assert.deepEqual(materialFacets(shallow).channelSize,['7/8 in.']);
 assert.equal(deep.openingIn,'1.5625');assert.equal(shallow.openingIn,'0.9375');
 assert.equal(materialFacets({type:'strut post base',widthIn:6,depthIn:6,compatibleChannelDepthIn:1.625}).channelSize?.[0],'1 5/8 in.');
 assert.equal(materialFacets({type:'strut flat straight splice plate',widthIn:1.625}).channelSize?.[0],'Not specified');
});
test('browsing filters do not merge PVC sizes/schedules or invent channel fit for unknown accessories',()=>{
 const rows=[40,80].flatMap(schedule=>[0.5,0.75,1].map(diameterIn=>({searchFacets:materialFacets({type:'coupling',material:'PVC',schedule,diameterIn})})));
 assert.equal(rows.filter(r=>facetMatches(r.searchFacets,{size:'1 in.',schedule:'40'})).length,1);
 assert.deepEqual(facetOptions(rows,{schedule:'40'},'size'),['1/2 in.','3/4 in.','1 in.']);
});
test('family browsing covers all 297 strut records; coupling lookup narrows by type and standard channel group',()=>{
 const s=new Store(':memory:'),p={tenant:'facet-test',oid:'owner',roles:['Admin']};try{
 for(const r of fixture.records)s.catalogCommand(p,'material',r.material);
 const all=s.search(p,'Unistrut');assert.equal(all.length,297);assert.ok(all.every(r=>r.searchFacets?.family?.includes('Unistrut')));
 assert.equal(s.search(p,'Unistrut channel').length,54);
 const coupling=s.search(p,'Unistrut coupling');assert.equal(coupling.length,8);assert.ok(coupling.every(r=>/splice/.test(r.description)));
 assert.equal(coupling.filter(r=>facetMatches(r.searchFacets,{channelSize:'7/8 in.'})).length,2);
 assert.equal(s.search(p,'7/8 Unistrut coupling').length,2);assert.equal(s.search(p,'1-5/8 Unistrut coupling').length,2);
 assert.equal(s.search(p,'PVC coupling').length,0);assert.equal(s.search(p,'Unistrut brand only coupling').length,0);
 assert.ok(couplingPhrases(fixture.records.find((r:any)=>r.ref.endsWith('002.xlsx:83')).material.attributes).includes('1-5/8 unistrut coupling'));
 }finally{s.db.close();}
});
