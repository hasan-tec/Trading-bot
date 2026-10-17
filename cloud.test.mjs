import test from 'node:test';
import assert from 'node:assert/strict';
import {hostingConfig,authenticated} from './cloud.mjs';
test('hosted mode requires database, private password and exact HTTPS origin',()=>{
 assert.equal(hostingConfig({}).host,'127.0.0.1');
 assert.throws(()=>hostingConfig({DYNO:'web.1'}),/DATABASE_URL/);
 const env={DYNO:'web.1',DATABASE_URL:'postgres://test',DASHBOARD_PASSWORD:'a-long-test-password-123456',APP_ORIGIN:'https://paper.example.com'};
 assert.equal(hostingConfig(env).host,'0.0.0.0');assert.equal(hostingConfig(env).origin,'https://paper.example.com');
 assert.throws(()=>hostingConfig({...env,DASHBOARD_PASSWORD:'short'}),/20/);
 for(const origin of ['http://paper.example.com','https://paper.example.com/path','https://user:pass@paper.example.com'])assert.throws(()=>hostingConfig({...env,APP_ORIGIN:origin}));
});
test('dashboard authentication rejects wrong credentials and accepts only the private login',()=>{
 const basic=value=>'Basic '+Buffer.from(value).toString('base64');
 assert.equal(authenticated(undefined,'secret'),false);assert.equal(authenticated(basic('paper:wrong'),'secret'),false);
 assert.equal(authenticated(basic('wrong:secret'),'secret'),false);assert.equal(authenticated(basic('paper:secret'),'secret'),true);
});
