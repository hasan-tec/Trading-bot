import path from 'node:path';
export class PostgresStore{
 constructor(pool){this.pool=pool;this.lease=null;}
 async init(){await this.pool.query('CREATE TABLE IF NOT EXISTS paper_lab_state (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');return this;}
 async read(key,fallback){const r=await this.pool.query('SELECT value FROM paper_lab_state WHERE key = $1',[key]);return r.rows.length?r.rows[0].value:fallback;}
 async write(key,value){await this.pool.query('INSERT INTO paper_lab_state (key,value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',[key,JSON.stringify(value)]);}
 async acquireWriter(){
  this.lease=await this.pool.connect();
  const r=await this.lease.query('SELECT pg_try_advisory_lock(7331,8788) AS acquired');
  if(!r.rows[0].acquired){this.lease.release();this.lease=null;throw Error('Another Paper Lab instance is already using this database. Run exactly one web dyno.');}
  this.lease.on('error',()=>{console.error('Database writer connection lost; stopping to prevent duplicate trading.');process.exit(1);});
 }
 async close(){if(this.lease){await this.lease.query('SELECT pg_advisory_unlock(7331,8788)');this.lease.release();this.lease=null;}await this.pool.end();}
}
let promise;
export async function databaseStore(){
 if(!process.env.DATABASE_URL)return null;
 if(!promise)promise=(async()=>{const {Pool}=await import('pg');const url=new URL(process.env.DATABASE_URL);const local=['localhost','127.0.0.1','::1'].includes(url.hostname);url.searchParams.delete('sslmode');
  const ssl=local?false:process.env.PG_CA_CERT?{ca:process.env.PG_CA_CERT,rejectUnauthorized:true}:{rejectUnauthorized:false};
  // Heroku documents TLS with self-signed certificates. A supplied CA enables verification.
  const pool=new Pool({connectionString:url.toString(),ssl,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
  pool.on('error',()=>{console.error('Database pool connection lost.');});return new PostgresStore(pool).init();})();
 return promise;
}
export function stateKey(file){const name=path.basename(file);if(!/^[a-zA-Z0-9_.-]+\.json$/.test(name))throw Error('Invalid state document key');return name;}
