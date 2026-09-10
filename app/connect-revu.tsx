'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

type Result={ok:boolean;count:number;refreshed:boolean;message?:string;at?:string};

async function api(path:string,init?:RequestInit){
 const r=await fetch('/api/revu'+path,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json'}});
 const body=await r.json().catch(()=>null);
 if(!r.ok)throw new Error((body as {error?:string})?.error||'요청을 처리하지 못했어요.');
 return body;
}

export default function ConnectRevu({onClose,onDone}:{onClose:()=>void;onDone:()=>void}){
 const [state,setState]=useState<{connected:boolean;last:Result|null}>();
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result>();

 async function load(){try{setState(await api('/state') as {connected:boolean;last:Result|null})}catch{}}
 useEffect(()=>{void load()},[]);

 async function connect(){
  if(busy)return;setBusy(true);setError('');setResult(undefined);
  try{
   const r=await api('/connect',{method:'POST',body:JSON.stringify({token})}) as Result;
   setResult(r);
   if(r.ok){setToken('');onDone()}
   await load();
  }catch(e){setError(e instanceof Error?e.message:'연결에 실패했어요.')}
  finally{setBusy(false)}
 }

 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose()}}><DialogContent className="connect-29cm" showCloseButton={!busy}>
  <DialogTitle>레뷰 공고 가져오기</DialogTitle>
  <DialogDescription>{state?.connected?'연결돼 있어요. 20분마다 알아서 가져와요.':'토큰을 한 번 넣으면 공고를 함께 모아요.'}</DialogDescription>

  {state?.last&&<p className="connect-last">
   마지막 확인 {state.last.at?new Date(state.last.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—'} ·
   {state.last.ok?` 공고 ${state.last.count}건`:` ${state.last.message||'실패'}`}
  </p>}

  <details className="connect-steps" open={!state?.connected}>
   <summary>토큰 가져오는 방법 (PC 크롬)</summary>
   <ol>
    <li><b>revu.net</b>에 로그인한 상태로 공고 목록(제품·지역)을 열어요.</li>
    <li>우클릭 → <b>검사</b> → <b>Network</b> 탭을 열고 페이지를 새로고침해요.</li>
    <li>목록에서 <b>api.weble.net</b> 으로 가는 요청을 아무거나 클릭해요.</li>
    <li><b>Headers</b> → <b>Request Headers</b> 안의 <b>authorization</b> 줄 값을 복사해 아래에 붙여넣어요.</li>
   </ol>
   <p>레뷰 토큰은 오래 못 살아서 서버가 20분마다 새로 이어 붙여요. 그래도 끊기면 다시 넣어 주세요. <b>Bearer</b>는 붙여도 되고 빼도 돼요.</p>
  </details>

  <label className="connect-field">authorization
   <textarea className="connect-input" rows={4} value={token} onChange={e=>setToken(e.target.value)}
    placeholder="Bearer eyJ..." aria-label="레뷰 토큰" autoComplete="off" spellCheck={false}/></label>

  {error&&<p className="connect-error" role="alert">{error}</p>}
  {result&&<p className={result.ok?'connect-ok':'connect-error'} role="status">
   {result.ok?`레뷰 공고 ${result.count}건을 가져왔어요.`:result.message}</p>}

  <div className="connect-actions">
   <button className="primary" disabled={busy||token.trim().length<20} onClick={connect}>{busy?'확인 중…':'연결하기'}</button>
  </div>
 </DialogContent></Dialog>;
}
