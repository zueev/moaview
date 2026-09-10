import {valid,token,cookie,matches} from './auth';
import {list,save,toggle,remove} from './records';
import {attempts,record,clear} from './throttle';
import {sync,state,call} from './twentynine';
import {body as applyBody,summary,open as openForApply} from './apply';
import {directFeed} from '../lib/direct-feed';
import {collect as revuCollect,state as revuState,applications as revuApplications} from './revu';
import {memo} from './records';

type Env={DB:D1Database;ASSETS:Fetcher;MOAVIEW_PASSPHRASE:string;SESSION_SECRET:string};

const FEED='https://zueev.github.io/moaview/data/feed.json';
const FRESH=5400000; // 이보다 오래된 사본은 GitHub 쪽을 대신 쓴다.

// 공고 수집을 여기서 직접 돌린다. GitHub 예약 실행은 몇 시간씩 밀린다.
async function collect(db:D1Database){
 const data=await directFeed();
 if(!data.items.length)throw new Error('수집 결과가 비어 있어요.');
 // 여기서 막히는 사이트가 있어 GitHub 쪽 사본으로 그 자리만 메운다.
 let filled=0;
 try{
  const backup=await fetch(FEED,{cf:{cacheTtl:300,cacheEverything:true}}).then(r=>r.json()) as typeof data;
  const theirs=new Map(backup.sources.map(s=>[s.name,s]));
  const urls=new Set(data.items.map(r=>r.url));
  for(const source of data.sources){
   const other=theirs.get(source.name);
   if(source.status==='ok'||!other||other.status!=='ok')continue;
   const items=backup.items.filter(r=>r.platform===source.name&&!urls.has(r.url));
   items.forEach(r=>urls.add(r.url));
   data.items.push(...items);
   Object.assign(source,{status:'ok' as const,count:items.length,scope:other.scope+' · 조금 이전 수집분'});
   filled++;
  }
 }catch{}
 // 레뷰는 토큰이 필요해 여기(D1이 있는 쪽)에서 따로 가져와 합친다.
 const revu=await revuCollect(db);
 if(revu.items.length){
  const urls=new Set(data.items.map(r=>r.url));
  data.items.push(...revu.items.filter(r=>!urls.has(r.url)));
 }
 if(revu.result.ok||revu.result.message!=='레뷰 연결 정보가 아직 없어요.')
  data.sources.push({name:'레뷰',url:'https://www.revu.net/',status:revu.result.ok?'ok':'error',
   count:revu.items.length,scope:revu.result.ok?'블로그 공고 최근 200건':(revu.result.message||'현재 불러오지 못함')});
 await memo.set(db,'feed',JSON.stringify(data));
 return {items:data.items.length,sources:data.sources.filter(s=>s.status==='ok').length,filled,레뷰:revu.result};
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(message:string,status=400)=>json({error:message},status);

async function api(request:Request,env:Env,path:string):Promise<Response>{
 // 공고 목록은 로그인 없이도 보이게 둔다. 개인 기록만 잠근다.
 if(path==='/api/feed'){
  const own=await memo.get(env.DB,'feed');
  if(own){try{const data=JSON.parse(own);if(Date.now()-data.at<FRESH)return json(data)}catch{}}
  const r=await fetch(FEED,{cf:{cacheTtl:300,cacheEverything:true}});
  return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'}});
 }
 if(path==='/api/login'&&request.method==='POST'){
  if(!env.MOAVIEW_PASSPHRASE)return fail('아직 암구호가 설정되지 않았어요.',503);
  const who='login:'+(request.headers.get('CF-Connecting-IP')||'unknown');
  const tries=await attempts(env.DB,who);
  if(tries>=8)return fail('시도가 너무 많아요. 10분 후에 다시 해주세요.',429);
  const body=await request.json().catch(()=>({})) as {passphrase?:unknown};
  if(!matches(body.passphrase,env.MOAVIEW_PASSPHRASE)){await record(env.DB,who,tries+1);return fail('암구호가 맞지 않아요.',401)}
  await clear(env.DB,who);
  return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':cookie(await token(env.SESSION_SECRET))}});
 }

 if(!await valid(request,env.SESSION_SECRET))return fail('로그인이 필요합니다.',401);

 if(path==='/api/session')return json({ok:true});
 if(path==='/api/campaigns'){
  if(request.method==='GET')return json(await list(env.DB));
  if(request.method==='POST'){
   try{return json(await save(env.DB,await request.json() as never))}catch(e){return fail((e as Error).message)}
  }
 }
 const task=path.match(/^\/api\/campaigns\/([\w-]+)\/task$/);
 if(task&&request.method==='POST'){
  const body=await request.json().catch(()=>({})) as {taskId?:string;done?:boolean};
  try{return json(await toggle(env.DB,task[1],String(body.taskId),!!body.done))}catch(e){return fail((e as Error).message)}
 }
 const one=path.match(/^\/api\/campaigns\/([\w-]+)$/);
 if(one&&request.method==='DELETE'){await remove(env.DB,one[1]);return json({ok:true})}

 // 브라우저에 남아 있던 기록을 한 번에 옮기기 위한 통로.
 if(path==='/api/import'&&request.method==='POST'){
  const rows=await request.json().catch(()=>[]) as never[];
  if(!Array.isArray(rows))return fail('가져올 기록을 확인해 주세요.');
  let moved=0;for(const row of rows.slice(0,500)){try{await save(env.DB,row);moved++}catch{}}
  return json({moved,total:rows.length});
 }

 if(path==='/api/29cm/connect'&&request.method==='POST'){
  const body=await request.json().catch(()=>({})) as {cookie?:unknown;accessToken?:unknown;refreshToken?:unknown;deviceId?:unknown};
  const pairs:string[]=[];
  if(typeof body.cookie==='string'&&body.cookie.includes('='))pairs.push(body.cookie.trim());
  const add=(name:string,value:unknown)=>{if(typeof value==='string'&&value.trim())pairs.push(name+'='+value.trim())};
  add('access_token',body.accessToken);add('refresh_token',body.refreshToken);add('x-device-id',body.deviceId);
  if(!pairs.some(p=>p.startsWith('refresh_token=')))return fail('refresh_token이 있어야 연결이 유지돼요.');
  if(!pairs.some(p=>p.startsWith('x-device-id=')))return fail('x-device-id 값도 함께 넣어 주세요.');
  const cookie=pairs.join('; ');
  if(cookie.length<20)return fail('29CM 연결 정보를 확인해 주세요.');
  return json(await sync(env.DB,cookie));
 }
 if(path==='/api/29cm/sync'&&request.method==='POST')return json(await sync(env.DB));
 if(path==='/api/collect'&&request.method==='POST'){
  try{return json(await collect(env.DB))}catch(e){return fail((e as Error).message.slice(0,200),502)}
 }
 if(path==='/api/29cm/state')return json(await state(env.DB));

 if(path==='/api/revu/state')return json(await revuState(env.DB));
 if(path==='/api/revu/sync'&&request.method==='POST')return json(await revuApplications(env.DB));
 if(path==='/api/revu/connect'&&request.method==='POST'){
  const asked=await request.json().catch(()=>({})) as {token?:unknown};
  const raw=typeof asked.token==='string'?asked.token.trim().replace(/^Bearer\s+/i,''):'';
  if(raw.length<20)return fail('레뷰 토큰을 확인해 주세요.');
  const tried=await revuCollect(env.DB,raw);
  return json(tried.result);
 }

 // 배송지는 저장해두지 않는다. 신청할 때마다 화면에서 직접 넣는다.
 const event=path.match(/^\/api\/29cm\/event\/(PE_[A-Za-z0-9]+)$/);
 if(event&&request.method==='GET'){
  try{
   const r=await call(env.DB,'/'+event[1]);
   if(r.status!==200||!r.json?.data)return fail('29CM 공고를 확인하지 못했어요.',502);
   return json(summary(r.json.data));
  }catch(e){return fail((e as Error).message,502)}
 }

 if(path==='/api/29cm/apply'&&request.method==='POST'){
  const asked=await request.json().catch(()=>null) as any;
  if(!asked||!/^PE_[A-Za-z0-9]+$/.test(String(asked.eventKey||'')))return fail('공고를 확인해 주세요.');
  const url='https://www.29cm.co.kr/preuser/event/'+asked.eventKey;
  const already=await env.DB.prepare('SELECT status FROM campaigns WHERE url=?').bind(url).first<{status:string}>();
  if(already&&already.status!=='관심')return fail('이미 신청한 공고예요.',409);
  try{
   const detail=await call(env.DB,'/'+asked.eventKey);
   if(detail.status!==200||!detail.json?.data)return fail('29CM 공고를 확인하지 못했어요.',502);
   const d=detail.json.data;
   if(d.isUserApplied)return fail('29CM에 이미 신청돼 있어요.',409);
   openForApply(d);
   const sent=await call(env.DB,'/'+asked.eventKey+'/apply','POST',applyBody(asked,d));
   if(sent.status===200&&sent.json?.meta?.result==='SUCCESS'&&sent.json.data?.preuserEventApplicantKey){
    await sync(env.DB);
    return json({ok:true,name:String(d.itemName||'')});
   }
   if(sent.status>=400&&sent.status<500&&sent.json?.meta?.result==='FAIL')
    return fail(String(sent.json.meta.message||'29CM에서 신청을 거절했어요.').slice(0,300),422);
   return fail('전송 결과를 확인하지 못했어요. 다시 보내지 말고 29CM 신청내역을 확인해 주세요.',502);
  }catch(e){return fail((e as Error).message,400)}
 }

 return fail('없는 주소입니다.',404);
}

export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/'))return api(request,env,path);
  return env.ASSETS.fetch(request);
 },
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){
  ctx.waitUntil(collect(env.DB).then(r=>console.log('collect',JSON.stringify(r)),e=>console.log('collect failed',String(e))));
  ctx.waitUntil(sync(env.DB).then(r=>console.log('29cm sync',JSON.stringify(r)),e=>console.log('sync failed',String(e))));
  ctx.waitUntil(revuApplications(env.DB).then(r=>console.log('revu apps',JSON.stringify(r)),e=>console.log('revu apps failed',String(e))));
 },
};
