import {hashPassword} from '../server/password.mjs';
import {readFile,writeFile} from 'node:fs/promises';
process.stdout.write('Senha do administrador (não será exibida): ');
let input='';
if(process.stdin.isTTY){
 process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 input=await new Promise((resolve,reject)=>{
  const cleanup=()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',read);};
  const read=chunk=>{for(const c of chunk){if(c==='\u0003'){cleanup();reject(new Error('Configuração cancelada.'));return;}if(c==='\r'||c==='\n'){cleanup();resolve(input);return;}if(c==='\u007f'||c==='\b')input=input.slice(0,-1);else input+=c;}};
  process.stdin.on('data',read);
 });
}else{for await(const chunk of process.stdin){input+=chunk;if(input.includes('\n'))break;}}
process.stdout.write('\n');
const password=input.trim();if(password.length<8||password.length>128)throw new Error('A senha deve ter de 8 a 128 caracteres.');
const hash=await hashPassword(password);
let existing='';try{existing=await readFile('.env','utf8');}catch{}
const retained=existing.split(/\r?\n/).filter(s=>s&&!s.startsWith('ADMIN_USERNAME=')&&!s.startsWith('ADMIN_PASSWORD_HASH=')).join('\n');
await writeFile('.env',`${retained}${retained?'\n':''}ADMIN_USERNAME=KahLebz\nADMIN_PASSWORD_HASH=${hash}\n`,{mode:0o600});
console.log('Administrador KahLebz configurado. Apenas o hash foi salvo no arquivo local .env.');
