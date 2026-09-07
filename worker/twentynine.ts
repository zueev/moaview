import {memo,checklist} from './records';

const AUTH='https://auth-api.29cm.co.kr/api/v1/auth/refresh';
const API='https://preuser-api.29cm.co.kr/api/v4/preuser/events';
const HEADERS={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0','Accept':'application/json','Referer':'https://www.29cm.co.kr/preuser'};
const COOKIE='29cm:cookie';

type Result={ok:boolean;status:number;refreshed:boolean;found:number;added:number;updated:number;message?:string};

const jar=(cookie:string)=>({...HEADERS,Cookie:cookie});

// Set-Cookie로 새 값이 오면 보관한 쿠키를 그 값으로 갈아끼운다.
function merge(cookie:string,response:Response){
 const set=response.headers.getSetCookie?.()||[];
 if(!set.length)return {cookie,changed:false};
 const map=new Map(cookie.split(';').map(p=>p.trim()).filter(Boolean).map(p=>[p.slice(0,p.indexOf('=')),p]));
 let changed=false;
 for(const line of set){
  const pair=line.split(';')[0];const name=pair.slice(0,pair.indexOf('='));
  if(!name||/^(deleted|)$/.test(pair.slice(pair.indexOf('=')+1)))continue;
  if(map.get(name)!==pair){map.set(name,pair);changed=true}
 }
 return {cookie:[...map.values()].join('; '),changed};
}

async function refresh(cookie:string){
 const r=await fetch(AUTH,{method:'POST',headers:jar(cookie),body:'{}'});
 const merged=merge(cookie,r);
 return {ok:r.ok,status:r.status,cookie:merged.cookie,changed:merged.changed};
}

async function applications(cookie:string){
 const r=await fetch(API+'/my-applications?page=1&size=100',{headers:jar(cookie)});
 let body:any=null;try{body=await r.json()}catch{}
 return {status:r.status,body,...merge(cookie,r)};
}

export async function sync(db:D1Database,seed?:string):Promise<Result>{
 const result=await run(db,seed);
 await memo.set(db,'29cm:last',JSON.stringify({...result,at:new Date().toISOString()}));
 return result;
}

export async function state(db:D1Database){
 return {connected:!!await memo.get(db,COOKIE),last:JSON.parse(await memo.get(db,'29cm:last')||'null'),shape:await memo.get(db,'29cm:shape')};
}

async function run(db:D1Database,seed?:string):Promise<Result> {
 let cookie=await memo.get(db,COOKIE)||seed||'';
 if(!cookie)return {ok:false,status:0,refreshed:false,found:0,added:0,updated:0,message:'29CM 연결 정보가 아직 없습니다.'};

 let attempt=await applications(cookie);
 let refreshed=false;
 if(attempt.status===401||attempt.status===403){
  const renewed=await refresh(cookie);
  refreshed=true;
  if(!renewed.ok)return {ok:false,status:renewed.status,refreshed,found:0,added:0,updated:0,message:'29CM 로그인이 만료됐어요. 연결 정보를 다시 넣어 주세요.'};
  cookie=renewed.cookie;
  attempt=await applications(cookie);
 }
 if(attempt.cookie!==cookie||attempt.changed)cookie=attempt.cookie;
 await memo.set(db,COOKIE,cookie);

 if(attempt.status!==200)return {ok:false,status:attempt.status,refreshed,found:0,added:0,updated:0,message:'29CM 신청내역을 불러오지 못했어요.'};

 // 응답 형태를 처음 한 번 남겨 둔다. 매핑을 실제 데이터에 맞추기 위한 것.
 const list=attempt.body?.data?.list;
 if(Array.isArray(list)&&list.length&&!await memo.get(db,'29cm:shape'))
  await memo.set(db,'29cm:shape',JSON.stringify(list[0]));
 if(!Array.isArray(list))return {ok:false,status:200,refreshed,found:0,added:0,updated:0,message:'29CM 응답 형태를 알 수 없어요.'};

 let added=0,updated=0;
 for(const item of list){
  const key=String(item.preuserEventKey||'');
  if(!/^PE_[A-Za-z0-9]+$/.test(key))continue;
  const url='https://www.29cm.co.kr/preuser/event/'+key;
  const status=readStatus(String(item.applicationStatus||''));
  const due=deadline(item.reviewWriteEndAt);
  const existing=await db.prepare('SELECT id,status,due,tasks FROM campaigns WHERE url=?').bind(url).first<{id:string;status:string;due:string;tasks:string}>();
  const now=new Date().toISOString();
  if(!existing){
   await db.prepare(`INSERT INTO campaigns (id,title,platform,url,kind,status,due,notes,tasks,source,created,updated)
     VALUES (?,?,'29CM',?,'배송형',?,?,'',?,'29cm',?,?)`)
    .bind(crypto.randomUUID(),String(item.itemName||'29CM 체험단'),url,status,due,JSON.stringify(status==='당첨'?checklist('배송형'):[]),now,now).run();
   added++;
   continue;
  }
  // 손으로 완료한 것은 건드리지 않는다.
  if(existing.status==='완료')continue;
  const tasks=JSON.parse(existing.tasks) as ReturnType<typeof checklist>;
  const next=status==='당첨'&&!tasks.length?checklist('배송형'):tasks;
  if(existing.status===status&&existing.due===due&&next===tasks)continue;
  await db.prepare('UPDATE campaigns SET status=?,due=?,tasks=?,updated=? WHERE id=?')
   .bind(status,due||existing.due,JSON.stringify(next),now,existing.id).run();
  updated++;
 }
 return {ok:true,status:200,refreshed,found:list.length,added,updated};
}

// 29CM이 쓰는 신청 상태 값. 지금까지 확인된 것은 APPLIED와 LOSE이고,
// 당첨 값은 아직 못 봐서 흔한 표기를 함께 받아 둔다.
function readStatus(value:string){
 if(/WIN|SELECT|CHOSEN|당첨|선정/i.test(value))return '당첨';
 if(/LOSE|LOST|FAIL|REJECT|미선정|탈락/i.test(value))return '미선정';
 return '신청 완료';
}
function deadline(value:unknown){
 const at=Date.parse(String(value||''));
 return Number.isFinite(at)?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(at):'';
}
