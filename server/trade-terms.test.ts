import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tradeTerms} from './trade-terms';
import {score} from './search';
import {matchesPhysicalSearch} from './material-search-constraints';
test('shared contextual FA/MA vocabulary preserves gender and part identifiers',()=>{
 for(const [abbr,type] of [['fa','female adapter'],['ma','male adapter'],['F.A.','female adapter'],['M.A.','male adapter']]){
  assert.ok(tradeTerms('1" PVC sch 40 '+abbr).includes(type));
  assert.ok(score('1" PVC '+abbr,'1 in. PVC '+type)>=85);
  assert.equal(matchesPhysicalSearch('1" PVC '+abbr,{type}),true);
  assert.equal(matchesPhysicalSearch('1" PVC '+abbr,{type:type==='male adapter'?'female adapter':'male adapter'}),false);
 }
 assert.equal(tradeTerms('Fixture FA-123 MA/456'),'Fixture FA-123 MA/456');
 assert.equal(matchesPhysicalSearch('Fixture FA-123',{type:'conduit'}),true);
 assert.equal(tradeTerms('FA circuit'),'FA circuit');
});
test('whole-word trade abbreviations and plurals share retrieval vocabulary',()=>{
 for(const [q,p] of [['PVC cplg','PVC coupling'],['PVC female adaptor','PVC female adapter'],['PVC adapters','PVC adapter'],['galv washers','galvanized washer'],['PVC 90 ell','PVC 90 elbow'],['PVC bushings','PVC bushing'],['jbox','junction box']])assert.ok(score(q,p)>=85,q);
});
test('repair adapter genders and center-stop coupling variants use structured connections',()=>{
 assert.equal(matchesPhysicalSearch('1" PVC repair male adapter',{type:'repair adapter',connectionA:'reamed-conduit insert',connectionB:'male threaded'}),true);
 assert.equal(matchesPhysicalSearch('1" PVC female adapter',{type:'repair adapter',connectionB:'male threaded'}),false);
 assert.equal(matchesPhysicalSearch('1" PVC long repair coupling',{type:'long-line coupling',centerStop:'absent'}),true);
 assert.equal(matchesPhysicalSearch('1" PVC long coupling with stop',{type:'long-line coupling',centerStop:'present'}),true);
 assert.equal(matchesPhysicalSearch('1" PVC coupling with stop',{type:'long-line coupling',centerStop:'absent'}),false);
 assert.equal(matchesPhysicalSearch('5 inch PVC 11 1/4 degree sweep',{angleDeg:11.25}),true);
});
