// Fixed hypotheses recorded before fetching the extended dataset. No parameter search.
export const CANDIDATES=[
 {id:'slow4h',kind:'ema',strategy:'slow4h',label:'4h slow trend',description:'Completed 4h candles: hold long when EMA20 > EMA50 and close > EMA200; otherwise exit. 20% allocation.'},
 {id:'slowDaily',kind:'ema',strategy:'slowDaily',label:'Daily slow trend',description:'Completed UTC daily candles: hold long when EMA20 > EMA50 and close > EMA200; otherwise exit. 20% allocation.'},
 {id:'reversion',kind:'ema',strategy:'reversion',label:'4h RSI / Bollinger',description:'Completed 4h close below the 20-bar lower Bollinger band (2 standard deviations) and RSI14 < 30: buy. Exit at the middle band or RSI > 55. Exit at a 3% close-based loss or after 30 four-hour bars.'},
 {id:'regime',kind:'ema',strategy:'regime',label:'4h market-condition switch',description:'4h 20-bar efficiency ratio >= 0.35: use slow trend. Ratio <= 0.20: use RSI/Bollinger mean reversion. Otherwise stay in cash. Mean-reversion entries have a 3% close-based loss exit and 30-bar time limit. One position only.'}
];

export function aggregateClosed(candles,hours){
 const size=hours*3600000,out=[];
 let group=[];
 const flush=()=>{if(group.length!==hours)return;const first=group[0],last=group.at(-1);if(first[0]%size!==0||last[6]!==first[0]+size-1)return;
  out.push({row:[first[0],first[1],Math.max(...group.map(c=>Number(c[2]))),Math.min(...group.map(c=>Number(c[3]))),last[4],group.reduce((s,c)=>s+Number(c[5]),0),last[6]],endIndex:last.index});};
 for(let i=0;i<candles.length;i++){
  const c=candles[i];if(group.length&&Math.floor(group[0][0]/size)!==Math.floor(c[0]/size)){flush();group=[];}
  group.push(Object.assign([...c],{index:i}));
 }flush();return out;
}
function ema(p,n){let sum=0,last=null;return p.map((v,i)=>{if(i<n)sum+=v;if(i===n-1)last=sum/n;else if(i>=n)last=last+(v-last)*2/(n+1);return last;});}
export function candidateIndicators(rows){
 const p=rows.map(c=>Number(c[4])),fast=ema(p,20),slow=ema(p,50),long=ema(p,200);
 let gain=0,loss=0;
 return p.map((close,i)=>{
  let rsi=null;if(i>0){const delta=close-p[i-1];if(i<=14){gain+=Math.max(delta,0);loss+=Math.max(-delta,0);if(i===14){gain/=14;loss/=14;}}else{gain=(gain*13+Math.max(delta,0))/14;loss=(loss*13+Math.max(-delta,0))/14;}if(i>=14)rsi=gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);}
  let middle=null,lower=null,efficiency=null;
  if(i>=19){const window=p.slice(i-19,i+1);middle=window.reduce((a,b)=>a+b,0)/20;lower=middle-2*Math.sqrt(window.reduce((s,v)=>s+(v-middle)**2,0)/20);}
  if(i>=20){let path=0;for(let j=i-19;j<=i;j++)path+=Math.abs(p[j]-p[j-1]);efficiency=path?Math.abs(close-p[i-20])/path:0;}
  return {fast:fast[i],slow:slow[i],long:long[i],rsi,middle,lower,efficiency};
 });
}

export function candidateSignals(candles,strategy){
 const groups=aggregateClosed(candles,strategy==='slowDaily'?24:4),v=candidateIndicators(groups.map(g=>g.row)),signals=Array(candles.length).fill('hold');
 for(let i=0;i<groups.length;i++){
  const g=groups[i],a=v[i],close=Number(g.row[4]);let signal='hold',regime='neutral';
  if(strategy==='slow4h'||strategy==='slowDaily'){
   if(a.long!==null){regime='trend';signal=a.fast>a.slow&&close>a.long?'buy':'sell';}
  }else if(strategy==='regime'&&a.long===null){/* common indicator warm-up */}
  else{
   regime=strategy==='reversion'?'range':a.efficiency>=.35?'trend':a.efficiency<=.20?'range':'neutral';
   if(regime==='trend')signal=a.fast>a.slow&&close>a.long?'buy':'sell';
   else if(regime==='neutral')signal='sell';
   else if(a.rsi!==null&&a.middle!==null)signal=close<a.lower&&a.rsi<30?'buy':close>=a.middle||a.rsi>55?'sell':'hold';
  }
  signals[g.endIndex]={side:signal,regime,time:g.row[6],reason:strategy+' / '+regime+' / completed '+(strategy==='slowDaily'?'daily':'4h')+' candle'};
 }
 return signals;
}
