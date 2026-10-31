import {openDatabase} from './db.mjs';
import {createApp} from './app.mjs';
const db=await openDatabase();
const app=await createApp({db});
const port=Number(process.env.PORT||3000);
const server=app.listen(port,'0.0.0.0',()=>console.log(`SCCP Hax online na porta ${port}.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
