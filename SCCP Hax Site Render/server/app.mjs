import express from 'express';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {hashPassword,verifyPassword} from './password.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
const positions=['Torcedor','Goleiro','Defensor','Meio-campo','Atacante','Comissão'];
const valid=(s,max,min=1)=>typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max;
const cookieName='sccp_session';
const error=(res,status,message)=>res.status(status).json({error:message});
export async function createApp({db,adminUsername=process.env.ADMIN_USERNAME||'KahLebz',adminHash=process.env.ADMIN_PASSWORD_HASH,staticPath=resolve('dist'),production=process.env.NODE_ENV==='production'}){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
 if(adminHash){if(!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(adminHash))throw new Error('ADMIN_PASSWORD_HASH inválido.');
 const existing=(await db.all('SELECT id FROM users WHERE username_key=?',[adminUsername.toLowerCase()]))[0];
 if(existing)await db.run("UPDATE users SET password_hash=?,role='admin',username=? WHERE id=?",[adminHash,adminUsername,existing.id]);
 else {const id=randomUUID();await db.run("INSERT INTO users(id,username,username_key,password_hash,role) VALUES(?,?,?,?,'admin')",[id,adminUsername,adminUsername.toLowerCase(),adminHash]);await db.run("INSERT INTO profiles(user_id,nickname,position,bio,updated_at) VALUES(?,?,'Comissão','',?)",[id,adminUsername,Date.now()]);}}
 const dummy=await hashPassword(randomBytes(32).toString('hex'));
 app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');next();});
 app.get('/healthz',(req,res)=>res.json({ok:true}));
 app.use('/api',async(req,res,next)=>{res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method)){
   const origin=req.headers.origin;const expected=`${req.protocol}://${req.get('host')}`;
   if(!origin||origin!==expected)return error(res,403,'Origem inválida.');
  }
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  req.sessionToken=token;req.user=null;
  if(token&&/^[a-f0-9]{64}$/.test(token))req.user=(await db.all('SELECT u.id,u.username,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',[digest(token),Date.now()]))[0]||null;
  next();
 });
 app.use('/api',express.json({limit:'24kb'}));
 const member=(req,res,next)=>req.user?next():error(res,401,'Entre na sua conta para continuar.');
 const owner=(req,res,next)=>req.user?.role==='admin'?next():error(res,req.user?403:401,'Apenas a administração pode publicar anúncios.');
 async function throttle(key,max,period){const now=Date.now();await db.run('DELETE FROM login_attempts WHERE expires_at<?',[now]);
  await db.run('INSERT INTO login_attempts(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=login_attempts.attempts+1',[key,now+period]);
  return (await db.all('SELECT attempts FROM login_attempts WHERE key=?',[key]))[0].attempts<=max;
 }
 async function session(res,id){const token=randomBytes(32).toString('hex');await db.run('DELETE FROM sessions WHERE expires_at<?',[Date.now()]);await db.run('INSERT INTO sessions VALUES(?,?,?)',[digest(token),id,Date.now()+604800000]);res.cookie(cookieName,token,{httpOnly:true,secure:production,sameSite:'lax',maxAge:604800000,path:'/'});}
 app.post('/api/auth/login',async(req,res)=>{const {username,password}=req.body||{};
  if(!valid(username,24)||typeof password!=='string'||password.length>128)return error(res,400,'Informe o usuário e a senha.');
  const key=`login:${req.ip}:${username.toLowerCase()}`;
  if(!await throttle(key,10,900000))return error(res,429,'Muitas tentativas. Aguarde 15 minutos.');
  const user=(await db.all('SELECT * FROM users WHERE username_key=?',[username.trim().toLowerCase()]))[0];
  const correct=await verifyPassword(password,user?.password_hash||dummy);
  if(!user||!correct)return error(res,401,'Usuário ou senha incorretos.');
  await db.run('DELETE FROM login_attempts WHERE key=?',[key]);await session(res,user.id);res.json({ok:true});
 });
 app.post('/api/auth/register',async(req,res)=>{const {username,password}=req.body||{};
  if(typeof username!=='string'||!/^\w[\w.-]{2,23}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)return error(res,400,'Use um usuário de 3 a 24 caracteres (letras, números, ponto, traço ou _) e senha de 8 a 128 caracteres.');
  if(!await throttle(`register:${req.ip}`,10,3600000))return error(res,429,'Muitos cadastros. Tente mais tarde.');
  const key=username.toLowerCase();if(key===adminUsername.toLowerCase()||(await db.all('SELECT id FROM users WHERE username_key=?',[key])).length)return error(res,409,'Esse nome de usuário não está disponível.');
  const id=randomUUID();const hash=await hashPassword(password);
  try{await db.run("INSERT INTO users VALUES(?,?,?,?,'member')",[id,username,key,hash]);}catch(e){if(e.code==='23505'||e.code==='ERR_SQLITE_ERROR')return error(res,409,'Esse nome de usuário não está disponível.');throw e;}
  await db.run("INSERT INTO profiles VALUES(?,?,'Torcedor','',?)",[id,username,Date.now()]);await session(res,id);res.status(201).json({ok:true});
 });
 app.post('/api/auth/logout',async(req,res)=>{if(req.sessionToken)await db.run('DELETE FROM sessions WHERE token_hash=?',[digest(req.sessionToken)]);res.clearCookie(cookieName,{path:'/',httpOnly:true,secure:production,sameSite:'lax'});res.json({ok:true});});
 app.get('/api/account',async(req,res)=>{if(!req.user)return res.json({user:null});const p=(await db.all('SELECT nickname,position,bio FROM profiles WHERE user_id=?',[req.user.id]))[0];res.json({user:{id:req.user.id,admin:req.user.role==='admin'},profile:p||{nickname:req.user.username,position:'Torcedor',bio:''}});});
 app.put('/api/account',member,async(req,res)=>{const {nickname,position,bio}=req.body||{};if(!valid(nickname,24,2)||!positions.includes(position)||!valid(bio,240,0))return error(res,400,'Confira o apelido, a posição e a bio.');await db.run('INSERT INTO profiles VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,position=excluded.position,bio=excluded.bio,updated_at=excluded.updated_at',[req.user.id,nickname.trim(),position,bio.trim(),Date.now()]);res.json({ok:true});});
 app.get('/api/chat',async(req,res)=>{const rows=await db.all('SELECT m.id,m.user_id,m.body,m.created_at,p.nickname,u.username FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN profiles p ON p.user_id=m.user_id ORDER BY m.created_at DESC,m.id DESC LIMIT 80');res.json({messages:rows.reverse().map(m=>({id:m.id,body:m.body,createdAt:Number(m.created_at),nickname:m.nickname||m.username,mine:m.user_id===req.user?.id,canDelete:m.user_id===req.user?.id||req.user?.role==='admin'}))});});
 app.post('/api/chat',member,async(req,res)=>{if(!valid(req.body?.body,600))return error(res,400,'Escreva uma mensagem de até 600 caracteres.');const result=await db.run('INSERT INTO messages(id,user_id,body,created_at) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM messages WHERE user_id=? AND created_at>?)',[randomUUID(),req.user.id,req.body.body.trim(),Date.now(),req.user.id,Date.now()-3000]);if(!result.changes)return error(res,429,'Aguarde três segundos antes de enviar outra mensagem.');res.status(201).json({ok:true});});
 app.delete('/api/chat',member,async(req,res)=>{const id=String(req.query.id||'');const r=req.user.role==='admin'?await db.run('DELETE FROM messages WHERE id=?',[id]):await db.run('DELETE FROM messages WHERE id=? AND user_id=?',[id,req.user.id]);return r.changes?res.json({ok:true}):error(res,403,'Você não pode remover essa mensagem.');});
 app.get('/api/news',async(req,res)=>{const rows=await db.all('SELECT id,title,summary,body,created_at FROM news ORDER BY created_at DESC LIMIT 50');res.json({news:rows.map(n=>({...n,createdAt:Number(n.created_at)}))});});
 app.post('/api/news',owner,async(req,res)=>{const {title,summary,body}=req.body||{};if(!valid(title,100)||!valid(summary,220)||!valid(body,6000))return error(res,400,'Preencha título, resumo e texto do anúncio.');const id=randomUUID();await db.run('INSERT INTO news VALUES(?,?,?,?,?,?)',[id,title.trim(),summary.trim(),body.trim(),req.user.id,Date.now()]);res.status(201).json({id});});
 app.delete('/api/news',owner,async(req,res)=>{await db.run('DELETE FROM news WHERE id=?',[String(req.query.id||'')]);res.json({ok:true});});
 app.get('/api/photos',async(req,res)=>{const rows=await db.all('SELECT id,user_id,title,category FROM photos ORDER BY created_at DESC LIMIT 100');res.json({photos:rows.map(p=>({id:p.id,title:p.title,category:p.category,owner:p.user_id,url:`/api/photos/${p.id}`}))});});
 app.post('/api/photos',member,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'6mb'}),async(req,res)=>{const bytes=req.body;const type=req.get('content-type')?.split(';')[0];const title=String(req.query.title||'').trim(),category=String(req.query.category||'');
  if(!valid(title,100)||!['Corinthians','Haxball'].includes(category))return error(res,400,'Preencha a legenda e a categoria.');
  if(!Buffer.isBuffer(bytes)||!bytes.length||!['image/jpeg','image/png','image/webp'].includes(type))return error(res,415,'Envie uma imagem JPG, PNG ou WebP.');
  const signature=type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!signature)return error(res,400,'O arquivo não corresponde a uma imagem válida.');
  const count=(await db.all('SELECT COUNT(*) AS count FROM photos WHERE user_id=? AND created_at>?',[req.user.id,Date.now()-60000]))[0];if(Number(count.count)>=5)return error(res,429,'Aguarde um minuto antes de enviar mais fotos.');
  const total=Number((await db.all('SELECT COUNT(*) AS count FROM photos'))[0].count);if(total>=100)return error(res,409,'O mural está com 100 fotos. Remova registros antigos para liberar espaço.');
  const id=randomUUID();await db.run('INSERT INTO photos VALUES(?,?,?,?,?,?,?)',[id,req.user.id,title,category,type,bytes,Date.now()]);
  res.status(201).json({photo:{id,title,category,owner:req.user.id,url:`/api/photos/${id}`}});
 });
 app.get('/api/photos/:id',async(req,res)=>{const p=(await db.all('SELECT mime,content FROM photos WHERE id=?',[req.params.id]))[0];if(!p)return error(res,404,'Foto não encontrada.');res.setHeader('Content-Type',p.mime);res.setHeader('Cache-Control','public, max-age=3600');res.send(Buffer.from(p.content));});
 app.delete('/api/photos/:id',member,async(req,res)=>{const r=req.user.role==='admin'?await db.run('DELETE FROM photos WHERE id=?',[req.params.id]):await db.run('DELETE FROM photos WHERE id=? AND user_id=?',[req.params.id,req.user.id]);return r.changes?res.status(204).end():error(res,403,'Você não pode remover essa foto.');});
 app.use('/api',(req,res)=>error(res,404,'Rota não encontrada.'));
 app.use(express.static(staticPath));app.get('/{*path}',(req,res)=>res.sendFile(resolve(staticPath,'index.html')));
 app.use((err,req,res,next)=>{console.error('Falha no servidor:',err.code||err.name);if(res.headersSent)return next(err);error(res,err.status===413?413:500,err.status===413?'Arquivo muito grande. Use até 6 MB.':'O servidor não concluiu a operação. Tente novamente.');});
 return app;
}
