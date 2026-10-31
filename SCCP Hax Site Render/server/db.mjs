import {mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';
const schema=`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL,username_key TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member');
CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY,nickname TEXT NOT NULL,position TEXT NOT NULL DEFAULT 'Torcedor',bio TEXT NOT NULL DEFAULT '',updated_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,body TEXT NOT NULL,created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS messages_time_idx ON messages(created_at);
CREATE INDEX IF NOT EXISTS messages_user_time_idx ON messages(user_id,created_at);
CREATE TABLE IF NOT EXISTS news(id TEXT PRIMARY KEY,title TEXT NOT NULL,summary TEXT NOT NULL,body TEXT NOT NULL,user_id TEXT NOT NULL,created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS news_time_idx ON news(created_at);
CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,category TEXT NOT NULL,mime TEXT NOT NULL,content BYTEA NOT NULL,created_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS photos_time_idx ON photos(created_at);
CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at BIGINT NOT NULL);
`;
export async function openDatabase({url=process.env.DATABASE_URL,path='data/site.sqlite'}={}){
 if(url){const pool=new pg.Pool({connectionString:url,max:5});await pool.query(schema);return {async all(sql,args=[]){const q=numberParameters(sql);return (await pool.query(q,args)).rows;},async run(sql,args=[]){return {changes:(await pool.query(numberParameters(sql),args)).rowCount};},close:()=>pool.end()};}
 if(process.env.NODE_ENV==='production')throw new Error('DATABASE_URL é obrigatório em produção para manter os dados entre publicações.');
 if(path!==':memory:')mkdirSync('data',{recursive:true});const db=new DatabaseSync(path);db.exec(schema.replace('content BYTEA','content BLOB'));db.exec('PRAGMA journal_mode=WAL');
 return {async all(sql,args=[]){return db.prepare(sql).all(...args);},async run(sql,args=[]){return db.prepare(sql).run(...args);},close:async()=>db.close()};
}
function numberParameters(sql){let index=0;return sql.replace(/\?/g,()=>`$${++index}`);}
