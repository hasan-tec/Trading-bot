import test from 'node:test';
import assert from 'node:assert/strict';
import {newDb} from 'pg-mem';
import {PostgresStore,stateKey} from './storage.mjs';
test('Postgres state schema, parameterized upsert and reload preserve independent wallets',async()=>{
 const db=newDb(),{Pool}=db.adapters.createPg(),pool=new Pool();
 const store=await new PostgresStore(pool).init();
 assert.equal(await store.read('forward.json',null),null);
 await store.write('forward.json',{wallets:[{id:'slow4h',cash:800},{id:'hold',cash:900}]});
 const restored=new PostgresStore(pool);
 assert.equal((await restored.read('forward.json')).wallets[0].cash,800);
 await restored.write('forward.json',{paused:true});assert.deepEqual(await store.read('forward.json'),{paused:true});
 await store.write("key';DROP TABLE paper_lab_state;--",{safe:true});assert.deepEqual(await store.read("key';DROP TABLE paper_lab_state;--"),{safe:true});
 await store.close();
});
test('duplicate database writer is rejected and key naming is constrained',async()=>{
 let released=false;
 const store=new PostgresStore({connect:async()=>({query:async()=>({rows:[{acquired:false}]}),release:()=>{released=true;}})});
 await assert.rejects(()=>store.acquireWriter(),/Another Paper Lab/);assert.equal(released,true);
 assert.equal(stateKey('state/forward.json'),'forward.json');assert.throws(()=>stateKey('state/secrets.txt'));
});
