import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
test('request handler: dashboard, origin enforcement, labeled import, persistent pause',async()=>{
 const dir=await mkdtemp(path.join(process.cwd(),'test-state-'));
 process.env.PAPER_TEST_MODE='1';process.env.STATE_DIR=dir;
 const {handler}=await import('./server.mjs');
 async function request(url,body,origin='http://127.0.0.1:18787'){
   const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);req.url=url;req.method=body===undefined?'GET':'POST';req.headers={host:'127.0.0.1:18787',origin,'content-type':'application/json'};
   const res={status:200,headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(n){this.status=n;},end(value){this.body=String(value);}};
   await handler(req,res);return res;
 }
 try{
 const html=(await request('/')).body;assert.match(html,/Binance Paper Lab/);assert.match(html,/PAPER ONLY/);new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 const researchHtml=(await request('/research')).body;new Function(researchHtml.match(/<script>([\s\S]*?)<\/script>/)[1]);
 let f=JSON.parse((await request('/api/forward')).body);assert.equal(f.wallets.length,3);assert.equal(f.startedAt,null);
 assert.equal((await request('/api/forward/pause',{paused:true},'http://evil.invalid')).status,403);
 assert.equal((await request('/api/forward/pause',{paused:true})).status,200);
 assert.equal(JSON.parse(await readFile(path.join(dir,'forward.json'),'utf8')).paused,true);
 assert.equal((await request('/api/forward/pause',{paused:false})).status,200);
 let s=JSON.parse((await request('/api/state')).body);assert.equal(s.paper.quantity,0);assert.equal(s.research,null);
 assert.equal((await request('/api/pause',{paused:true},'http://evil.invalid')).status,403);
 assert.equal((await request('/api/pause',{paused:'true'})).status,400);
 const pause=await request('/api/pause',{paused:true});assert.equal(pause.status,200,pause.body);
 assert.equal(JSON.parse(await readFile(path.join(dir,'paper.json'),'utf8')).paper.paused,true);
 const epoch=Date.UTC(2025,0,1),hour=3600000;const candles=Array.from({length:720},(_,i)=>{const a=100+Math.sin((i-1)/9)*8,b=100+Math.sin(i/9)*8;return[epoch+i*hour,a,Math.max(a,b)+1,Math.min(a,b)-1,b,10,epoch+(i+1)*hour-1];});
 assert.equal((await request('/api/import',{candles})).status,200);
 s=JSON.parse((await request('/api/state')).body);assert.equal(s.research.runs.length,36);assert.match(s.research.source,/not independently verified/);assert.equal(s.research.selected,null);assert.equal(s.paper.trades.length,0);
 assert.equal((await request('/api/import',{candles:[[1]]})).status,400);
 console.log('Synthetic research isolated in temporary test state. Handler tested without network sockets.');
 }finally{delete process.env.PAPER_TEST_MODE;delete process.env.STATE_DIR;await rm(dir,{recursive:true,force:true});}
});
