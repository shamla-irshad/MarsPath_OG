import {useId} from 'react';
export default function PlaybackSpeed({value,onChange,disabled=false}:{value:number;onChange:(value:number)=>void;disabled?:boolean}){
 const id=useId();return <div className="playback-settings"><div className="playback-settings-title"><label htmlFor={id}>Playback speed</label><span>SIMULATION</span></div><select id={id} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))}>{[[1,'Real time'],[60,'Slow preview'],[240,'Standard preview'],[600,'Fast preview'],[1200,'Route overview']].map(([v,label])=><option key={v} value={v}>{label} · {v}×</option>)}</select><small>Accelerates the 22 m/min walking model.</small></div>
}
