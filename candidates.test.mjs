import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateClosed,candidateIndicators,CANDIDATES} from './candidates.mjs';
import {strategySignals,backtest} from './engine.mjs';
import {fiveDay} from './research.mjs';
const hour=3600000,epoch=Date.UTC(2023,0,1);
function hourly(values){return values.flatMap((close,i)=>Array.from({length:4},(_,j)=>{const time=epoch+(i*4+j)*hour,open=i?values[i-1]:close;return [time,open,Math.max(open,close),Math.min(open,close),close,1,time+hour-1];}));}
test('aggregation waits for complete UTC-aligned bars and ignores partial prefixes',()=>{
 const rows=hourly([100,101,102]);
 assert.equal(aggregateClosed(rows.slice(0,3),4).length,0);
 assert.equal(aggregateClosed(rows.slice(1,8),4).length,1);
 const g=aggregateClosed(rows.slice(0,7),4);assert.equal(g.length,1);assert.equal(g[0].endIndex,3);assert.equal(g[0].row[5],4);
});
test('Wilder RSI and Bollinger flat series are finite and seeded correctly',()=>{
 const flat=candidateIndicators(hourly(Array(60).fill(100)));
 assert.equal(flat[13].rsi,null);assert.equal(flat[14].rsi,50);assert.equal(flat[19].middle,100);assert.equal(flat[19].lower,100);assert.equal(flat[20].efficiency,0);
 const rising=candidateIndicators(hourly(Array.from({length:60},(_,i)=>100+i)));assert.equal(rising.at(-1).rsi,100);
});
test('new strategies cannot see unfinished higher-timeframe candles or future prices',()=>{
 const rows=hourly(Array.from({length:2100},(_,i)=>100+i*.03+8*Math.sin(i/11)));
 for(const spec of CANDIDATES){
  const prefix=rows.slice(0,5501);assert.deepEqual(strategySignals(rows,spec).slice(0,prefix.length),strategySignals(prefix,spec));
  const a=backtest(prefix,{...spec,startIndex:4800}),b=backtest(rows,{...spec,startIndex:4800});
  assert.deepEqual(b.equity.slice(0,a.equity.length),a.equity);
  assert.deepEqual(b.trades.filter(t=>t.time<prefix.at(-1)[6]),a.trades);
  assert.ok(strategySignals(rows,spec).every((v,i)=>v==='hold'||(i+1)%(spec.id==='slowDaily'?24:4)===0));
 }
});
test('mean reversion loss exit uses following open, including an adverse gap',()=>{
 const v=Array(220).fill(100);v[210]=90;v[211]=80;v[212]=70;
 const rows=hourly(v),r=backtest(rows,{strategy:'reversion',startIndex:800});
 assert.equal(r.trades[0].side,'buy');assert.equal(r.trades[0].time,epoch+844*hour);
 assert.equal(r.trades[1].side,'sell');assert.match(r.trades[1].reason,/close-based loss/);
 assert.ok(r.trades[1].price<r.trades[0].price*.97);
});
test('mean reversion exits after 120 hours even without a band or loss exit',()=>{
 const v=Array(250).fill(100);for(let i=210;i<v.length;i++)v[i]=90-(i-210)*.01;
 const r=backtest(hourly(v),{strategy:'reversion',startIndex:800});
 assert.match(r.trades[1].reason,/120-hour/);assert.equal(r.trades[1].time-r.trades[0].time,120*hour);
});

test('sampled replay keeps price and account timestamps aligned without changing full-resolution metrics',()=>{
 const rows=hourly(Array.from({length:1600},(_,i)=>100+i*.01+8*Math.sin(i/12)));
 const replay=fiveDay(rows,{},180);
 for(const spec of CANDIDATES){
  const run=replay.runs.find(r=>r.kind===spec.id);
  assert.ok(run.prices.length<=1202);
  assert.deepEqual(run.prices.map(p=>p.time),run.equity.map(p=>p.time));
  const original=backtest(rows,{...spec,startIndex:rows.length-4320});
  assert.deepEqual(run.metrics,original.metrics);
  assert.equal(run.equity.at(-1).equity,run.metrics.finalEquity);
 }
});
