'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export const FIELDS=[['receiverName','수령인','이름',60],['receiverPhone','휴대폰 번호','010-0000-0000',13],
 ['receiverZipcode','우편번호','5자리',5],['receiverAddress','주소','도로명 주소',200],
 ['receiverDetailAddress','상세주소','동·호수 등',150],['etcMessage','배송 요청 사항','선택 입력',100]] as const;
export const OPTIONAL=['receiverDetailAddress','etcMessage'];
export const blankAddress=()=>Object.fromEntries(FIELDS.map(([k])=>[k,''])) as Record<string,string>;

export async function loadAddress(){
 try{
  const r=await fetch('/api/address',{credentials:'same-origin'});
  if(!r.ok)return null;
  const body=await r.json();
  return body&&typeof body==='object'?{...blankAddress(),...body} as Record<string,string>:null;
 }catch{return null}
}
export async function saveAddress(value:Record<string,string>){
 await fetch('/api/address',{method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
}

export function AddressFields({value,onChange}:{value:Record<string,string>;onChange:(v:Record<string,string>)=>void}){
 return <div className="apply-address">{FIELDS.map(([k,label,placeholder,max])=>
  <label key={k}>{label}
   <input required={!OPTIONAL.includes(k)} autoComplete="off" maxLength={max} placeholder={placeholder}
    value={value[k]||''} onChange={e=>onChange({...value,[k]:e.target.value})}/>
  </label>)}</div>;
}

export default function AddressBook({onClose}:{onClose:()=>void}){
 const [value,setValue]=useState<Record<string,string>>(blankAddress());
 const [busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[loading,setLoading]=useState(true);

 useEffect(()=>{void loadAddress().then(a=>{if(a)setValue(a);setLoading(false)})},[]);

 const missing=FIELDS.some(([k])=>!OPTIONAL.includes(k)&&!(value[k]||'').trim());

 async function save(){
  if(busy||missing)return;
  setBusy(true);
  try{await saveAddress(value);setSaved(true);setTimeout(onClose,700)}
  finally{setBusy(false)}
 }

 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose()}}><DialogContent className="direct-apply" showCloseButton={!busy}>
  <DialogTitle>배송지</DialogTitle>
  <DialogDescription>한 번 저장해두면 신청할 때 자동으로 채워져요.</DialogDescription>
  {loading?<p className="apply-message">불러오는 중…</p>:<>
   <AddressFields value={value} onChange={setValue}/>
   <p className="apply-note">배송형 체험단 신청에만 쓰여요. 이 값은 모아뷰 서버에 저장돼요.</p>
   <button className="primary" disabled={busy||missing} onClick={save}>{saved?'저장했어요':busy?'저장 중…':'저장하기'}</button>
  </>}
 </DialogContent></Dialog>;
}
