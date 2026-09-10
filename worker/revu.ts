import {memo} from './records';
import {classify} from '../lib/categories';
import type {DirectListing} from '../lib/direct-feed';

// 레뷰는 api.weble.net을 쓰고 Bearer 토큰만 받는다. 토큰은 앱 메모리에만 있어서
// 한 번 받아 두고, 실행할 때마다 갱신해 다음 실행까지 이어 붙인다.
const API='https://api.weble.net';
const KEY='revu:token';
const SEEN='revu:last';
const SEOUL=/^(서울|강남|강동|강북|강서|관악|광진|구로|금천|노원|도봉|동대문|동작|마포|서대문|서초|성동|성북|송파|양천|영등포|용산|은평|종로|중구|중랑)/;
const head=(token:string)=>({Accept:'application/json',Authorization:'Bearer '+token,
 Origin:'https://www.revu.net',Referer:'https://www.revu.net/','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0'});

type Row={item?:string;media?:string;byDeadline?:number;requestEndedOn?:string;reviewerLimit?:number;id?:number;
 thumbnail?:string;category?:string[];localTag?:string[];status?:string;active?:boolean;
 campaignStats?:{requestCount?:number}};

export type RevuResult={ok:boolean;count:number;refreshed:boolean;message?:string;at?:string};

async function renew(token:string){
 const r=await fetch(API+'/tokens/refresh',{method:'POST',headers:head(token)});
 if(!r.ok)return null;
 const body=await r.json().catch(()=>null) as {token?:string}|null;
 return typeof body?.token==='string'&&body.token?body.token:null;
}

async function page(token:string,n:number){
 const q=`limit=100&page=${n}&media%5B%5D=blog`;
 const r=await fetch(API+'/v1/campaigns?'+q,{headers:head(token)});
 if(!r.ok)throw Object.assign(new Error('레뷰 목록 '+r.status),{status:r.status});
 const body=await r.json() as {items?:Row[]};
 return body.items||[];
}

function toListing(x:Row):DirectListing|null{
 const id=Number(x.id);
 if(!Number.isFinite(id)||x.media!=='blog'||x.active===false)return null;
 const tags=x.category||[];
 const delivery=tags.includes('배송형');
 const visit=tags.includes('방문형');
 if(!delivery&&!visit)return null;
 const tag=(x.localTag||[])[0]||'';
 if(!delivery&&!SEOUL.test(tag))return null;                 // 방문형은 서울만 본다.
 const end=Date.parse(String(x.requestEndedOn||'')+'T23:59:59+09:00');
 if(!Number.isFinite(end)||end<=Date.now())return null;
 const title=String(x.item||'').trim();
 if(!title)return null;
 const benefit=tags.filter(t=>!/형$/.test(t)).join(' · ');
 const name=title.replace(/^\[[^\]]+\]\s*/,'')||title;
 return {id:'레뷰:'+id,platform:'레뷰',url:'https://www.revu.net/campaign/'+id,title,name,
  region:delivery?'전국 배송':(SEOUL.test(tag)?(tag.startsWith('서울')?tag:'서울 '+tag):tag),
  kind:delivery?'배송형':'방문형',channel:'블로그',
  benefit:benefit||'제공 내역은 원문에서 확인해 주세요.',
  conditions:'레뷰 공고입니다. 미션과 리뷰 조건은 원문에서 확인해 주세요.',
  deadline:'D-'+Math.max(0,Number(x.byDeadline)||Math.ceil((end-Date.now())/86400000)),
  endAt:new Date(end).toISOString(),
  applicants:typeof x.campaignStats?.requestCount==='number'?x.campaignStats.requestCount:null,
  recruits:typeof x.reviewerLimit==='number'?x.reviewerLimit:null,
  image:/^https:\/\//.test(String(x.thumbnail||''))?String(x.thumbnail):undefined,
  category:classify(title,benefit),categoryOrigin:'summary'};
}

export async function collect(db:D1Database,seed?:string):Promise<{items:DirectListing[];result:RevuResult}>{
 const none=(message:string,refreshed=false):{items:DirectListing[];result:RevuResult}=>
  ({items:[],result:{ok:false,count:0,refreshed,message}});
 let token=seed||await memo.get(db,KEY)||'';
 if(!token)return none('레뷰 연결 정보가 아직 없어요.');

 // 토큰은 짧게 살아서, 쓰기 전에 갱신해 다음 실행 몫까지 확보한다.
 const fresh=await renew(token);
 const refreshed=!!fresh;
 if(fresh){token=fresh;await memo.set(db,KEY,token)}

 try{
  const rows=(await Promise.all([1,2].map(n=>page(token,n)))).flat();
  const items=[...new Map(rows.map(toListing).filter((r):r is DirectListing=>!!r).map(r=>[r.url,r])).values()];
  if(!refreshed)await memo.set(db,KEY,token);
  const result:RevuResult={ok:true,count:items.length,refreshed,at:new Date().toISOString()};
  await memo.set(db,SEEN,JSON.stringify(result));
  return {items,result};
 }catch(e){
  const status=(e as {status?:number}).status;
  const result:RevuResult={ok:false,count:0,refreshed,at:new Date().toISOString(),
   message:status===401||status===403?'레뷰 토큰이 만료됐어요. 다시 연결해 주세요.':'레뷰 공고를 불러오지 못했어요.'};
  await memo.set(db,SEEN,JSON.stringify(result));
  return {items:[],result};
 }
}

export async function state(db:D1Database){
 return {connected:!!await memo.get(db,KEY),last:JSON.parse(await memo.get(db,SEEN)||'null')};
}
