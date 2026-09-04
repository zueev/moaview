import {valid,token,cookie,matches} from './auth';
import {list,save,toggle,remove,memo} from './records';
import {sync} from './twentynine';

type Env={DB:D1Database;ASSETS:Fetcher;MOAVIEW_PASSPHRASE:string;SESSION_SECRET:string};

const FEED='https://zueev.github.io/moaview/data/feed.json';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(message:string,status=400)=>json({error:message},status);

async function api(request:Request,env:Env,path:string):Promise<Response>{
 // 공고 목록은 로그인 없이도 보이게 둔다. 개인 기록만 잠근다.
 if(path==='/api/feed'){
  const r=await fetch(FEED,{cf:{cacheTtl:300,cacheEverything:true}});
  return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300'}});
 }
 if(path==='/api/login'&&request.method==='POST'){
  const body=await request.json().catch(()=>({})) as {passphrase?:unknown};
  if(!matches(body.passphrase,env.MOAVIEW_PASSPHRASE))return fail('암구호가 맞지 않아요.',401);
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
  const body=await request.json().catch(()=>({})) as {cookie?:unknown};
  if(typeof body.cookie!=='string'||body.cookie.length<20)return fail('29CM 연결 정보를 확인해 주세요.');
  return json(await sync(env.DB,body.cookie));
 }
 if(path==='/api/29cm/sync'&&request.method==='POST')return json(await sync(env.DB));
 if(path==='/api/29cm/shape')return json({shape:await memo.get(env.DB,'29cm:shape')});

 return fail('없는 주소입니다.',404);
}

export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/'))return api(request,env,path);
  return env.ASSETS.fetch(request);
 },
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){
  ctx.waitUntil(sync(env.DB).then(r=>console.log('29cm sync',JSON.stringify(r))));
 },
};
