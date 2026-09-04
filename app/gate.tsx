'use client';
import {useEffect,useState} from 'react';
import {LockKeyhole} from 'lucide-react';
import {session,signIn,migrateLocal} from './actions';

export default function Gate({children}:{children:React.ReactNode}){
 const [state,setState]=useState<'checking'|'locked'|'open'>('checking');
 const [passphrase,setPassphrase]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[moved,setMoved]=useState(0);

 async function open(){
  const result=await migrateLocal().catch(()=>null);
  if(result?.moved)setMoved(result.moved);
  setState('open');
 }
 useEffect(()=>{void session().then(ok=>ok?open():setState('locked'))},[]);

 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');
  try{await signIn(passphrase);setPassphrase('');await open()}
  catch(err){setError(err instanceof Error?err.message:'로그인하지 못했어요.')}
  finally{setBusy(false)}
 }

 if(state==='checking')return <div className="gate"><p>불러오는 중…</p></div>;
 if(state==='locked')return <div className="gate">
  <form className="gate-form" onSubmit={submit}>
   <LockKeyhole size={28}/>
   <h1>모아뷰</h1>
   <p>암구호를 입력하면 이 기기에서는 다시 묻지 않아요.</p>
   <input type="password" autoComplete="current-password" value={passphrase} onChange={e=>setPassphrase(e.target.value)} placeholder="암구호" aria-label="암구호" autoFocus/>
   {error&&<span className="gate-error" role="alert">{error}</span>}
   <button type="submit" disabled={busy||!passphrase}>{busy?'확인 중…':'들어가기'}</button>
  </form>
 </div>;
 return <>{moved>0&&<p className="gate-moved">이 기기에 남아 있던 기록 {moved}건을 옮겼어요.</p>}{children}</>;
}
