import {CANDIDATES,candidateSignals} from './candidates.mjs';
const DEFAULTS = Object.freeze({kind:'sma',fast:9,slow:21,initialBalance:1000,fee:0.001,slippage:0.0005,allocation:0.2});

function settings(options={}) {
  const o={...DEFAULTS,...options};
  if(!['crossover','trend','breakout','combined',...CANDIDATES.map(s=>s.strategy)].includes(o.strategy??'crossover'))throw Error('Unknown strategy');
  if(!['sma','ema'].includes(o.kind)) throw new Error('kind must be sma or ema');
  if(!Number.isInteger(o.fast)||!Number.isInteger(o.slow)||o.fast<1||o.slow<=o.fast) throw new Error('Require integer 1 <= fast < slow');
  for(const key of ['initialBalance','fee','slippage','allocation']) if(!Number.isFinite(o[key])) throw new Error(`Invalid ${key}`);
  if(o.initialBalance<=0||o.fee<0||o.fee>=1||o.slippage<0||o.slippage>=1||o.allocation<=0||o.allocation>1) throw new Error('Invalid balance, costs, or allocation');
  return o;
}

function prices(candles) {
  let previous=-Infinity;
  return candles.map(c=>{
    const t=Number(c[0]),p=Number(c[4]);
    if(!Number.isFinite(t)||t<=previous||!Number.isFinite(p)||p<=0) throw new Error('Candles require ascending unique timestamps and positive closes');
    previous=t;
    return p;
  });
}

function average(values,period,kind) {
  let sum=0,current=null;
  return values.map((value,i)=>{
    if(kind==='sma') {
      sum+=value;
      if(i>=period) sum-=values[i-period];
      return i>=period-1?sum/period:null;
    }
    if(i<period) sum+=value;
    if(i===period-1) current=sum/period;
    else if(i>=period) current=value*(2/(period+1))+current*(1-2/(period+1));
    return current;
  });
}

/** Input candles must contain only completed Binance-format klines. */
export function indicators(candles,kind='sma',fast=9,slow=21) {
  const o=settings({kind,fast,slow}),p=prices(candles);
  const a=average(p,o.fast,o.kind),b=average(p,o.slow,o.kind);
  return a.map((value,i)=>({fast:value,slow:b[i]}));
}

function crossing(values,i) {
  if(i<1||values[i-1].slow===null||values[i].slow===null) return 'hold';
  const prev=values[i-1],now=values[i];
  if(prev.fast<=prev.slow&&now.fast>now.slow) return 'buy';
  if(prev.fast>=prev.slow&&now.fast<now.slow) return 'sell';
  return 'hold';
}

export function signalAt(candles,options={}) {
  const value=strategySignals(candles,options).at(-1);return typeof value==='object'?value.side:value??'hold';
}

export const STRATEGIES=[
 {id:'ema',kind:'ema',strategy:'crossover',label:'EMA 9/21',description:'Buy on an upward 9/21 cross; sell on a downward cross.'},
 {id:'sma',kind:'sma',strategy:'crossover',label:'SMA 9/21',description:'Simple-average crossover baseline.'},
 {id:'trend',kind:'ema',strategy:'trend',label:'EMA + trend filter',description:'Buy on an upward EMA 9/21 cross only above EMA 200. Exit below EMA 21 or EMA 200.'},
 {id:'breakout',kind:'ema',strategy:'breakout',label:'48h breakout',description:'Buy when close exceeds the previous 48 hourly highs. Exit below the previous 24 hourly lows.'},
 {id:'combined',kind:'ema',strategy:'combined',label:'Combined confirmation',description:'Buy on an upward EMA 9/21 cross, above EMA 200 and the previous 24 hourly highs. Exit below EMA 21, EMA 200, or the previous 24 hourly lows. All conditions share one 20% position.'}
];

STRATEGIES.push(...CANDIDATES);

export function strategySignals(candles,options={}){
 if(CANDIDATES.some(c=>c.strategy===options.strategy))return candidateSignals(candles,options.strategy);
 const o=settings(options),v=indicators(candles,o.kind,o.fast,o.slow),p=prices(candles),trend=average(p,200,'ema');
 return candles.map((c,i)=>{
  if(!o.strategy||o.strategy==='crossover')return crossing(v,i);
  if(i<200)return 'hold';
  const high=n=>Math.max(...candles.slice(i-n,i).map(c=>Number(c[2])));
  const low=n=>Math.min(...candles.slice(i-n,i).map(c=>Number(c[3])));
  if(o.strategy==='breakout')return p[i]>high(48)?'buy':p[i]<low(24)?'sell':'hold';
  if(p[i]<v[i].slow||p[i]<trend[i]||(o.strategy==='combined'&&p[i]<low(24)))return 'sell';
  const entry=crossing(v,i)==='buy'&&p[i]>trend[i];
  return entry&&(o.strategy!=='combined'||p[i]>high(24))?'buy':'hold';
 });
}

