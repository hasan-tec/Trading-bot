import test from 'node:test';
import assert from 'node:assert/strict';
import {createForward,advanceForward,forwardSnapshot} from './forward.mjs';
const H=3600000,epoch=Date.UTC(2024,0,1);
const rows=Array.from({length:6000},(_,i)=>{const p=100+i*.01;return [epoch+i*H,p,p+1,p-1,p,1,epoch+(i+1)*H-1];});
test('wallets start independently; benchmark buys once; no retrospective strategy entry',()=>{
 const now=rows.at(-1)[6]+1000,initial=createForward(),s=advanceForward(initial,rows,160,now);
 assert.equal(initial.startedAt,null);assert.equal(s.wallets[0].trades.length,0);assert.equal(s.wallets[1].trades.length,0);
 assert.equal(s.wallets[2].trades.length,1);assert.equal(s.wallets[2].cash,800);assert.equal(s.wallets[0].cash,1000);
 const again=advanceForward(s,rows,161,now+30000);assert.equal(again.wallets[2].trades.length,1);
 assert.ok(again.wallets[2].equity>s.wallets[2].equity);assert.equal(again.wallets[0].equity,1000);
});
test('fresh candle buys once, persists across restore, and sells on weakened trend',()=>{
 const now=rows.at(-1)[6]+1000;let s=advanceForward(createForward(),rows,160,now);
 const extra=Array.from({length:4},(_,j)=>{const t=rows.at(-1)[0]+(j+1)*H;return [t,161,162,160,161,1,t+H-1];});
 // Keep observing during the four-hour interval; a healthy interval is not a monitoring gap.
 const end=extra.at(-1)[6]+1000;s.lastObservedAt=end-30000;
 s=advanceForward(s,[...rows,...extra],161,end);assert.equal(s.wallets[0].trades.length,1);assert.equal(s.wallets[0].trades[0].side,'buy');
 s=advanceForward(JSON.parse(JSON.stringify(s)),[...rows,...extra],162,end+30000);assert.equal(s.wallets[0].trades.length,1);
 const crash=Array.from({length:4},(_,j)=>{const t=extra.at(-1)[0]+(j+1)*H;return [t,50,51,49,50,1,t+H-1];});
 const exit=crash.at(-1)[6]+1000;s.lastObservedAt=exit-30000;s.paused=true;
 s=advanceForward(s,[...rows,...extra,...crash],50,exit);assert.equal(s.wallets[0].trades.at(-1).side,'sell');assert.equal(s.wallets[0].quantity,0);
});
test('offline gap is recorded and historical buys are skipped',()=>{
 const now=rows.at(-1)[6]+1000;let s=advanceForward(createForward(),rows,160,now);
 const more=Array.from({length:8},(_,j)=>{const t=rows.at(-1)[0]+(j+1)*H;return [t,161,162,160,161,1,t+H-1];});
 const resumed=more.at(-1)[6]+1000;s=advanceForward(s,[...rows,...more],161,resumed);
 assert.equal(s.gapCount,1);assert.equal(s.wallets[0].trades.length,0);assert.equal(s.wallets[0].skippedEntries,1);assert.equal(s.observedMs,0);
 assert.equal(forwardSnapshot(s,'PAPER RUNNING',null,resumed+100000).status,'OFFLINE');
});
test('pause blocks benchmark and trend entries; invalid or stale quotes do not mutate wallets',()=>{
 const start=createForward();start.paused=true;const now=rows.at(-1)[6]+1000;
 const s=advanceForward(start,rows,160,now);assert.equal(s.wallets[2].trades.length,0);
 assert.throws(()=>advanceForward(s,rows,0,now));assert.throws(()=>advanceForward(s,rows,160,now+3*H));
 assert.equal(s.wallets[0].cash,1000);
});
