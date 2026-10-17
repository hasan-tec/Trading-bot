import test from 'node:test';
import assert from 'node:assert/strict';
import {indicators,signalAt,execute,backtest} from './engine.mjs';
const candles=values=>values.map((v,i)=>[i*3600000,String(v),String(v),String(v),String(v),'1',i*3600000+3599999]);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('fee and slippage accounting is exact and state is immutable',()=>{
  const state={cash:1000,quantity:0,entryCost:0,feesPaid:0,trades:[]};
  const o={allocation:0.2,fee:0.01,slippage:0.01};
  const bought=execute(state,'buy',100,1,o);
  near(bought.cash,800);
  near(bought.quantity,200/1.01/101);
  assert.equal(state.trades.length,0);
  assert.equal(execute(bought,'buy',100,2,o).quantity,bought.quantity);
  const sold=execute(bought,'sell',100,3,o);
  near(sold.cash,800+(200/1.01/101)*99*0.99);
  near(sold.trades.at(-1).pnl,sold.cash-1000);
  near(sold.feesPaid,200/1.01*0.01+(200/1.01/101)*99*0.01);
  assert.equal(sold.quantity,0);
});

test('indicators warm up and SMA and EMA differ after their seed',()=>{
  const c=candles([1,2,3,7]);
  assert.deepEqual(indicators(c,'sma',2,3).map(x=>x.slow),[null,null,2,4]);
  near(indicators(c,'ema',2,3).at(-1).slow,4.5);
});

test('signals execute at following open and open positions remain marked',()=>{
  const c=candles([3,2,1,3,10]);
  assert.equal(signalAt(c.slice(0,4),{fast:1,slow:2}),'buy');
  c[4][1]='8';
  const r=backtest(c,{fast:1,slow:2,allocation:1,fee:0,slippage:0});
  assert.equal(r.trades.length,1);
  assert.equal(r.trades[0].time,c[4][0]);
  assert.equal(r.trades[0].price,8);
  near(r.metrics.finalEquity,1250);
  assert.equal(r.metrics.closedTrades,0);
});

test('future data cannot change earlier indicators, trades or equity',()=>{
  const past=candles([5,4,3,6,7,2,1,4]);
  const future=candles([5,4,3,6,7,2,1,4,1000,0.1,900]);
  const options={fast:1,slow:2};
  assert.deepEqual(indicators(future,'ema',1,2).slice(0,past.length),indicators(past,'ema',1,2));
  const a=backtest(past,options),b=backtest(future,options);
  assert.deepEqual(b.equity.slice(0,past.length),a.equity);
  assert.deepEqual(b.trades.filter(t=>t.time<=past.at(-1)[0]),a.trades);
});

test('drawdown includes unrealized losses and benchmark pays entry fees',()=>{
  const r=backtest(candles([3,2,1,3,10,5]),{fast:1,slow:2,allocation:1,fee:0,slippage:0});
  near(r.metrics.maxDrawdownPct,50);
  const feeRun=backtest(candles([10,10,10,10]),{fast:1,slow:2,allocation:1,fee:0.01,slippage:0});
  near(feeRun.benchmark.finalEquity,1000/1.01);
});

test('empty data and invalid settings are handled explicitly',()=>{
  assert.equal(backtest([]).metrics.finalEquity,1000);
  assert.equal(signalAt([]),'hold');
  assert.throws(()=>backtest(candles([1,2]),{fast:3,slow:2}));
  assert.throws(()=>backtest(candles([1,0])));
  assert.throws(()=>execute({},'buy',100,1,{allocation:2}));
});

test('evaluation start retains prefix indicators but excludes prefix trades and equity',()=>{
  const c=candles([5,4,3,6,7,2,1,4,5]);
  const r=backtest(c,{fast:1,slow:2,startIndex:5,fee:0,slippage:0,allocation:1});
  assert.equal(r.equity.length,4);
  assert.equal(r.equity[0].time,c[5][0]);
  assert.ok(r.trades.every(t=>t.time>=c[5][0]));
  assert.equal(r.equity[0].quantity,0);
  assert.equal(r.trades[0].time,c[8][0]);
  assert.equal(r.benchmark.equity.length,4);
  near(r.benchmark.equity[0].equity,1000);
  const empty=backtest(c,{startIndex:99});
  assert.equal(empty.equity.length,0);
  assert.equal(empty.metrics.finalEquity,1000);
});
