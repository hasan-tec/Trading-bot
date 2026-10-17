import {readFile} from 'node:fs/promises';
import {downloadHistory,validateCandles,atomicJson} from './data.mjs';
import {research} from './research.mjs';
const arg=process.argv[2];
try{
const rows=arg?validateCandles(JSON.parse(await readFile(arg,'utf8'))):await downloadHistory('BTCUSDT');
const config={initialBalance:1000,fast:9,slow:21,fee:.001,slippage:.0005,allocation:.2};
const report=research(rows,config);await atomicJson('state/cli-research.json',report);
console.table(report.runs.map(r=>({strategy:r.label,...r.metrics})));console.log('Saved state/cli-research.json. No actual orders sent.');
}catch(e){console.error(e.message);process.exitCode=1;}
