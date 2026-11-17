import {createHash} from 'node:crypto';
import {aggregateClosed} from './candidates.mjs';
import {strategySignals,execute} from './engine.mjs';
import {FORWARD_CONFIG} from './forward.mjs';
// Separate historical experiment. Never writes into a forward wallet.
export function replayFromStart(rows,symbol,startedAt){
 if(!Number.isFinite(startedAt)||startedAt<=0)throw Error('A real BTC experiment start is required');
 const start=rows.findIndex(c=>c[0]>=startedAt);
 if(start<0)throw Error('No completed history after the experiment start');
 if(rows[0][0]>startedAt-201*86400000)throw Error('Insufficient daily indicator warm-up');
 for(let i=1;i<rows.length;i++)if(rows[i][0]-rows[i-1][0]!==3600000)throw Error('Catch-up history has gaps');
 const config={...FORWARD_CONFIG,symbol};
 const wallets=[{id:'slow4h',name:'4-hour trend',hours:4},{id:'slowDaily',name:'Daily trend',hours:24},{id:'hold',name:'Buy & hold'}].map(spec=>{
  const signals=spec.hours?strategySignals(rows,{...config,strategy:spec.id}):null;
  // Startup establishes a watermark, exactly as the forward wallet does.
  const prior=spec.hours?aggregateClosed(rows.slice(0,start),spec.hours).at(-1)?.row[6]:null;
  let account={cash:1000,quantity:0,entryCost:0,feesPaid:0,trades:[]},peak=1000,drawdown=0;
  for(let i=start;i<rows.length;i++){
   const event=signals?.[i-1];
   let side=spec.id==='hold'&&i===start?'buy':'hold';
   if(event&&typeof event==='object'&&event.time>startedAt&&event.time>prior)side=event.side;
   const count=account.trades.length;account=execute(account,side,Number(rows[i][1]),rows[i][0],config);
   if(account.trades.length>count)Object.assign(account.trades.at(-1),{origin:'historical-catch-up',reason:'Historical catch-up: '+(event?.reason||'one-time benchmark purchase'),signalTime:event?.time??null});
   const equity=account.cash+account.quantity*Number(rows[i][4]);peak=Math.max(peak,equity);drawdown=Math.max(drawdown,(peak-equity)/peak*100);
  }
  const equity=account.cash+account.quantity*Number(rows.at(-1)[4]);
  return {...spec,...account,equity,netPnl:equity-1000,netReturnPct:(equity/1000-1)*100,maxDrawdownPct:drawdown,closedTrades:account.trades.filter(t=>t.side==='sell').length};
 });
 return {version:1,mode:'HISTORICAL CATCH-UP',symbol,requestedStart:startedAt,executionStart:rows[start][0],end:rows.at(-1)[6],createdAt:Date.now(),dataHash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),assumptions:'Separate replay; first available hourly open after BTC started. Closed-bar signals, next-hour opens, 20% allocation, 0.1% fees and 0.05% slippage per side. Assumes continuous operation, no historical pauses or outages. Never counted as live trades.',wallets};
}
