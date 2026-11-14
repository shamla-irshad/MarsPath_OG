import DiscoveryReport from './DiscoveryReport';
import {useState} from 'react';
import type {MissionId} from './types';
const guides={
 'rover-navigation-jezero':{question:'How does terrain shape an exploration journey?',tasks:['Compare elevation and slope before choosing a destination.','Inspect a candidate zone and its representative route point.','Record terrain observations separately from model predictions.']},
 'water-ice-arcadia':{question:'Where does the supplied evidence support further ice investigation?',tasks:['Compare SWIM consistency at both depth intervals.','Review candidate boundaries and source evidence.','Record a research question; an indicator does not confirm an ice deposit.']},
 'past-life-jezero':{question:'Which environments could preserve evidence of ancient habitability?',tasks:['Review documented rock samples and geological context.','Check coordinate verification before planning a journey.','Record what the evidence suggests and what remains uncertain.']}
};
export default function ExplorationNotes({missionId,target}:{missionId:MissionId;target:string}){
 const key=`marspath-notes-v1:${missionId}:${target}`;
 const [note,setNote]=useState(()=>{try{return localStorage.getItem(key)||''}catch{return ''}}),[status,setStatus]=useState('');
 const guide=guides[missionId];
 function save(){try{localStorage.setItem(key,note);setStatus('Saved on this browser.')}catch{setStatus('Browser storage unavailable. Download your notes instead.')}}
 function download(){const blob=new Blob([JSON.stringify({missionId,target,question:guide.question,note,recordType:'User research notes; not verified field measurements'},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='marspath-exploration-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <><DiscoveryReport key={key} missionId={missionId} target={target}/><details className="exploration-notes"><summary>Research brief & private drafts</summary><h3>{guide.question}</h3><ol>{guide.tasks.map(t=><li key={t}>{t}</li>)}</ol><label>My research questions and draft notes<textarea rows={4} value={note} onChange={e=>{setNote(e.target.value);setStatus('Unsaved changes')}} placeholder="What does the supplied evidence show? What would you investigate next?"/></label><div className="regional-controls"><button onClick={save}>Save notes</button><button onClick={download}>Download notes</button></div><p role="status">{status}</p><small>Personal notes for {target}. Stored only on this browser; download a copy to share or keep.</small></details></>
}
