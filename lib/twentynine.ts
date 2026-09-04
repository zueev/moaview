import {classify} from './categories';
import type {DirectListing} from './direct-feed';

// Read the public page's serialized data, without executing scripts.
export function twentynine(html:string):DirectListing[]{
 const flight=[...html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)].map(m=>{try{return JSON.parse(m[1])[1]||''}catch{return ''}}).join('');
 let events:Record<string,unknown>[]|undefined;
 function visit(value:unknown):void{
  if(!value||typeof value!=='object')return;
  const node=value as Record<string,any>;
  if(node.eventList?.success&&Array.isArray(node.eventList.data?.list))events=node.eventList.data.list;
  for(const child of Object.values(node))visit(child);
 }
 for(const line of flight.split('\n')){try{visit(JSON.parse(line.slice(line.indexOf(':')+1)))}catch{}}
 if(!events)throw Error('29CM 목록 형식 확인 필요');
 return events.flatMap(x=>{
  const endAt=String(x.recruitEndAt||''),end=Date.parse(endAt);
  if(!Number.isFinite(end)||end<=Date.now()||typeof x.itemName!=='string'||!/^PE_[A-Za-z0-9]+$/.test(String(x.preuserEventKey)))return [];
  const url='https://www.29cm.co.kr/preuser/event/'+x.preuserEventKey;
  const name=x.itemName,brand=String(x.frontBrandNameKor||x.frontBrandNameEng||'');
  const date=new Date(end).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'});
  return [{id:'29CM:'+url,platform:'29CM',url,title:brand+' '+name,name,
   region:'전국 배송',kind:'배송형' as const,channel:'29CM 체험단',
   benefit:brand+' · 상품 체험 후 사용 경험 공유',
   conditions:'29CM 체험단 공고입니다. 응모 방법과 후기 작성 조건은 원문에서 확인해 주세요. 블로그 전용 공고는 아닙니다.',
   endAt,deadline:date+' 마감',applicants:typeof x.applicantCount==='number'?x.applicantCount:null,
   recruits:typeof x.totalWinnerLimit==='number'?x.totalWinnerLimit:null,
   image:typeof x.imageUrl==='string'&&x.imageUrl.startsWith('/')&&!x.imageUrl.startsWith('//')?new URL(x.imageUrl,'https://img.29cm.co.kr').href:undefined,
   category:classify(name,''),categoryOrigin:'summary' as const}];
 });
}
