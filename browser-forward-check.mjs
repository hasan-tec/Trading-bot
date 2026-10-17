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
 await send('Page.navigate',{url:'http://127.0.0.1:8788/'});
 let ready=false;for(let i=0;i<100;i++){ready=await evaluate("Boolean(document.querySelectorAll('[data-wallet]').length===3&&state?.lastObservedAt)");if(ready)break;await delay(200);}assert.ok(ready,'Three forward wallets loaded');
 const initial=await evaluate("state");assert.equal(initial.wallets.length,3);assert.ok(initial.startedAt);assert.equal(initial.mode,'PAPER ONLY');
 for(const id of ['slow4h','slowDaily','hold']){await evaluate("document.querySelector('[data-wallet=\""+id+"\"]').click();true");assert.equal(await evaluate("selected"),id);}
 await evaluate("document.getElementById('view-equity').click();true");assert.match(await evaluate("document.getElementById('chart-title').textContent"),/Wallet value/);
 await evaluate("document.getElementById('view-price').click();document.getElementById('pause').click();true");
 for(let i=0;i<40;i++){if(await evaluate("state.paused&&!acting"))break;await delay(100);}assert.equal(await evaluate("state.paused"),true);
 await evaluate("document.getElementById('pause').click();true");for(let i=0;i<40;i++){if(await evaluate("!state.paused&&!acting"))break;await delay(100);}assert.equal(await evaluate("state.paused"),false);
 await evaluate("document.querySelector('[data-wallet=\"slow4h\"]').click();true");
 assert.deepEqual(errors,[]);
 const status={passed:true,wallets:initial.wallets.map(w=>({name:w.name,equity:w.equity,trades:w.tradeCount})),controls:'wallet selection, chart switch and pause/resume verified',runtimeErrors:errors};
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('state/dashboard-forward.png',Buffer.from(shot.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(150);
 assert.ok(await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),'Mobile has no horizontal overflow');
 const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile('state/dashboard-forward-mobile.png',Buffer.from(mobile.data,'base64'));
 console.log(JSON.stringify({...status,mobile:'390px layout verified',screenshot:'state/dashboard-forward.png'}));
}finally{socket.close();}
