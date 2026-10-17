import {execute} from './engine.mjs';
import {aggregateClosed,candidateIndicators} from './candidates.mjs';

export const FORWARD_CONFIG=Object.freeze({symbol:'BTCUSDT',initialBalance:1000,allocation:.2,fee:.001,slippage:.0005,version:1});
const HOUR=3600000,OFFLINE_AFTER=90000;
const SPECS=[{id:'slow4h',name:'4-hour trend',hours:4},{id:'slowDaily',name:'Daily trend',hours:24},{id:'hold',name:'Buy & hold',hours:null}];
export function createForward(){return {version:1,config:FORWARD_CONFIG,startedAt:null,lastObservedAt:null,observedMs:0,offlineMs:0,gapCount:0,gaps:[],paused:false,price:null,priceHistory:[],wallets:SPECS.map(s=>({...s,cash:1000,quantity:0,entryCost:0,feesPaid:0,trades:[],equity:1000,peakEquity:1000,maxDrawdownPct:0,equityHistory:[],lastDecisionClose:null,nextDecisionAt:null,lastAction:'Waiting for market data',decisions:[],skippedEntries:0}))};}

export function advanceForward(previous,rows,price,now=Date.now()){
 if(!Number.isFinite(price)||price<=0)throw Error('Invalid forward quote');
 if(!rows.length||now-rows.at(-1)[6]>HOUR+120000||rows.at(-1)[6]>=now)throw Error('Forward candles are stale or incomplete');
 const state=structuredClone(previous);
 if(state.lastObservedAt!==null&&now<state.lastObservedAt)throw Error('Clock moved backwards; forward update blocked');
 if(state.startedAt===null)state.startedAt=now;
 const elapsed=state.lastObservedAt===null?0:now-state.lastObservedAt;
 const resumed=elapsed>OFFLINE_AFTER;
 if(resumed){state.offlineMs+=elapsed;state.gapCount++;state.gaps.push({from:state.lastObservedAt,to:now,durationMs:elapsed});state.gaps=state.gaps.slice(-100);}
 else state.observedMs+=elapsed;
 state.lastObservedAt=now;state.price=price;
 const sample=!state.priceHistory.length||now-state.priceHistory.at(-1).time>=300000;
 if(sample){state.priceHistory.push({time:now,price});state.priceHistory=state.priceHistory.slice(-2016);}
 for(const wallet of state.wallets){
  let side='hold',reason=null,signalTime=null;
  if(wallet.id==='hold'){
   if(wallet.trades.length===0&&!state.paused){side='buy';reason='Benchmark: buy BTC with 20% of starting funds, then hold.';}
   wallet.lastAction=wallet.trades.length?'Holding BTC; no scheduled sells':state.paused?'Entries paused':'Waiting for first benchmark purchase';
  }else{
   const groups=aggregateClosed(rows,wallet.hours),last=groups.at(-1),values=candidateIndicators(groups.map(g=>g.row)),v=values.at(-1);
   if(!last||v.long===null)throw Error('Not enough completed daily/4h candles to warm indicators');
   const close=last.row[6];wallet.nextDecisionAt=close+1+wallet.hours*HOUR;
   if(wallet.lastDecisionClose===null){
    wallet.lastDecisionClose=close;wallet.lastAction='Ready. Waiting for the next '+(wallet.hours===4?'4-hour':'daily')+' candle; no past signals traded.';
   }else if(close>wallet.lastDecisionClose){
    signalTime=close;
    const bullish=v.fast>v.slow&&Number(last.row[4])>v.long;
    const fresh=now-close<=OFFLINE_AFTER;
    if(!bullish&&wallet.quantity>0){side='sell';reason='Trend weakened: EMA20 is no longer above EMA50, or price is below EMA200.';if(!fresh)reason+=' Exit evaluated after a monitoring gap, at the current quote.';}
    else if(bullish&&wallet.quantity===0){
     if(state.paused)wallet.lastAction='Buy conditions met, but new entries are paused.';
     else if(!fresh||resumed){wallet.skippedEntries++;wallet.lastAction='Skipped an entry after a monitoring gap. Waiting for the next fresh candle.';}
     else{side='buy';reason='Trend confirmed: EMA20 > EMA50 and the completed close > EMA200.';}
    }else wallet.lastAction=wallet.quantity>0?'Trend still positive. Holding BTC.':'Buy conditions not met. Waiting in cash.';
    wallet.lastDecisionClose=close;
    wallet.decisions.push({time:now,signalTime,side,reason:reason||wallet.lastAction});wallet.decisions=wallet.decisions.slice(-100);
   }
  }
  const count=wallet.trades.length;
  Object.assign(wallet,execute(wallet,side,price,now,FORWARD_CONFIG));
  if(wallet.trades.length>count){const trade=wallet.trades.at(-1);Object.assign(trade,{reason,signalTime,walletId:wallet.id});wallet.lastAction=reason;}
  wallet.equity=wallet.cash+wallet.quantity*price;
  wallet.peakEquity=Math.max(wallet.peakEquity,wallet.equity);
  wallet.maxDrawdownPct=Math.max(wallet.maxDrawdownPct,(wallet.peakEquity-wallet.equity)/wallet.peakEquity*100);
  if(sample){wallet.equityHistory.push({time:now,equity:wallet.equity});wallet.equityHistory=wallet.equityHistory.slice(-2016);}
 }
 return state;
}

export function forwardSnapshot(state,status,error,now=Date.now()){
 const connected=status!=='DISCONNECTED'&&state.lastObservedAt!==null&&now-state.lastObservedAt<=OFFLINE_AFTER;
 return {mode:'PAPER ONLY',status:connected?(state.paused?'ENTRIES PAUSED':'RUNNING'):state.lastObservedAt===null?'CONNECTING':'OFFLINE',error,now,startedAt:state.startedAt,lastObservedAt:state.lastObservedAt,observedMs:state.observedMs,offlineMs:state.offlineMs,gapCount:state.gapCount,gaps:state.gaps.slice(-10),paused:state.paused,price:state.price,priceHistory:state.priceHistory,config:state.config,wallets:state.wallets.map(w=>({...w,tradeCount:w.trades.length,netPnl:w.equity-1000,netReturnPct:(w.equity/1000-1)*100,closedTrades:w.trades.filter(t=>t.side==='sell').length,trades:w.trades.slice(-100)}))};
}
