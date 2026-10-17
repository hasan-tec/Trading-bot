import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCandles,HOUR} from './data.mjs';
import {research} from './research.mjs';
export function fixture(n=720){const base=Date.UTC(2025,0,1);return Array.from({length:n},(_,i)=>{const open=100+Math.sin((i-1)/9)*8+i*.01,close=100+Math.sin(i/9)*8+i*.01;return [base+i*HOUR,open,Math.max(open,close)+1,Math.min(open,close)-1,close,10,base+(i+1)*HOUR-1];});}
test('data rejects gaps, duplicate rows, wrong timestamps and malformed OHLC',()=>{
 const rows=fixture();assert.equal(validateCandles(rows).length,720);
 for(const invalid of [rows.filter((_,i)=>i!==15),[...rows.slice(0,20),rows[19],...rows.slice(20)],rows.map(r=>[r[0]*1000,...r.slice(1)]),rows.map(r=>[r[0],r[1],1,r[3],r[4],r[5],r[6]])])assert.throws(()=>validateCandles(invalid));
});
test('data removes unfinished candles',()=>{const rows=fixture();assert.equal(validateCandles(rows,rows[99][0]+100).length,99);});
test('research separates chronological periods and never promotes a winner',()=>{
 const rows=fixture(),report=research(rows,{initialBalance:1000,fee:.001,slippage:.0005,allocation:.2,fast:9,slow:21});
 assert.equal(report.runs.length,36);assert.equal(report.selected,null);
 for(const run of report.runs){if(run.section==='validation')assert.ok(run.equity.every(p=>p.time>=report.splitTime));else assert.ok(run.equity.every(p=>p.time<report.splitTime));assert.ok(Number.isFinite(run.metrics.finalEquity));}
 for(const kind of ['sma','ema'])for(const section of ['development','validation']){const pair=report.runs.filter(r=>r.kind===kind&&r.section===section);assert.ok(pair[1].metrics.finalEquity<=pair[0].metrics.finalEquity);}
});
