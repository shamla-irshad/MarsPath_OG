import {useEffect, useId, useState} from 'react';
import type {Point, Route} from './types';
import {formatNumber} from './api';

export type Samples = {elevation:(number|null)[][]; slope:(number|null)[][]};
let pending: Promise<Samples> | null = null;

export function useTerrain() {
  const [data,setData] = useState<Samples|null>(null);
  const [error,setError] = useState('');
  useEffect(() => {
    let live=true;
    if (!pending) pending=fetch('/data/terrain/samples.json')
      .then(r=>{if(!r.ok) throw Error('Terrain data unavailable');return r.json()})
      .catch(e=>{pending=null;throw e});
    pending.then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(String(e))});
    return()=>{live=false};
  },[]);
  return {data,error};
}

export function sample(data:Samples|null,p:Point|null|undefined,key:'elevation'|'slope') {
  if(!data||!p)return null;
  const value=data[key][Math.round(p.row)]?.[Math.round(p.col)];
  return typeof value==='number' && Number.isFinite(value)?value:null;
}

export function TerrainReadout({point}:{point:Point|null}) {
  const {data,error}=useTerrain();
  const e=sample(data,point,'elevation'),s=sample(data,point,'slope');
  return <div className="terrain-readout">
    <strong>Terrain at position</strong>
    <span>{error?'Terrain data unavailable':!data?'Loading terrain…':!point?'Select a position':`Elevation: ${e===null?'unavailable':formatNumber(e)+' m'} · Slope: ${s===null?'unavailable':formatNumber(s)+'°'}`}</span>
    <small>Supplied 1 m rasters sampled at the nearest navigation cell centre. NoData and outside coverage remain unavailable.</small>
  </div>;
}

type ProfilePoint={distance:number;e:number|null;s:number|null};
const L=72, R=704, T=31, B=198;

function createPaths(points:ProfilePoint[], key:'e'|'s', total:number, lo:number, hi:number) {
  const x=(d:number)=>L+d/Math.max(1,total)*(R-L);
  const y=(v:number)=>B-(v-lo)/Math.max(1,hi-lo)*(B-T);
  const segments:{x:number;y:number}[][]=[];
  let current:{x:number;y:number}[]=[];
  for (const p of points) {
    const value=p[key];
    if(value===null) {if(current.length) segments.push(current);current=[];continue;}
    current.push({x:x(p.distance),y:y(value)});
  }
  if(current.length)segments.push(current);
  const line=segments.map(seg=>seg.map((v,i)=>`${i===0?'M':'L'}${v.x.toFixed(2)} ${v.y.toFixed(2)}`).join(' ')).join(' ');
  const areas=segments.filter(seg=>seg.length>1).map(seg=>{
    const first=seg[0],last=seg[seg.length-1];
    return `${seg.map((v,i)=>`${i===0?'M':'L'}${v.x.toFixed(2)} ${v.y.toFixed(2)}`).join(' ')} L${last.x.toFixed(2)} ${B} L${first.x.toFixed(2)} ${B} Z`;
  });
  return {line,areas,x,y};
}

