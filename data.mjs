import {databaseStore,stateKey} from './storage.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
export const HOUR=3600000;
export function validateCandles(input,now=Date.now()) {
  if(!Array.isArray(input)||input.length<30||input.length>60000) throw Error('Expected 30–60,000 Binance hourly kline rows.');
  const rows=input.map(row=>{
    if(!Array.isArray(row)||row.length<7) throw Error('Invalid Binance kline row.');
    const r=row.slice(0,7).map(Number);
    if(r.some(x=>!Number.isFinite(x))||r[0]<1e12||r[0]>2e12||r[6]!==r[0]+HOUR-1||r[0]%HOUR!==0||r.slice(1,5).some(x=>x<=0)||r[5]<0||r[2]<Math.max(r[1],r[4])||r[3]>Math.min(r[1],r[4])||r[2]<r[3]) throw Error('Invalid OHLCV values, timestamp units, or non-hourly interval.');
    return r;
  }).filter(r=>r[6]<now);
  if(rows.length<30)throw Error('At least 30 completed hourly candles required.');
  for(let i=1;i<rows.length;i++)if(rows[i][0]-rows[i-1][0]!==HOUR)throw Error('Missing, duplicated, or unordered candles. Repair source data before testing.');
  return rows;
}
const writes=new Map();
export async function atomicJson(file,value){const content=JSON.stringify(value,null,2);const pending=(writes.get(file)||Promise.resolve()).catch(()=>{}).then(async()=>{const db=await databaseStore();if(db)return db.write(stateKey(file),JSON.parse(content));await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',content);await rename(file+'.tmp',file);});writes.set(file,pending);return pending;}
export async function readJson(file,fallback){const db=await databaseStore();if(db)return db.read(stateKey(file),fallback);try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export async function publicGet(route,params={}){
  let last;
  for(const base of ['https://data-api.binance.vision','https://api.binance.com']){
    try{
      const u=new URL('/api/v3/'+route,base);for(const [k,v]of Object.entries(params))u.searchParams.set(k,String(v));
      const response=await fetch(u,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error(`Binance HTTP ${response.status}`);
      return await response.json();
    }catch(e){last=e; if(/HTTP (418|429|451)/.test(e.message))throw e;}
  }
  throw Error(`Binance connection failed: ${last?.cause?.code||last?.message}. Check DNS, internet, and regional access.`);
}
export async function downloadHistory(symbol,days=180){
  const end=Math.floor(Date.now()/HOUR)*HOUR-1;let start=end+1-days*24*HOUR;const all=[];
  while(start<end){const batch=await publicGet('klines',{symbol,interval:'1h',startTime:start,endTime:end,limit:1000});if(!Array.isArray(batch)||!batch.length)break;all.push(...batch);const next=Number(batch.at(-1)[0])+HOUR;if(next<=start)throw Error('History download made no progress.');start=next;}
  const rows=validateCandles(all);if(rows.length!==days*24)throw Error('Incomplete history download: expected '+days*24+' hourly candles, received '+rows.length);return rows;
}
