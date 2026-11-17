import test from 'node:test';
import assert from 'node:assert/strict';
import {replayFromStart} from './catchup.mjs';
const H=3600000,epoch=Date.UTC(2024,0,1);
const rows=Array.from({length:6200},(_,i)=>{const p=100+i*.01+Math.sin(i/30)*3;return [epoch+i*H,p,p+1,p-1,p,1,epoch+(i+1)*H-1];});
test('catch-up starts after actual BTC timestamp and cannot trade before it',()=>{
 const start=rows[5000][0]+10000,original=JSON.stringify(rows),r=replayFromStart(rows,'PAXGUSDT',start);
 assert.equal(r.requestedStart,start);assert.equal(r.executionStart,rows[5001][0]);assert.equal(r.end,rows.at(-1)[6]);
 for(const w of r.wallets)for(const t of w.trades){assert.ok(t.time>start);assert.equal(t.origin,'historical-catch-up');}
 assert.equal(r.wallets[2].trades.length,1);assert.equal(r.wallets[2].trades[0].rawPrice,rows[5001][1]);
 assert.equal(JSON.stringify(rows),original);
});
test('replay is deterministic, independent of future candles and never duplicates benchmark buys',()=>{
 const start=rows[5000][0];const a=replayFromStart(rows.slice(0,5600),'PAXGUSDT',start),b=replayFromStart(rows,'PAXGUSDT',start),again=replayFromStart(rows,'PAXGUSDT',start);
 assert.deepEqual(b.wallets,again.wallets);
 for(let i=0;i<3;i++)assert.deepEqual(b.wallets[i].trades.filter(t=>t.time<rows[5600][0]),a.wallets[i].trades);
 assert.equal(b.wallets[2].trades.length,1);
});
test('catch-up rejects missing start, insufficient warm-up and gapped history',()=>{
 assert.throws(()=>replayFromStart(rows,'PAXGUSDT',null));
 assert.throws(()=>replayFromStart(rows,'PAXGUSDT',rows[100][0]),/warm-up/);
 assert.throws(()=>replayFromStart(rows.filter((_,i)=>i!==5300),'PAXGUSDT',rows[5000][0]),/gaps/);
});
