import {classify} from './categories';
import type {DirectListing} from './direct-feed';

// 29CM's own preuser list endpoint. Public, no authentication, newest first.
// The list mixes closed events in after the open ones, so we drop anything past its deadline.
type Event={preuserEventKey?:unknown;itemName?:unknown;recruitEndAt?:unknown;applicantCount?:unknown;totalWinnerLimit?:unknown;imageUrl?:unknown;frontBrandNameKor?:unknown;frontBrandNameEng?:unknown};

export function twentynine(body:string):DirectListing[]{
 let list:unknown;
 try{list=JSON.parse(body)?.data?.list}catch{throw Error('29CM 목록 형식 확인 필요')}
 if(!Array.isArray(list))throw Error('29CM 목록 형식 확인 필요');
 return (list as Event[]).flatMap(x=>{
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
