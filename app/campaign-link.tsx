'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';

export default function CampaignLink({url,platform}:{url:string;platform:string}){
 const [mobile,setMobile]=useState(false),[attempted,setAttempted]=useState(false);
 useEffect(()=>{setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Macintosh/.test(navigator.userAgent)))},[]);
 // The scheme is used by 29CM's own campaign navigation. Keep the full event URL.
 const appLink=mobile&&platform==='29CM'&&/^https:\/\/www\.29cm\.co\.kr\/preuser\/event\/PE_[A-Za-z0-9]+$/.test(url);
 return <div className="campaign-destination"><a href={appLink?'app29cm://web/'+url:url} target={appLink?undefined:'_blank'} rel="noopener noreferrer" onClick={()=>{if(appLink)setAttempted(true)}}>{appLink?'29CM 앱에서 신청':platform+'에서 신청'} <ArrowUpRight size={16}/></a>{appLink&&<a className="campaign-web-fallback" href={url} target="_blank" rel="noopener noreferrer">{attempted?'앱이 안 열렸나요? 웹에서 신청':'웹으로 열기'}</a>}</div>
}
