import {CANDIDATES,aggregateClosed,candidateIndicators} from './candidates.mjs';
import {backtest,indicators,STRATEGIES} from './engine.mjs';
import {createHash} from 'node:crypto';
export function research(candles,config,days=30){
 const split=Math.floor(candles.length*.7);if(split<30||candles.length-split<30)throw Error('Need at least 100 hourly candles for research split.');
 const runs=[];
 // Common 250-day prefix supports daily EMA200 without leaking future prices.
 const warmup=Math.min(6000,Math.max(0,split-30));
 for(const spec of STRATEGIES)for(const section of ['development','validation']){
  const from=section==='development'?warmup:split,prefix=Math.max(0,from-6000),rows=candles.slice(prefix,section==='development'?split:undefined);
  for(const stress of [false,true]){
   const result=backtest(rows,{...config,...spec,slippage:stress?.001:(config.slippage??.0005),startIndex:from-prefix});
   runs.push({label:`${spec.label} · ${section}${stress?' · 10bp/side stress':''}`,kind:spec.id,section,stress,description:spec.description,...compact(result)});
  }
 }
 const folds=[];
 for(let start=split;start<candles.length;start+=24*30){
  const end=Math.min(candles.length,start+24*30);if(end-start<24*7)continue;
  const prefix=Math.max(0,start-6000);
  folds.push({start:candles[start][0],end:candles[end-1][6],runs:STRATEGIES.map(spec=>{const r=backtest(candles.slice(prefix,end),{...config,...spec,startIndex:start-prefix});return {id:spec.id,label:spec.label,metrics:r.metrics,quality:r.quality};})});
 }
 return {fiveDay:fiveDay(candles,config),replay:fiveDay(candles,config,days),folds,strategies:STRATEGIES,createdAt:new Date().toISOString(),dataHash:createHash('sha256').update(JSON.stringify(candles)).digest('hex'),candles:candles.length,start:candles[0][0],end:candles.at(-1)[6],splitTime:candles[split][0],runs,selected:null,label:'No strategy promoted',selectionRule:'Nine fixed variants, shared up-to-6000-hour warm-up, chronological 70/30 development/validation and separate monthly validation windows. Monthly windows reset to cash; no tuning or automatic promotion. Viewed validation is exploratory, not an untouched test.'};
}
export function fiveDay(candles,config,days=5){
 if(![5,30,90,180,365,730,1095].includes(days))throw Error('Choose 5, 30, 90, 180, 365, 730 or 1095 days.');
 const hours=days*24;if(candles.length<hours+21)return null;
 const start=candles.length-hours,prefix=Math.max(0,start-(days===5?100:6000)),rows=candles.slice(prefix),startIndex=start-prefix;
 const specs=days===5?STRATEGIES.slice(0,2):STRATEGIES;
 const runs=specs.map(spec=>{
  let values=indicators(rows,spec.kind,9,21);
  if(CANDIDATES.some(c=>c.id===spec.id)){const groups=aggregateClosed(rows,spec.id==='slowDaily'?24:4),v=candidateIndicators(groups.map(g=>g.row));let j=0,last={fast:null,slow:null};values=rows.map((_,i)=>{if(groups[j]?.endIndex===i){last=v[j];j++;}return {fast:last.fast,slow:last.slow};});}
  const result=backtest(rows,{...config,...spec,startIndex});
  return {kind:spec.id,label:spec.label,description:spec.description,...compact(result),chartLegend:CANDIDATES.some(c=>c.id===spec.id)?"yellow: EMA20; blue: EMA50 on completed strategy candles":"yellow: average 9; blue: average 21",prices:thin(rows.slice(startIndex).map((c,i)=>({time:c[0],closeTime:c[6],open:c[1],high:c[2],low:c[3],close:c[4],...values[startIndex+i]}))),trades:result.trades.map(t=>({...t,signalTime:t.signalTime,reason:t.reason||(spec.strategy==='crossover'?(t.side==='buy'?'9 crossed above 21 on previous closed candle':'9 crossed below 21 on previous closed candle'):spec.label+(t.side==='buy'?' entry conditions met':' exit conditions met')+' on previous closed candle')}))};
 });
 return {start:candles[start][0],end:candles.at(-1)[6],hours,days,warmupHours:startIndex,runs};
}

function thin(a){return a.filter((_,i)=>i===0||i===a.length-1||i%Math.max(1,Math.ceil(a.length/1200))===0);}
function compact(result){return {...result,equity:thin(result.equity),benchmark:{...result.benchmark,equity:thin(result.benchmark.equity)}};}
