import { test } from 'node:test';
import { Store } from './store';
import { catalogScenarios } from './catalog-scenarios';
for(const scenario of catalogScenarios)test(`SQLite catalog: ${scenario.name}`,async()=>{const store=new Store(':memory:');try{await scenario.run(store);}finally{store.db.close();}});
