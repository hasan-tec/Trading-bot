import {createForward,advanceForward,forwardSnapshot,FORWARD_CONFIG} from './forward.mjs';
import {publicGet,downloadHistory,validateCandles,readJson,atomicJson} from './data.mjs';
import {backtest,STRATEGIES} from './engine.mjs';
export const MARKETS={BTCUSDT:{name:'Bitcoin',unit:'BTC'},PAXGUSDT:{name:'Gold · PAXG',unit:'PAXG'}};
export function marketSummary(rows,symbol,days=365){
 const start=rows.length-days*24;if(start<4800)throw Error('Need evaluation history plus 200 daily warm-up candles');
 return {symbol,days,start:rows[start][0],end:rows.at(-1)[6],createdAt:Date.now(),source:'Binance public API',runs:STRATEGIES.map(spec=>{const r=backtest(rows,{...FORWARD_CONFIG,...spec,symbol,startIndex:start});return {id:spec.id,label:spec.label,metrics:r.metrics,quality:r.quality};})};
}
export async function goldService(dir){
 const file=name=>dir+'/'+name;
 let state=await readJson(file('gold-forward.json'),null),rows=[],status='CONNECTING',error=null,working=false;
 const expected={...FORWARD_CONFIG,symbol:'PAXGUSDT'};
 if(state){const {isDeepStrictEqual}=await import('node:util');if(!isDeepStrictEqual(state.config,expected))throw Error('Gold wallet configuration differs');}
 else state=createForward('PAXGUSDT');
 const cached=await readJson(file('gold-history.json'),null);if(cached?.symbol==='PAXGUSDT')rows=validateCandles(cached.rows);
 let summary=await readJson(file('gold-summary.json'),null);
 async function tick(){if(working)return;working=true;try{
  const latest=validateCandles(await publicGet('klines',{symbol:'PAXGUSDT',interval:'1h',limit:1000}));
  let merged=[...new Map([...rows,...latest].map(r=>[r[0],r])).values()].sort((a,b)=>a[0]-b[0]);
  try{merged=validateCandles(merged);if(merged.length<570*24)throw Error('Warm-up needed');}catch{merged=await downloadHistory('PAXGUSDT',570);}
  rows=merged.slice(-60000);const quote=await publicGet('ticker/price',{symbol:'PAXGUSDT'});
  const next=advanceForward(state,rows,Number(quote.price));await atomicJson(file('gold-forward.json'),next);state=next;
  status='RUNNING';error=null;
  if(!summary||Date.now()-summary.createdAt>86400000){summary=marketSummary(rows,'PAXGUSDT');await atomicJson(file('gold-summary.json'),summary);await atomicJson(file('gold-history.json'),{symbol:'PAXGUSDT',rows});}
 }catch(e){status='DISCONNECTED';error=e.message;}finally{working=false;}}
 return {tick,snapshot:()=>({...forwardSnapshot(state,status,error),market:MARKETS.PAXGUSDT,backtests:summary}),pause:async paused=>{state.paused=paused;await atomicJson(file('gold-forward.json'),state);}};
}
