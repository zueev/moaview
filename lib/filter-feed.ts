import {categoryOptions} from './categories';
import type {DirectListing,SourceState} from './direct-feed';
export function filterFeed(data:{at:number;items:DirectListing[];sources:SourceState[]},q:URLSearchParams){
data={...data,items:data.items.filter(r=>!r.endAt||Date.parse(r.endAt)>Date.now()).map(r=>r.endAt?{...r,deadline:'D-'+Math.max(0,Math.ceil((Date.parse(r.endAt)-Date.now())/86400000))}:r)};
 const kind=q.get('kind')||'delivery',category=q.get('category')||'style',source=q.get('source')||'',search=(q.get('search')||'').slice(0,100).toLowerCase();
 if(!['all','delivery','visit'].includes(kind)||!categoryOptions.some(([id])=>id===category))throw new Error('필터를 확인해 주세요.');
 const base=data.items.filter(r=>(kind==='all'||r.kind===(kind==='delivery'?'배송형':'방문형'))&&(!source||r.platform===source)&&`${r.title} ${r.benefit} ${r.region}`.toLowerCase().includes(search));
 const matches=(c:string,r:typeof base[number])=>c==='all'||(c==='style'?['beauty','fashion'].includes(r.category):r.category===c);
 const counts=Object.fromEntries(categoryOptions.map(([c])=>[c,base.filter(r=>matches(c,r)).length]));
 const items=base.filter(r=>matches(category,r));
 const deadline=(r:typeof base[number])=>r.endAt?Date.parse(r.endAt):Date.now()+(Number(r.deadline.match(/\d+/)?.[0])||0)*86400000;
 items.sort((a,b)=>q.get('sort')==='competition'?((a.applicants??Infinity)/(a.recruits||1)-(b.applicants??Infinity)/(b.recruits||1)):deadline(a)-deadline(b));
 return {items,total:items.length,counts,sources:data.sources,updatedAt:new Date(data.at).toISOString()};
}
