import test from 'node:test';
import assert from 'node:assert/strict';
import {createForward,advanceForward,FORWARD_CONFIG} from './forward.mjs';
import {marketSummary} from './markets.mjs';
test('gold has separate persistent config and holdings without mutating BTC defaults',()=>{
 const btc=createForward(),gold=createForward('PAXGUSDT');
 assert.equal(btc.config.symbol,'BTCUSDT');assert.equal(gold.config.symbol,'PAXGUSDT');assert.equal(FORWARD_CONFIG.symbol,'BTCUSDT');
 const H=3600000,epoch=Date.UTC(2024,0,1),rows=Array.from({length:5000},(_,i)=>[epoch+i*H,2000,2001,1999,2000,1,epoch+(i+1)*H-1]);
 const next=advanceForward(gold,rows,2000,rows.at(-1)[6]+1000);
 assert.equal(next.config.symbol,'PAXGUSDT');assert.equal(next.wallets[2].cash,800);assert.equal(btc.wallets[2].cash,1000);assert.equal(gold.wallets[2].trades.length,0);
 assert.throws(()=>marketSummary(rows,'PAXGUSDT'),/warm-up/);
});