export function TerrainProfile({route}:{route:Route}) {
  const {data,error}=useTerrain();
  const [mode,setMode]=useState<'e'|'s'>('e');
  const [selected,setSelected]=useState(0);
  const gradientId=useId().replace(/:/g,'');
  if(!data)return <p>{error||'Loading route terrain profile…'}</p>;
  let distance=0;
  const points:ProfilePoint[]=route.geometry.map((p,i)=>{
    if(i)distance+=Math.hypot(p.row-route.geometry[i-1].row,p.col-route.geometry[i-1].col)*5;
    return {distance,e:sample(data,p,'elevation'),s:sample(data,p,'slope')};
  });
  const selectedPoints=points.map(p=>p[mode]).filter((v):v is number=>v!==null);
  const elevationValues=points.map(p=>p.e).filter((v):v is number=>v!==null);
  if(!elevationValues.length)return <p>Route elevation is outside available coverage.</p>;
  const slopeValues=points.map(p=>p.s).filter((v):v is number=>v!==null);
  const lo=mode==='s'?0:Math.min(...selectedPoints);
  const maxRaw=selectedPoints.length?Math.max(...selectedPoints):1;
  const hi=Math.max(lo+0.1,maxRaw);
  const {line,areas,x,y}=createPaths(points,mode,distance,lo,hi);
  const focus=points[Math.min(selected,points.length-1)]||points[0];
  const focusValue=focus?.[mode];
  const unit=mode==='e'?'m':'°';
  const maxSlope=slopeValues.length?Math.max(...slopeValues):null;

  return <details className="planning-panel terrain-profile" open>
    <summary>Terrain profile · sampled along the planned route</summary>
    <div className="profile-heading">
      <div>
        <span className="profile-eyebrow">GEOREFERENCED TERRAIN PROFILE</span>
        <h3>{mode==='e'?'Elevation along the route':'Slope along the route'}</h3>
      </div>
      <div className="profile-tabs" role="group" aria-label="Terrain data view">
        <button type="button" className={mode==='e'?'active':''} aria-pressed={mode==='e'} onClick={()=>setMode('e')}>Elevation</button>
        <button type="button" className={mode==='s'?'active':''} aria-pressed={mode==='s'} onClick={()=>setMode('s')}>Slope</button>
      </div>
    </div>
    {!selectedPoints.length?<p>No valid {mode==='e'?'elevation':'slope'} samples along this route.</p>:
      <div className="profile-chart-shell">
        <svg className="profile-svg" viewBox="0 0 760 250" role="img" aria-label={`${mode==='e'?'Elevation in metres':'Slope in degrees'} plotted against distance along the planned route in metres`}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={mode==='e'?'#c7baa2':'#a6c9bf'} stopOpacity=".42"/>
              <stop offset="100%" stopColor={mode==='e'?'#c7baa2':'#a6c9bf'} stopOpacity=".015"/>
            </linearGradient>
          </defs>
          {[0,.25,.5,.75,1].map((f,i)=>{
            const yy=B-f*(B-T),value=lo+f*(hi-lo);
            return <g key={i} className="profile-gridline"><line x1={L} y1={yy} x2={R} y2={yy}/><text x={L-12} y={yy+4} textAnchor="end">{formatNumber(value,mode==='s'?1:0)}{unit}</text></g>;
          })}
          {areas.map((path,i)=><path key={i} d={path} fill={`url(#${gradientId})`} />)}
          <path d={line} fill="none" stroke={mode==='e'?'#c7baa2':'#a6c9bf'} strokeWidth="9" strokeOpacity=".12" strokeLinejoin="round" />
          <path d={line} fill="none" stroke={mode==='e'?'#c7baa2':'#a6c9bf'} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          {focusValue!==null&&<g><line className="profile-focus-line" x1={x(focus.distance)} y1={T} x2={x(focus.distance)} y2={B}/><circle cx={x(focus.distance)} cy={y(focusValue)} r="6" fill={mode==='e'?'#c7baa2':'#a6c9bf'} stroke="#0a2630" strokeWidth="3" /></g>}
          {[0,.25,.5,.75,1].map((f,i)=><text className="profile-x-label" key={i} x={L+f*(R-L)} y={B+25} textAnchor={i===0?'start':i===4?'end':'middle'}>{formatNumber(distance*f,0)}m</text>)}
        </svg>
        <div className="profile-inspector">
          <label htmlFor={`${gradientId}-scrub`}>Inspect position along the route</label>
          <input id={`${gradientId}-scrub`} type="range" min="0" max={Math.max(0,points.length-1)} step="1" value={Math.min(selected,Math.max(0,points.length-1))} onChange={e=>setSelected(Number(e.target.value))}/>
          <output>{formatNumber(focus.distance,0)} m along route · {focusValue===null?'NoData':`${formatNumber(focusValue,1)} ${unit}`}</output>
        </div>
      </div>}
    <div className="profile-summary-strip">
      <div><span>ROUTE LENGTH</span><strong>{formatNumber(distance,0)} m</strong></div>
      <div><span>ELEVATION RANGE</span><strong>{formatNumber(Math.max(...elevationValues)-Math.min(...elevationValues),1)} m</strong></div>
      <div><span>MAX SAMPLED SLOPE</span><strong>{maxSlope===null?'Unavailable':`${formatNumber(maxSlope,1)}°`}</strong></div>
    </div>
    <small>Derived by sampling the original supplied DEM and slope rasters at planned route grid-cell centres. Gaps represent NoData. Vertical scale is expanded to reveal variation; source vertical datum has not been independently verified. Routing cost computation is unchanged.</small>
  </details>;
}

export function Compass({heading=0}:{heading?:number}) {
  return <svg className="compass-dial" viewBox="0 0 100 100" role="img" aria-label={`Map north compass, view bearing ${Math.round(heading)} degrees`}>
    <circle cx="50" cy="50" r="46" fill="#17221eeb" stroke="#91ab9c"/>
    <g transform={`rotate(${-heading} 50 50)`}>
      {Array.from({length:24},(_,i)=><line key={i} x1="50" y1="8" x2="50" y2={i%6===0?'18':'12'} stroke="#a7bbb0" transform={`rotate(${i*15} 50 50)`}/>)}
      <path d="M50 23L41 52L50 47L59 52Z" fill="#ecadbb"/>
      <path d="M50 77L41 48L50 53L59 48Z" fill="#e3ece6"/>
      <g textAnchor="middle" fill="#f0f6f2" fontSize="10" fontWeight="bold">
        <text x="50" y="22">N</text><text x="78" y="54">E</text><text x="50" y="87">S</text><text x="22" y="54">W</text>
      </g>
    </g>
    <circle cx="50" cy="50" r="3" fill="#c5e6d2"/>
  </svg>;
}
