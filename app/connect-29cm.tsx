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
 const [access,setAccess]=useState(''),[refresh,setRefresh]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result>();

 async function load(){try{setState(await api('/state') as State)}catch(e){setError(e instanceof Error?e.message:'상태를 읽지 못했어요.')}}
 useEffect(()=>{void load()},[]);

 async function run(path:string,body?:unknown){
  if(busy)return;setBusy(true);setError('');setResult(undefined);
  try{
   const r=await api(path,{method:'POST',body:JSON.stringify(body||{})}) as Result;
   setResult(r);
   if(r.ok){setAccess('');setRefresh('');onDone()}
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
    <li>페이지 빈 곳에 <b>우클릭 → 검사</b>를 눌러요. (F12가 안 되면 이렇게 열면 돼요)</li>
    <li>위쪽 탭에서 <b>Application</b>을 골라요. 안 보이면 <b>≫</b>를 눌러 찾으세요.</li>
    <li>왼쪽 목록에서 <b>Cookies → https://www.29cm.co.kr</b>을 눌러요.</li>
    <li>이름이 <b>access_token</b>인 줄을 찾아 <b>Value</b> 칸을 더블클릭하고 전체 복사해 아래에 붙여넣어요.</li>
    <li><b>refresh_token</b>도 같은 방법으로 복사해 두 번째 칸에 넣으면 연결이 오래 유지돼요.</li>
   </ol>
   <p>이 값은 서버에만 저장되고 화면에 다시 보이지 않아요. 로그인이 갱신되면 서버가 알아서 새 값으로 바꿔 둬요.</p>
   </details>

  <label className="connect-field">access_token
   <textarea className="connect-input" rows={3} value={access} onChange={e=>setAccess(e.target.value)}
    placeholder="access_token 값을 붙여넣으세요" aria-label="access_token" autoComplete="off" spellCheck={false}/></label>
  <label className="connect-field">refresh_token <span>(선택 · 넣으면 오래 유지돼요)</span>
   <textarea className="connect-input" rows={2} value={refresh} onChange={e=>setRefresh(e.target.value)}
    placeholder="refresh_token 값" aria-label="refresh_token" autoComplete="off" spellCheck={false}/></label>

  {error&&<p className="connect-error" role="alert">{error}</p>}
  {result&&<p className={result.ok?'connect-ok':'connect-error'} role="status">
   {result.ok?`신청내역 ${result.found}건을 읽었어요. 새로 담은 것 ${result.added}건, 당첨으로 바뀐 것 ${result.updated}건.`:result.message}
  </p>}

  <div className="connect-actions">
   <button className="primary" disabled={busy||access.trim().length<20} onClick={()=>run('/connect',{accessToken:access,refreshToken:refresh})}>{busy?'확인 중…':'연결하기'}</button>
   {state?.connected&&<button className="outline" disabled={busy} onClick={()=>run('/sync')}>지금 가져오기</button>}
  </div>
 </DialogContent></Dialog>;
}
