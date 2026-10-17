import test from 'node:test';
import assert from 'node:assert/strict';
import {fiveDay} from './research.mjs';
import {backtest} from './engine.mjs';
test('five-day replay has exactly 120 evaluation hours, warmed averages and next-open fills',()=>{
 const epoch=Date.UTC(2025,0,1),hour=3600000;
 const rows=Array.from({length:240},(_,i)=>{const open=100+8*Math.sin((i-1)/9),close=100+8*Math.sin(i/9);return [epoch+i*hour,open,Math.max(open,close)+1,Math.min(open,close)-1,close,1,epoch+(i+1)*hour-1];});
 const config={initialBalance:1000,allocation:.2,fee:.001,slippage:.0005};
 const replay=fiveDay(rows,config);
 assert.equal(replay.end-replay.start+1,120*hour);
 assert.equal(replay.warmupHours,100);
 for(const run of replay.runs){
  assert.equal(run.prices.length,120);assert.equal(run.equity.length,120);
  assert.ok(run.prices.every(p=>Number.isFinite(p.fast)&&Number.isFinite(p.slow)));
  assert.ok(run.trades.length>0);
  assert.deepEqual(run.metrics,backtest(rows.slice(20),{...config,kind:run.kind,startIndex:100}).metrics);
  for(const t of run.trades){assert.ok(t.time>=replay.start);assert.equal(t.signalTime,t.time-1);const c=rows.find(c=>c[0]===t.time);assert.equal(t.rawPrice,c[1]);assert.match(t.reason,/completed candle/i);}
 }
 assert.equal(fiveDay(rows.slice(0,140),config),null);
});
