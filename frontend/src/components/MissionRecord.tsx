import {useEffect, useRef, useState} from 'react';
import {patchSession} from '../api';
import {useSession} from '../lib/session';
import {Observations} from './Observations';
import type {MissionId, Page, RouteKind, ObservationLocation, SessionStatus} from '../types';

type Props={missionId:MissionId;candidateId:string|null;page:Page;enabled:boolean;hasRoute:boolean;completed:boolean;progress:number;choice:RouteKind;location?:ObservationLocation};
/** One shared recording flow for terrain, ice and regional exploration. */
export function MissionRecord(p:Props){
 const [retry,setRetry]=useState(0);
 const {sessionId,error}=useSession(p.missionId,p.candidateId,p.enabled&&p.page!=='home',retry);
 const [saveError,setSaveError]=useState('');
 const queue=useRef(Promise.resolve());
 // While a walk is in progress, persist an incomplete snapshot. Closing the tab
 // must never leave an abandoned walk recorded as completed.
 const status:SessionStatus=p.hasRoute?(p.completed?'completed':'incomplete'):(p.page==='summary'?'science-only':'planning');
 const percent=Math.round(p.progress);
 useEffect(()=>{
  if(!sessionId||!p.enabled||(!p.hasRoute&&p.page!=="summary"))return;
  const patch={candidateId:p.candidateId,status,progressPercent:percent,selectedRoute:p.hasRoute?p.choice:null};
  let live=true;
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   try{await patchSession(sessionId,patch);if(live)setSaveError('');}
   catch{if(live)setSaveError('Session update could not be saved. Your current view is not yet recorded.');}
  });
  return()=>{live=false};
 },[sessionId,p.enabled,p.candidateId,status,percent,p.choice,p.hasRoute,p.page,retry]);
 if(p.page==='home'||p.page==='discover')return null;
 return <section className="shared-science-tools mission-record" aria-label="Session and recorded observations">
  <h2>{p.page==='summary'?'Recorded exploration':'Field observations'}</h2>
  <p>Session status: {status}. Notes are user-recorded, not confirmed discoveries. Planned science stops are separate.</p>
  {(error||saveError)&&<p role="alert">{saveError||error} <button className="btn btn-outline" onClick={()=>setRetry(v=>v+1)}>Retry save</button></p>}
  <Observations missionId={p.missionId} candidateId={p.candidateId} enabled={p.enabled} location={p.location}/>
 </section>;
}
