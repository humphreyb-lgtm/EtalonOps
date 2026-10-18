import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { catalogStreamValidator } from '../src/catalog-stream';
test('stream validation handles split UTF-8 and refuses wrong tenants, counts and trailing content',()=>{
 const manifest={type:'manifest',format:'etalonops-catalog-stream',version:1,tenant:'t',tables:['materials']};
 const row={type:'record',table:'materials',row:{tenant:'t',description:'15¾ in. support · synthetic'}};
 const prefix=JSON.stringify(manifest)+'\n'+JSON.stringify(row)+'\n';
 const footer={type:'complete',recordCount:1,tableCounts:{materials:1},sha256:createHash('sha256').update(prefix).digest('hex')};
 const content=prefix+JSON.stringify(footer)+'\n',bytes=new TextEncoder().encode(content),reader=catalogStreamValidator();
 for(const byte of bytes)reader.push(Uint8Array.of(byte));assert.equal(reader.finish(),1);
 for(const corrupted of [content.replace('"recordCount":1','"recordCount":2'),content.replace('"tenant":"t","description"','"tenant":"other","description"'),content+'{}\n']){
  assert.throws(()=>{const failed=catalogStreamValidator();failed.push(new TextEncoder().encode(corrupted));failed.finish();});
 }
});
