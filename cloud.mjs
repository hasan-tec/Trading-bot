import {createHash,timingSafeEqual} from 'node:crypto';
export function hostingConfig(env=process.env){
 const cloud=Boolean(env.DYNO)||env.NODE_ENV==='production';
 if(!cloud)return {cloud:false,host:'127.0.0.1',origin:null,password:null};
 if(!env.DATABASE_URL)throw Error('Hosted mode requires DATABASE_URL for durable wallets.');
 if(!env.DASHBOARD_PASSWORD||env.DASHBOARD_PASSWORD.length<20)throw Error('Hosted mode requires DASHBOARD_PASSWORD of at least 20 characters.');
 let origin;try{origin=new URL(env.APP_ORIGIN);}catch{throw Error('Set APP_ORIGIN to the app HTTPS address.');}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('APP_ORIGIN must be an HTTPS origin without a path.');
 return {cloud:true,host:'0.0.0.0',origin:origin.origin,password:env.DASHBOARD_PASSWORD};
}
export function authenticated(header,password){
 if(!header?.startsWith('Basic '))return false;
 const input=Buffer.from(header.slice(6),'base64').toString('utf8');
 const hash=x=>createHash('sha256').update(x).digest();
 return timingSafeEqual(hash(input),hash('paper:'+password));
}
