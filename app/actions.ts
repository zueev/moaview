import type {Campaign} from '@/lib/model';

const LEGACY='moaview.campaigns.v1';

async function call(path:string,init?:RequestInit){
 const r=await fetch('/api'+path,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json',...init?.headers}});
 if(r.status===401)throw Object.assign(new Error('로그인이 필요합니다.'),{unauthorized:true});
 // 서버가 없는 예전 정적 주소에서는 이 경로 자체가 없다.
 if(r.status===404)throw Object.assign(new Error('이 주소에는 서버가 없어요.'),{missing:true});
 const body=await r.json().catch(()=>null);
 if(!r.ok)throw new Error((body as {error?:string})?.error||'요청을 처리하지 못했어요.');
 return body;
}

export const unauthorized=(e:unknown)=>!!(e&&typeof e==='object'&&'unauthorized' in e);

export async function signIn(passphrase:string){await call('/login',{method:'POST',body:JSON.stringify({passphrase})})}
export const missingServer=(e:unknown)=>!!(e&&typeof e==='object'&&'missing' in e);
export async function session():Promise<'open'|'locked'|'moved'>{
 try{await call('/session');return 'open'}
 catch(e){return missingServer(e)?'moved':'locked'}
}

export async function listCampaigns():Promise<Campaign[]>{return await call('/campaigns') as Campaign[]}
export async function saveCampaign(input:Campaign):Promise<void>{await call('/campaigns',{method:'POST',body:JSON.stringify(input)})}
export async function toggleTask(id:string,taskId:string,done:boolean){await call(`/campaigns/${id}/task`,{method:'POST',body:JSON.stringify({taskId,done})})}

// 브라우저에만 있던 예전 기록을 처음 로그인할 때 한 번 옮긴다.
export async function migrateLocal(){
 let raw:string|null=null;
 try{raw=localStorage.getItem(LEGACY)}catch{return null}
 if(!raw)return null;
 const rows=JSON.parse(raw) as Campaign[];
 if(!Array.isArray(rows)||!rows.length){try{localStorage.removeItem(LEGACY)}catch{}return null}
 const result=await call('/import',{method:'POST',body:JSON.stringify(rows)}) as {moved:number;total:number};
 try{localStorage.setItem(LEGACY+'.moved',raw);localStorage.removeItem(LEGACY)}catch{}
 return result;
}
