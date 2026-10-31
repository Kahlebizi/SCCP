import {scrypt as derive,randomBytes,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive);
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64);return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password,encoded){try{const [scheme,salt,hex]=encoded.split(':');if(scheme!=='scrypt'||!salt||hex?.length!==128)return false;const key=await scrypt(password,salt,64);return timingSafeEqual(key,Buffer.from(hex,'hex'));}catch{return false;}}
