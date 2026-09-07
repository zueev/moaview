'use client';
import {useEffect,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

type Result={ok:boolean;status:number;refreshed:boolean;found:number;added:number;updated:number;message?:string;at?:string};
type State={connected:boolean;last:Result|null};

async function api(path:string,init?:RequestInit){
 const r=await fetch('/api/29cm'+path,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json'}});
 const body=await r.json().catch(()=>null);
 if(!r.ok)throw new Error((body as {error?:string})?.error||'요청을 처리하지 못했어요.');
 return body;
}

export default function Connect29CM({onClose,onDone}:{onClose:()=>void;onDone:()=>void}){
 const [state,setState]=useState<State>();
 const [cookie,setCookie]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result>();

 async function load(){try{setState(await api('/state') as State)}catch(e){setError(e instanceof Error?e.message:'상태를 읽지 못했어요.')}}
 useEffect(()=>{void load()},[]);

 async function run(path:string,body?:unknown){
  if(busy)return;setBusy(true);setError('');setResult(undefined);
  try{
   const r=await api(path,{method:'POST',body:JSON.stringify(body||{})}) as Result;
   setResult(r);
   if(r.ok){setCookie('');onDone()}
   await load();
  }catch(e){setError(e instanceof Error?e.message:'연결에 실패했어요.')}
  finally{setBusy(false)}
 }

 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onClose()}}><DialogContent className="connect-29cm" showCloseButton={!busy}>
  <DialogTitle>29CM 신청내역 자동으로 받기</DialogTitle>
  <DialogDescription>{state?.connected?'연결돼 있어요. 매시간 알아서 확인해요.':'한 번 연결해두면 신청한 공고가 저절로 들어와요.'}</DialogDescription>

  {state?.last&&<p className="connect-last">
   마지막 확인 {state.last.at?new Date(state.last.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—'} ·
   {state.last.ok?` 신청내역 ${state.last.found}건 · 새로 담은 것 ${state.last.added}건 · 당첨으로 바뀐 것 ${state.last.updated}건`:` ${state.last.message||'실패'}`}
  </p>}

  <details className="connect-steps" open={!state?.connected}>
   <summary>연결하는 방법 (PC 크롬에서 한 번만)</summary>
   <ol>
    <li>크롬에서 <b>29cm.co.kr</b>에 로그인한 상태로 접속해요.</li>
    <li><b>F12</b>를 눌러 개발자 도구를 열고 <b>Network</b> 탭으로 가요.</li>
    <li>페이지를 <b>새로고침</b>하면 요청 목록이 채워져요.</li>
    <li>아무 요청이나 클릭 → <b>Headers</b> → <b>Request Headers</b> 안의 <b>Cookie</b> 줄 값을 통째로 복사해요.</li>
    <li>아래에 붙여넣고 연결을 눌러요.</li>
   </ol>
   <p>이 값은 서버에만 저장되고 화면에 다시 보이지 않아요. 로그인이 갱신되면 서버가 알아서 새 값으로 바꿔 둬요.</p>
  </details>

  <textarea className="connect-input" rows={4} value={cookie} onChange={e=>setCookie(e.target.value)}
   placeholder="Cookie 값을 붙여넣으세요" aria-label="29CM Cookie 값" autoComplete="off" spellCheck={false}/>

  {error&&<p className="connect-error" role="alert">{error}</p>}
  {result&&<p className={result.ok?'connect-ok':'connect-error'} role="status">
   {result.ok?`신청내역 ${result.found}건을 읽었어요. 새로 담은 것 ${result.added}건, 당첨으로 바뀐 것 ${result.updated}건.`:result.message}
  </p>}

  <div className="connect-actions">
   <button className="primary" disabled={busy||cookie.trim().length<20} onClick={()=>run('/connect',{cookie:cookie.trim()})}>{busy?'확인 중…':'연결하기'}</button>
   {state?.connected&&<button className="outline" disabled={busy} onClick={()=>run('/sync')}>지금 가져오기</button>}
  </div>
 </DialogContent></Dialog>;
}
