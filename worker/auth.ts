// 개인용 사이트라 사용자는 한 명이다. 암구호를 한 번 맞추면 서명한 쿠키를 오래 유지한다.
const COOKIE='mv_session';
const YEAR=31536000;

function bytes(s:string){return new TextEncoder().encode(s)}
const b64=(b:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

async function sign(secret:string,value:string){
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64(await crypto.subtle.sign('HMAC',key,bytes(value)));
}

// 길이와 무관하게 같은 시간을 쓰도록 전체를 훑는다.
function same(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i%b.length);return diff===0}

export async function token(secret:string){const exp=String(Math.floor(Date.now()/1000)+YEAR);return exp+'.'+await sign(secret,exp)}

export async function valid(request:Request,secret:string){
 const raw=request.headers.get('Cookie')||'';
 const value=raw.split(';').map(p=>p.trim()).find(p=>p.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!value)return false;
 const [exp,mac]=value.split('.');
 if(!exp||!mac||Number(exp)*1000<Date.now())return false;
 return same(await sign(secret,exp),mac);
}

export function cookie(value:string){
 return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${YEAR}`;
}

export function matches(input:unknown,passphrase:string){
 return typeof input==='string'&&input.length>0&&same(input,passphrase);
}
