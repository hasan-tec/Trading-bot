import test from 'node:test';
import assert from 'node:assert/strict';
import {backtest,strategySignals,STRATEGIES} from './engine.mjs';
import {research,fiveDay} from './research.mjs';
const hour=3600000,epoch=Date.UTC(2024,0,1);
const fixture=(n=1800)=>Array.from({length:n},(_,i)=>{const a=100+i*.02+8*Math.sin((i-1)/12),b=100+i*.02+8*Math.sin(i/12);return [epoch+i*hour,a,Math.max(a,b)+.1,Math.min(a,b)-.1,b,1,epoch+(i+1)*hour-1];});
test('all strategy signals and fills are independent of future data',()=>{
 const rows=fixture();
 for(const spec of STRATEGIES){
  assert.deepEqual(strategySignals(rows,spec).slice(0,900),strategySignals(rows.slice(0,900),spec));
  const a=backtest(rows.slice(0,900),{...spec,startIndex:300}),b=backtest(rows,{...spec,startIndex:300});
  assert.deepEqual(b.equity.slice(0,a.equity.length),a.equity);
  assert.deepEqual(b.trades.filter(t=>t.time<rows[900][0]),a.trades);
 }
});
test('breakout excludes current high and executes one candle later',()=>{
 const rows=fixture(220);for(let i=0;i<rows.length;i++)rows[i]=[epoch+i*hour,100,101,99,100,1,epoch+(i+1)*hour-1];
 rows[205]=[rows[205][0],100,110,99,105,1,rows[205][6]];
 const o={strategy:'breakout'};assert.equal(strategySignals(rows,o)[205],'buy');
 const result=backtest(rows,{...o,startIndex:200});assert.equal(result.trades[0].time,rows[206][0]);assert.equal(result.trades[0].rawPrice,100);
});
test('research windows share boundaries, reset cash, and expose quality metrics',()=>{
 const r=research(fixture(),{},30);assert.equal(r.runs.length,36);assert.equal(r.replay.hours,720);assert.equal(r.replay.runs.length,9);
 for(const run of r.runs){assert.equal(run.equity[0].time,run.section==='validation'?r.splitTime:epoch+1230*hour);assert.equal(run.metrics.initialBalance,1000);assert.ok(run.quality);}
 for(const fold of r.folds)for(const run of fold.runs)assert.equal(run.metrics.initialBalance,1000);
 assert.throws(()=>fiveDay(fixture(),{},10));
});
