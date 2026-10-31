import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Site from './site';
import CommunityShell from './community-shell';
import {AccountPage,ChatPage,NewsPage} from './community-client';
import './globals.css';
import './community.css';
import './auth.css';
function App(){
 const [user,setUser]=useState<{id:string}|null>(null);
 useEffect(()=>{fetch('/api/account').then(r=>r.json()).then(d=>setUser(d.user)).catch(()=>{});},[]);
 const path=window.location.pathname.replace(/\/$/,'')||'/';
 const page=path==='/noticias'?<NewsPage/>:path==='/conta'?<AccountPage/>:path==='/chat-timao'?<ChatPage/>:null;
 return page?<CommunityShell active={path}>{page}</CommunityShell>:path==='/'?<Site userId={user?.id||null}/>:<CommunityShell active=""><h1>Página não encontrada.</h1><a className="button red" href="/">Voltar ao início</a></CommunityShell>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
