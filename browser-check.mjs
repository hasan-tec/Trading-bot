import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let pages;
for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9333/json/list')).json();if(pages.some(p=>p.type==='page'))break;}catch{}await delay(250);}
const page=pages.find(p=>p.type==='page');
const socket=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[];let next=0;
socket.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);};
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
try{
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1800,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8788/research'});
 let ready=false;for(let i=0;i<100;i++){ready=await evaluate("Boolean(document.getElementById('window-runs')?.children.length>=9)");if(ready)break;await delay(200);}assert.ok(ready,'Nine-strategy comparison loaded');
 const status=await evaluate("({days:document.getElementById('research-days').value,rows:document.getElementById('window-runs').children.length,source:document.getElementById('replay-source').textContent})");assert.equal(status.days,'1095');assert.equal(status.rows,9);
 await evaluate("document.getElementById('replay-kind').value='slow4h';document.getElementById('replay-kind').dispatchEvent(new Event('change'));true");
 assert.match(await evaluate("document.getElementById('replay-description').textContent"),/Completed 4h/);
 const expected=await evaluate("state.research.replay.runs.find(r=>r.kind==='slow4h').metrics.finalEquity.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})");
 assert.ok((await evaluate("document.getElementById('replay-metrics').textContent")).includes(expected));
 await evaluate("document.getElementById('replay-play').click();true");await delay(1000);await evaluate("document.getElementById('replay-play').click();true");
 const step=await evaluate("Number(document.getElementById('replay-step').value)");assert.ok(step>1&&step<1200,'Replay advances and pauses');
 await evaluate("document.getElementById('replay-end').click();document.getElementById('replay-step').value='1';document.getElementById('replay-step').dispatchEvent(new Event('input'));true");
 assert.match(await evaluate("document.getElementById('replay-time').textContent"),/observation 1\//);
 await evaluate("document.getElementById('replay-end').click();document.getElementById('replay-kind').value='reversion';document.getElementById('replay-kind').dispatchEvent(new Event('change'));true");
 assert.match(await evaluate("document.getElementById('replay-description').textContent"),/RSI14/);
 await evaluate("document.getElementById('replay-kind').value='slow4h';document.getElementById('replay-kind').dispatchEvent(new Event('change'));true");
 assert.deepEqual(errors,[]);
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('state/dashboard-candidates.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({passed:true,...status,replayControls:'play, pause, slider, end verified',strategyControls:'slow trend and RSI verified',runtimeErrors:errors,screenshot:'state/dashboard-candidates.png'}));
}finally{socket.close();}
