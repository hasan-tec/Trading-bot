import {hostingConfig,authenticated} from './cloud.mjs';
import {databaseStore} from './storage.mjs';
import {createForward,advanceForward,forwardSnapshot,FORWARD_CONFIG} from './forward.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomicJson,readJson,validateCandles,downloadHistory,publicGet,HOUR} from './data.mjs';
import {signalAt,execute} from './engine.mjs';
import {research} from './research.mjs';
const hosting=hostingConfig();
if(hosting.cloud&&process.env.PAPER_TEST_MODE!=='1')await (await databaseStore()).acquireWriter();
const root=path.dirname(fileURLToPath(import.meta.url));
const config={symbol:'BTCUSDT',interval:'1h',kind:'ema',fast:9,slow:21,initialBalance:1000,fee:.001,slippage:.0005,allocation:.2};
const stateDir=process.env.STATE_DIR||path.join(root,'state');
const stateFile=path.join(stateDir,'paper.json'),historyFile=path.join(stateDir,'history.json');
const saved=await readJson(stateFile,null);
if(saved&&JSON.stringify(saved.config)!==JSON.stringify(config))throw Error('Saved paper configuration differs. Archive state before changing settings.');
let paper=saved?.paper||{cash:1000,quantity:0,entryCost:0,feesPaid:0,trades:[],equity:1000,price:null,paused:false,lastCandleTime:null,updatedAt:null,peakEquity:1000,day:null,dayStartEquity:1000,riskLocked:false};
let report=await readJson(path.join(stateDir,'research.json'),null),status='CONNECTING',error=null,health={lastSuccess:null,failures:0},busy=false,ticking=false;
const persist=()=>atomicJson(stateFile,{config,paper});
const forwardFile=path.join(stateDir,'forward.json');
let forward=await readJson(forwardFile,null);
if(forward&&JSON.stringify(forward.config)!==JSON.stringify(FORWARD_CONFIG))throw Error('Forward experiment rules changed. Preserve the existing experiment before starting different rules.');
forward=forward||createForward();
let forwardRows=[];
const seed=await readJson(historyFile,null);
if(seed?.symbol==='BTCUSDT'&&seed?.interval==='1h'&&seed?.source==='Binance public API')forwardRows=validateCandles(seed.rows);
const persistForward=()=>atomicJson(forwardFile,forward);
async function updateForward(rows,price){
 const merged=[...new Map([...forwardRows,...rows].map(r=>[r[0],r])).values()].sort((a,b)=>a[0]-b[0]).slice(-60000);
 try{forwardRows=validateCandles(merged);if(forwardRows.length<4900)throw Error('Warm-up needed');}
 catch{forwardRows=await downloadHistory('BTCUSDT',205);}
 forward=advanceForward(forward,forwardRows,price,Date.now());await persistForward();
}
async function tick(){if(ticking)return;ticking=true;try{
  const raw=await publicGet('klines',{symbol:config.symbol,interval:'1h',limit:1000});const rows=validateCandles(raw);const last=rows.at(-1);
  const quote=await publicGet('ticker/price',{symbol:config.symbol});const price=Number(quote.price);if(!Number.isFinite(price)||price<=0)throw Error('Invalid ticker price.');
  if(Date.now()-last[6]>HOUR+120000)throw Error('Stale Binance candles; entries blocked.');
  await updateForward(rows,price);
  paper.price=price;paper.equity=paper.cash+paper.quantity*price;
  paper.peakEquity=Math.max(paper.peakEquity,paper.equity);const day=new Date().toISOString().slice(0,10);
  if(paper.day!==day){paper.day=day;paper.dayStartEquity=paper.equity;}
  if(paper.equity<paper.peakEquity*.95||paper.equity<paper.dayStartEquity*.99)paper.riskLocked=true;
  if(paper.lastCandleTime!==null&&last[0]>paper.lastCandleTime){
    const missed=last[0]-paper.lastCandleTime>HOUR;const signal=signalAt(rows,config);
    if(signal==='sell'||(signal==='buy'&&!missed&&!paper.paused&&!paper.riskLocked))paper={...paper,...execute(paper,signal,price,Date.now(),config)};
  }
  // First connection establishes a watermark; no retroactive buys on old signals.
  paper.lastCandleTime=last[0];paper.equity=paper.cash+paper.quantity*price;paper.updatedAt=new Date().toISOString();
  health.lastSuccess=paper.updatedAt;health.failures=0;status=paper.riskLocked?'RISK LOCK':paper.paused?'ENTRIES PAUSED':'PAPER RUNNING';error=null;await persist();
}catch(e){health.failures++;status='DISCONNECTED';error=e.message;}finally{ticking=false;}}
async function runResearch(imported,days=30){if(busy)throw Error('Research already running.');busy=true;try{
  if(![5,30,90,180,365,730,1095].includes(days))throw Error("Choose 5, 30, 90, 180, 365, 730 or 1095 days.");
  let rows,source;
  if(imported){rows=validateCandles(imported);source='User-imported Binance-format data; provenance not independently verified';}
  else{try{rows=await downloadHistory(config.symbol,1095+205);source='Binance public API';await atomicJson(historyFile,{symbol:config.symbol,interval:'1h',source,rows});}catch(e){const cache=await readJson(historyFile,null);if(!cache)throw e;rows=validateCandles(cache.rows);source=`Cached ${cache.source}; fresh download failed: ${e.message}`;}}
  if(!imported&&rows.length<days*24+21)throw Error('History is too short for the requested window. '+source);
  report={...research(rows,config,days),source};await atomicJson(path.join(stateDir,'research.json'),report);return report;
}finally{busy=false;}}
function snapshot(){return {mode:'PAPER ONLY',status,error,config,paper,research:report,health:{...health,researchBusy:busy}};}
export const handler=async(req,res)=>{try{
  const host=req.headers.host;const allowed=hosting.cloud?host===new URL(hosting.origin).host:/^127\.0\.0\.1:\d+$/.test(host||'');if(!allowed){res.writeHead(403);return res.end('Local access only');}
  if(hosting.cloud){if(req.headers['x-forwarded-proto']!=='https'){res.writeHead(308,{Location:hosting.origin+req.url});return res.end();}if(!authenticated(req.headers.authorization,hosting.password)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Paper Lab", charset="UTF-8"'});return res.end('Private dashboard');}}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  const url=new URL(req.url,`http://${host}`);
  if(req.method==='GET'&&url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(path.join(root,'public','index.html')));}
  if(req.method==='GET'&&url.pathname==='/research'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(await readFile(path.join(root,'public','research.html')));}
  if(req.method==='GET'&&url.pathname==='/api/forward'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(forwardSnapshot(forward,status,error)));}
  if(req.method==='GET'&&url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&url.pathname==='/api/state'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(snapshot()));}
  if(req.method!=='POST'||!['/api/pause','/api/research','/api/import','/api/forward/pause'].includes(url.pathname)){res.writeHead(404);return res.end('Not found');}
  if(req.headers.origin!==(hosting.origin||`http://${host}`)||!req.headers['content-type']?.startsWith('application/json')){res.writeHead(403);return res.end('Origin and JSON required');}
  let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>8_000_000){res.writeHead(413);return res.end('Too large');}}
  const payload=JSON.parse(body||'{}');
  if(url.pathname==='/api/forward/pause'){if(typeof payload.paused!=='boolean')throw Error('paused must be boolean');forward.paused=payload.paused;await persistForward();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({paused:forward.paused}));}
  if(url.pathname==='/api/pause'){if(typeof payload.paused!=='boolean')throw Error('paused must be boolean');paper.paused=payload.paused;await persist();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({paused:paper.paused}));}
  await runResearch(url.pathname==='/api/import'?payload.candles:undefined,payload.days??30);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));
}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}};
if(process.env.PAPER_TEST_MODE!=='1'){
const server=http.createServer(handler);
server.on('error',e=>{if(e.code==='EADDRINUSE'){console.error('Paper Lab is already running on this port. Open http://127.0.0.1:'+(process.env.PORT||8788)+' or choose another PORT.');process.exit(0);}console.error(e);process.exit(1);});
server.listen(Number(process.env.PORT||8788),hosting.host,()=>console.log(`Paper-only dashboard: http://127.0.0.1:${server.address().port}`));
await tick();
setInterval(tick,30000).unref();
// Research is explicit and reproducible; paper price checks continue independently.
for(const event of ['SIGINT','SIGTERM'])process.on(event,async()=>{server.close();if(ticking){setTimeout(()=>process.exit(0),8000);return;}const db=await databaseStore();if(db)await db.close();process.exit(0);});
}
