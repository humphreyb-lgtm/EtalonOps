import {test} from 'node:test';
import {Store} from '../../server/store';
import {publicationScenario} from './scenarios';
const p={tenant:'publication-test',oid:'admin',roles:['Admin']};
test('headless publication validates, preserves keys, resumes idempotently and stops on conflicts',async()=>{const s=new Store(':memory:');try{await publicationScenario(s,p);}finally{s.db.close();}});
