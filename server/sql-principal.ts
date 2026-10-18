// SQL external users for service principals/managed identities use the CLIENT ID
// as their SID, not the service principal object ID used by Azure RBAC.
// https://learn.microsoft.com/sql/t-sql/statements/create-user-transact-sql
const guid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function sqlSid(clientId:string){
  if(!guid.test(clientId))throw new Error('Invalid managed identity client ID.');
  const hex=clientId.replaceAll('-','').toLowerCase();
  return '0x'+hex.slice(6,8)+hex.slice(4,6)+hex.slice(2,4)+hex.slice(0,2)+hex.slice(10,12)+hex.slice(8,10)+hex.slice(14,16)+hex.slice(12,14)+hex.slice(16);
}
export function principalRepair(existing:{type:string;sid:string}|undefined,objectId:string,clientId:string,legacyExists:boolean){
  const desired=sqlSid(clientId),legacy=sqlSid(objectId);
  if(!existing)return {sid:desired,create:true,replaceLegacy:false};
  if(existing.type!=='E')throw new Error('Existing runtime user is not an external principal; stopped.');
  if(existing.sid.toLowerCase()===desired)return {sid:desired,create:false,replaceLegacy:false};
  if(existing.sid.toLowerCase()!==legacy)throw new Error('Existing runtime SID matches neither the actual client ID nor the known legacy object ID; stopped.');
  if(legacyExists)throw new Error('Legacy identity alias already exists; stopped without overwriting it.');
  return {sid:desired,create:true,replaceLegacy:true};
}