/** Pure paper-only accounting; no network access or actual order execution. */
export function execute(state,side,rawPrice,time,options={}) {
  const o=settings(options);
  if(!['buy','sell','hold'].includes(side)) throw new Error('Invalid side');
  if(!Number.isFinite(rawPrice)||rawPrice<=0) throw new Error('Invalid execution price');
  const next={...state,trades:[...(state.trades??[])]};
  next.cash=state.cash??o.initialBalance;
  next.quantity=state.quantity??0;
  next.entryCost=state.entryCost??0;
  next.feesPaid=state.feesPaid??0;
  if(![next.cash,next.quantity,next.entryCost,next.feesPaid].every(Number.isFinite)||next.cash<0||next.quantity<0) throw new Error('Invalid account state');
  if(side==='buy'&&next.quantity===0) {
    const budget=next.cash*o.allocation;
    const price=rawPrice*(1+o.slippage),notional=budget/(1+o.fee),fee=notional*o.fee;
    next.quantity=notional/price;
    next.cash-=budget;
    next.entryCost=budget;
    next.feesPaid+=fee;
    next.trades.push({side,time,price,rawPrice,quantity:next.quantity,fee,notional,total:budget});
  } else if(side==='sell'&&next.quantity>0) {
    const price=rawPrice*(1-o.slippage),notional=next.quantity*price,fee=notional*o.fee,proceeds=notional-fee;
    const pnl=proceeds-next.entryCost;
    next.trades.push({side,time,price,rawPrice,quantity:next.quantity,fee,notional,total:proceeds,pnl,returnPct:pnl/next.entryCost*100});
    next.cash+=proceeds;
    next.quantity=0;
    next.entryCost=0;
    next.feesPaid+=fee;
  }
  return next;
}

export function backtest(candles,options={}) {
  const o=settings(options),signals=strategySignals(candles,o);
  const startIndex=Math.max(0,options.startIndex??0);
  if(!Number.isInteger(startIndex)) throw new Error('startIndex must be an integer');
  let account={cash:o.initialBalance,quantity:0,entryCost:0,feesPaid:0,trades:[]};
  let hold={...account,trades:[]},peak=o.initialBalance,maxDrawdownPct=0;
  const equity=[],benchmarkEquity=[];let rangeEntry=null;
  for(let i=0;i<candles.length;i++) {
    const c=candles[i],open=Number(c[1]),close=Number(c[4]),time=Number(c[0]);
    if(!Number.isFinite(open)||open<=0) throw new Error('Candles require positive opens');
    // Prefix candles initialize indicators without carrying positions or cash into evaluation.
    if(i<startIndex) continue;
    // First baseline entry shares the earliest possible crossover execution time.
    if(i===Math.max(o.slow,startIndex)) hold=execute(hold,'buy',open,time,o);
    const rawSignal=signals[i-1]??'hold',event=typeof rawSignal==='object'?rawSignal:null;
    let side=event?event.side:rawSignal,reason=event?.reason;
    if(event&&rangeEntry&&account.quantity>0){
      if(Number(candles[i-1][4])<=rangeEntry.price*.97){side='sell';reason='Mean-reversion 3% close-based loss exit (not a guaranteed stop fill)';}
      else if(time-rangeEntry.time>=120*3600000){side='sell';reason='Mean-reversion 120-hour holding limit';}
    }
    const before=account.trades.length;
    account=execute(account,side,open,time,o);
    if(account.trades.length>before){const trade=account.trades.at(-1);trade.reason=reason||('Previous completed candle: '+side);trade.signalTime=event?.time??Number(candles[i-1]?.[6]);
      if(side==='buy')rangeEntry=event?.regime==='range'?{price:trade.price,time}:null;
      else rangeEntry=null;
    }
    const value=account.cash+account.quantity*close,benchmarkValue=hold.cash+hold.quantity*close;
    peak=Math.max(peak,value);
    const drawdownPct=(peak-value)/peak*100;
    maxDrawdownPct=Math.max(maxDrawdownPct,drawdownPct);
    equity.push({time,equity:value,cash:account.cash,quantity:account.quantity,drawdownPct});
    benchmarkEquity.push({time,equity:benchmarkValue});
  }
  const finalEquity=equity.at(-1)?.equity??o.initialBalance;
  const closed=account.trades.filter(t=>t.side==='sell');
  const finalHold=benchmarkEquity.at(-1)?.equity??o.initialBalance;
  const gains=closed.reduce((s,t)=>s+Math.max(0,t.pnl),0),losses=-closed.reduce((s,t)=>s+Math.min(0,t.pnl),0);
  return {
    metrics:{initialBalance:o.initialBalance,finalEquity,netReturnPct:(finalEquity/o.initialBalance-1)*100,maxDrawdownPct,closedTrades:closed.length,winRatePct:closed.length?closed.filter(t=>t.pnl>0).length/closed.length*100:0,feesPaid:account.feesPaid,realizedPnl:closed.reduce((sum,t)=>sum+t.pnl,0),unrealizedPnl:account.quantity>0?account.quantity*Number(candles.at(-1)[4])-account.entryCost:0,openQuantity:account.quantity,buyHoldReturnPct:(finalHold/o.initialBalance-1)*100},
    quality:{profitFactor:losses>0?gains/losses:null,averageTradePnl:closed.length?closed.reduce((s,t)=>s+t.pnl,0)/closed.length:null,exposurePct:equity.length?100*equity.filter(p=>p.quantity>0).length/equity.length:0,sampleWarning:closed.length<30?'Fewer than 30 closed trades; weak sample.':null},
    equity,trades:account.trades,
    benchmark:{equity:benchmarkEquity,finalEquity:finalHold,netReturnPct:(finalHold/o.initialBalance-1)*100,description:`Buy and hold starts at evaluation index ${Math.max(o.slow,startIndex)} after warm-up; invests ${o.allocation*100}% of initial cash including entry fees, retains idle cash, and marks remaining units at close without hypothetical exit costs. Exposure may differ from strategy over time.`}
  };
}
