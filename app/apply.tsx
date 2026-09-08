'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Checkbox} from '@/components/ui/checkbox';
import type {Listing} from '@/lib/feed-parser';

type Option={id:number;name:string};
type Detail={eventKey:string;name:string;brand:string;partner:string;endAt:string;reviewEndAt:string;applied:boolean;optionRequired:boolean;options:Option[]};

const FIELDS=[['receiverName','수령인','이름',60],['receiverPhone','휴대폰 번호','010-0000-0000',13],
 ['receiverZipcode','우편번호','5자리',5],['receiverAddress','주소','도로명 주소',200],
 ['receiverDetailAddress','상세주소','동·호수 등',150],['etcMessage','배송 요청 사항','선택 입력',100]] as const;
const OPTIONAL=['receiverDetailAddress','etcMessage'];
const blank=Object.fromEntries(FIELDS.map(([k])=>[k,'']));
const day=(v:string)=>v?new Date(v).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}):'—';

export default function Apply29CM({listing,onClose,onDone}:{listing:Listing;onClose:()=>void;onDone:()=>void}){
 const key=new URL(listing.url).pathname.split('/').pop()||'';
 const [detail,setDetail]=useState<Detail>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState('');
 const [option,setOption]=useState(''),[address,setAddress]=useState<Record<string,string>>(blank);
 const [agree,setAgree]=useState([false,false,false,false]),[confirmed,setConfirmed]=useState(false);

 useEffect(()=>{void (async()=>{
  try{
   const r=await fetch('/api/29cm/event/'+key,{credentials:'same-origin'});
   const body=await r.json();
   if(!r.ok)throw new Error(body?.error||'공고를 불러오지 못했어요.');
   setDetail(body);
  }catch(e){setError(e instanceof Error?e.message:'공고를 불러오지 못했어요.')}
 })()},[key]);

 const missing=FIELDS.some(([k])=>!OPTIONAL.includes(k)&&!address[k].trim());
 const ready=!!detail&&!busy&&confirmed&&agree.every(Boolean)&&!missing&&(!detail.optionRequired||!!option);

 async function submit(e:React.FormEvent){
  e.preventDefault();if(!ready)return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/29cm/apply',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({eventKey:key,optionId:option,address,agreements:agree,confirmed:true})});
   const body=await r.json();
   if(!r.ok)throw new Error(body?.error||'신청하지 못했어요.');
   setSent(body.name||listing.name);
   onDone();
  }catch(e){setError(e instanceof Error?e.message:'신청하지 못했어요.')}
  finally{setBusy(false)}
 }

 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose()}}><DialogContent className="direct-apply" showCloseButton={!busy}>
  <DialogTitle>29CM 체험단 신청</DialogTitle>
  <DialogDescription>{listing.name||listing.title}</DialogDescription>

  {sent?<div className="apply-success">
   <p>29CM에 신청을 보냈어요. 내 신청함에도 기록했어요.</p>
   <button className="primary" onClick={onClose}>확인</button>
  </div>:!detail?<p className="apply-message" role="status">{error||'공고를 확인하고 있어요.'}</p>:
  <form className="apply-form" onSubmit={submit}>
   <p className="apply-caption">{detail.brand} · 모집 마감 {day(detail.endAt)} · 리뷰 마감 {day(detail.reviewEndAt)}</p>

   {detail.optionRequired&&<label>상품 옵션
    <Select value={option} onValueChange={v=>setOption(v||'')}>
     <SelectTrigger aria-label="상품 옵션"><SelectValue placeholder="옵션을 선택하세요"/></SelectTrigger>
     <SelectContent>{detail.options.map(o=><SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent>
    </Select></label>}

   <div className="apply-address">{FIELDS.map(([k,label,placeholder,max])=>
    <label key={k}>{label}
     <input required={!OPTIONAL.includes(k)} autoComplete="off" maxLength={max} placeholder={placeholder}
      value={address[k]} onChange={e=>setAddress({...address,[k]:e.target.value})}/>
    </label>)}</div>
   <p className="apply-note">배송지는 저장하지 않아요. 신청할 때마다 넣어 주세요.</p>

   <div className="apply-terms">
    <a href={listing.url} target="_blank" rel="noopener noreferrer">29CM 원문 유의사항·약관 확인 ↗</a>
    <p>신청 후에는 배송지·옵션 변경과 취소가 되지 않아요. 도서산간은 추가 배송비가 생길 수 있어요.</p>
    {['개인정보 수집·이용 동의',`개인정보 제3자 제공 동의${detail.partner?' ('+detail.partner+')':''}`,
      '이벤트 당첨자 패널티 정책 동의','이벤트 당첨 시 ‘0원 자동 결제’ 동의'].map((label,i)=>
     <label className="apply-check" key={i}>
      <Checkbox checked={agree[i]} onCheckedChange={v=>setAgree(agree.map((a,n)=>n===i?v===true:a))}/>
      <span>(필수) {label}</span></label>)}
    <label className="apply-check apply-confirm">
     <Checkbox checked={confirmed} onCheckedChange={v=>setConfirmed(v===true)}/>
     <span>위 상품·옵션·배송지를 확인했고, 이 내용으로 29CM에 신청합니다.</span></label>
   </div>

   {error&&<p className="connect-error" role="alert">{error}</p>}
   <button className="primary" type="submit" disabled={!ready}>{busy?'보내는 중… 기다려 주세요':'확인한 내용으로 신청하기'}</button>
  </form>}
 </DialogContent></Dialog>;
}
