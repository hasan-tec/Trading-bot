import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {createForward} from './forward.mjs';
const config={symbol:'BTCUSDT',interval:'1h',kind:'ema',fast:9,slow:21,initialBalance:1000,fee:.001,slippage:.0005,allocation:.2};
async function fixture(label,change,check){
 const dir=await mkdtemp(path.join(process.cwd(),'test-state-config-'));
 const forward=createForward(),saved={config:{...config},paper:{cash:800,quantity:.002,entryCost:200,feesPaid:.2,equity:1000,trades:[{side:'buy',time:123,quantity:.002}],paused:false}};
 forward.wallets[0].cash=800;forward.wallets[0].quantity=.002;forward.wallets[0].trades=[{side:'buy',time:123,quantity:.002}];
 change(saved,forward);
 const paperFile=path.join(dir,'paper.json'),forwardFile=path.join(dir,'forward.json');
 const contents=[JSON.stringify(saved),JSON.stringify(forward)];
 await writeFile(paperFile,contents[0]);await writeFile(forwardFile,contents[1]);
 const oldMode=process.env.PAPER_TEST_MODE,oldDir=process.env.STATE_DIR;
 process.env.PAPER_TEST_MODE='1';process.env.STATE_DIR=dir;
 try{
  await check(()=>import('./server.mjs?configuration-regression='+label));
  assert.equal(await readFile(paperFile,'utf8'),contents[0],'startup must not reset existing paper holdings');
  assert.equal(await readFile(forwardFile,'utf8'),contents[1],'startup must not reset existing forward holdings');
 }finally{
  if(oldMode===undefined)delete process.env.PAPER_TEST_MODE;else process.env.PAPER_TEST_MODE=oldMode;
  if(oldDir===undefined)delete process.env.STATE_DIR;else process.env.STATE_DIR=oldDir;
  assert.ok(dir.startsWith(path.join(process.cwd(),'test-state-config-')));await rm(dir,{recursive:true,force:true});
 }
}
test('startup restores both wallets with reordered JSONB configuration keys without resetting trades',async()=>{
 await fixture('reordered',(saved,forward)=>{
  saved.config=Object.fromEntries(Object.entries(saved.config).reverse());
  forward.config=Object.fromEntries(Object.entries(forward.config).reverse());
  assert.notEqual(JSON.stringify(saved.config),JSON.stringify(config));
 },async load=>{
  const {handler}=await load(),req=Readable.from([]);req.url='/api/forward';req.method='GET';req.headers={host:'127.0.0.1:18788'};
  const res={setHeader(){},writeHead(){},end(body){this.body=body;}};await handler(req,res);
  const state=JSON.parse(res.body);assert.equal(state.wallets[0].cash,800);assert.equal(state.wallets[0].quantity,.002);assert.equal(state.wallets[0].tradeCount,1);
 });
});
test('startup still rejects a real fee change without resetting saved holdings',async()=>{
 await fixture('legacy-changed',saved=>{saved.config.fee=.002;},load=>assert.rejects(load,/Saved paper configuration differs/));
});
test('startup still rejects a real forward allocation change without resetting holdings',async()=>{
 await fixture('forward-changed',(_,forward)=>{forward.config={...forward.config,allocation:.3};},load=>assert.rejects(load,/Forward experiment rules changed/));
});
