import {statuses,platforms,type Campaign,type Task} from '../lib/model';

type Row={id:string;title:string;platform:string;url:string;kind:string;status:string;due:string;notes:string;tasks:string;created:string};
const toCampaign=(r:Row):Campaign=>({...r,tasks:JSON.parse(r.tasks)});

export function checklist(kind:string):Task[]{
 return [kind==='방문형'?'방문 일정 예약하기':'제품 수령 확인하기','사진 촬영과 체험 기록하기','필수 문구·키워드 확인 후 리뷰 작성하기','원본 사이트에 리뷰 링크 제출하기']
  .map(title=>({id:crypto.randomUUID(),title,done:false}));
}

export async function list(db:D1Database):Promise<Campaign[]>{
 const r=await db.prepare('SELECT id,title,platform,url,kind,status,due,notes,tasks,created FROM campaigns ORDER BY created DESC').all<Row>();
 return r.results.map(toCampaign);
}

export async function save(db:D1Database,input:Campaign):Promise<Campaign>{
 if(!input.title?.trim()||input.title.length>150)throw new Error('체험단 이름을 150자 이내로 입력해 주세요.');
 if(!statuses.includes(input.status)||!platforms.includes(input.platform)||!['배송형','방문형','기타'].includes(input.kind))throw new Error('입력 항목을 다시 확인해 주세요.');
 if(input.url){let u;try{u=new URL(input.url)}catch{throw new Error('올바른 공고 링크를 입력해 주세요.')}if(!['http:','https:'].includes(u.protocol)||input.url.length>2000)throw new Error('http 또는 https 링크만 저장할 수 있습니다.');}
 if(input.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.due)||isNaN(Date.parse(input.due))))throw new Error('마감일을 확인해 주세요.');
 if((input.notes||'').length>5000)throw new Error('메모는 5,000자 이내로 입력해 주세요.');

 const old=input.id
  ?await db.prepare('SELECT * FROM campaigns WHERE id=?').bind(input.id).first<Row>()
  :input.url?await db.prepare('SELECT * FROM campaigns WHERE url=?').bind(input.url).first<Row>():null;
 if(input.id&&!old)throw new Error('이 체험단을 찾을 수 없습니다.');

 let tasks:Task[]=old?JSON.parse(old.tasks):[];
 if(input.status==='당첨'&&!tasks.length)tasks=checklist(input.kind);
 if(input.status==='완료'&&tasks.some(t=>!t.done))throw new Error('할 일을 모두 체크한 후 완료로 변경해 주세요.');

 const now=new Date().toISOString();
 const row={id:old?.id||input.id||crypto.randomUUID(),title:input.title.trim(),platform:input.platform,url:input.url||'',
  kind:input.kind,status:input.status,due:input.due||'',notes:input.notes||'',tasks:JSON.stringify(tasks),
  created:old?.created||now};
 await db.prepare(`INSERT INTO campaigns (id,title,platform,url,kind,status,due,notes,tasks,source,created,updated)
   VALUES (?,?,?,?,?,?,?,?,?,'manual',?,?)
   ON CONFLICT(id) DO UPDATE SET title=excluded.title,platform=excluded.platform,url=excluded.url,kind=excluded.kind,
   status=excluded.status,due=excluded.due,notes=excluded.notes,tasks=excluded.tasks,updated=excluded.updated`)
  .bind(row.id,row.title,row.platform,row.url,row.kind,row.status,row.due,row.notes,row.tasks,row.created,now).run();
 return toCampaign(row as Row);
}

export async function toggle(db:D1Database,id:string,taskId:string,done:boolean):Promise<Campaign>{
 const r=await db.prepare('SELECT * FROM campaigns WHERE id=?').bind(id).first<Row>();
 if(!r)throw new Error('체험단을 찾을 수 없습니다.');
 const tasks:Task[]=JSON.parse(r.tasks);
 if(!tasks.some(t=>t.id===taskId))throw new Error('할 일을 찾을 수 없습니다.');
 const next=tasks.map(t=>t.id===taskId?{...t,done:!!done}:t);
 const status=r.status==='완료'&&!done?'당첨':r.status;
 await db.prepare('UPDATE campaigns SET tasks=?,status=?,updated=? WHERE id=?').bind(JSON.stringify(next),status,new Date().toISOString(),id).run();
 return toCampaign({...r,tasks:JSON.stringify(next),status});
}

export async function remove(db:D1Database,id:string){await db.prepare('DELETE FROM campaigns WHERE id=?').bind(id).run()}

export const memo={
 async get(db:D1Database,key:string){return (await db.prepare('SELECT value FROM store WHERE key=?').bind(key).first<{value:string}>())?.value||null},
 async set(db:D1Database,key:string,value:string){
  await db.prepare('INSERT INTO store (key,value,updated) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated')
   .bind(key,value,new Date().toISOString()).run();
 }};
