import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlSid,principalRepair } from './sql-principal';
const objectId='00112233-4455-6677-8899-aabbccddeeff',clientId='10213243-5465-7687-98a9-bacbdcedfe0f';
test('SQL SID uses client GUID byte order and preserves the distinct RBAC object ID',()=>{
 assert.equal(sqlSid(objectId),'0x33221100554477668899aabbccddeeff');
 assert.equal(sqlSid(clientId),'0x433221106554877698a9bacbdcedfe0f');
 assert.notEqual(sqlSid(objectId),sqlSid(clientId));
 assert.throws(()=>sqlSid("invalid';DROP USER x"));
});
test('runtime principal repair is idempotent and only repairs the exact legacy mapping',()=>{
 assert.deepEqual(principalRepair(undefined,objectId,clientId,false),{sid:sqlSid(clientId),create:true,renameLegacy:false});
 assert.equal(principalRepair({type:'E',sid:sqlSid(objectId)},objectId,clientId,false).renameLegacy,true);
 assert.equal(principalRepair({type:'E',sid:sqlSid(clientId)},objectId,clientId,true).create,false);
 assert.throws(()=>principalRepair({type:'S',sid:sqlSid(objectId)},objectId,clientId,false),/external/);
 assert.throws(()=>principalRepair({type:'E',sid:sqlSid('99999999-9999-4999-8999-999999999999')},objectId,clientId,false),/neither/);
 assert.throws(()=>principalRepair({type:'E',sid:sqlSid(objectId)},objectId,clientId,true),/alias/);
});
