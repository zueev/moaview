import {Campaign,Task,statuses,platforms} from '@/lib/model';
const KEY='moaview.campaigns.v1';
export async function listCampaigns():Promise<Campaign[]>{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):[];}
function store(rows:Campaign[]){localStorage.setItem(KEY,JSON.stringify(rows));}
export async function saveCampaign(input:Campaign):Promise<void>{
if(!input.title?.trim()||input.title.length>150)throw new Error('체험단 이름을 150자 이내로 입력해 주세요.');
if(!statuses.includes(input.status)||!platforms.includes(input.platform)||!['배송형','방문형','기타'].includes(input.kind))throw new Error('입력 항목을 다시 확인해 주세요.');
if(input.url){let u;try{u=new URL(input.url)}catch{throw new Error('올바른 공고 링크를 입력해 주세요.')}if(!['http:','https:'].includes(u.protocol)||input.url.length>2000)throw new Error('http 또는 https 링크만 저장할 수 있습니다.');}
if(input.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.due)||isNaN(Date.parse(input.due))))throw new Error('마감일을 확인해 주세요.');
if(input.notes.length>5000)throw new Error('메모는 5,000자 이내로 입력해 주세요.');

const rows=await listCampaigns();
const old=input.id?rows.find(r=>r.id===input.id):input.url?rows.find(r=>r.url===input.url):undefined;
if(input.id&&!old)throw new Error('이 체험단을 찾을 수 없습니다.');
let tasks:Task[]=old?.tasks||[];
if(input.status==='당첨'&&!tasks.length)tasks=[{id:crypto.randomUUID(),title:input.kind==='방문형'?'방문 일정 예약하기':'제품 수령 확인하기',done:false},{id:crypto.randomUUID(),title:'사진 촬영과 체험 기록하기',done:false},{id:crypto.randomUUID(),title:'필수 문구·키워드 확인 후 리뷰 작성하기',done:false},{id:crypto.randomUUID(),title:'원본 사이트에 리뷰 링크 제출하기',done:false}];
if(input.status==='완료'&&tasks.some(t=>!t.done))throw new Error('할 일을 모두 체크한 후 완료로 변경해 주세요.');

const next={...input,title:input.title.trim(),id:old?.id||crypto.randomUUID(),tasks,created:old?.created||new Date().toISOString()};
store([next,...rows.filter(r=>r.id!==next.id)]);
}
export async function toggleTask(id:string,taskId:string,done:boolean){
const rows=await listCampaigns();const r=rows.find(r=>r.id===id);
if(!r||!r.tasks.some(t=>t.id===taskId))throw new Error('할 일을 찾을 수 없습니다.');
r.tasks=r.tasks.map(t=>t.id===taskId?{...t,done:!!done}:t);
if(r.status==='완료'&&!done)r.status='당첨';store(rows);
}
