
import WalkSimulator from '../WalkSimulator';
import PlaybackSpeed from '../PlaybackSpeed';
import {useEffect, useState} from 'react';
import HeadingMonitor from '../HeadingMonitor';
import VisorView from '../VisorView';
import MapView, {nearestRouteDistance, positionAt} from '../MapView';
import {TerrainReadout} from '../Terrain';
import {formatNumber, getCell} from '../api';
import type {Candidate, LayerFlags, MissionId, Page, Point, Route} from '../types';
import {LabeledMetric, PageHeader, PrimaryButton, Status} from '../components/ui';

function guidance(route:Route|undefined,progress:number,manual:boolean,position?:Point|null){
 if(!route||route.geometry.length<2)return {turn:'No route loaded',distance:0,bearing:'—',sub:'Choose a route first.'};
 if(progress>=100&&!manual)return {turn:'Destination reached',distance:0,bearing:'—',sub:'Simulation complete.'};

 const points=route.geometry;
 const at=position||positionAt(points,progress)||points[0];
 let i=0,min=Infinity;

 for(let j=0;j<points.length;j++){
  const d=Math.hypot(points[j].row-at.row,points[j].col-at.col);
  if(d<min){i=j;min=d;}
 }

 i=Math.min(i,points.length-2);
 const a=manual?at:points[i];
 const b=points[Math.min(i+1,points.length-1)];
 const angle=Math.atan2(b.col-a.col,a.row-b.row)*180/Math.PI;
 const bearing=((angle+360)%360).toFixed(0)+'°';

 if(manual)return {
  turn:'Bearing to next route point',
  distance:Math.round(Math.hypot(b.col-at.col,b.row-at.row)*5),
  bearing,
  sub:'Heading unknown; no left/right claim. Direction is geometric, not a validated off-route return path.'
 };

 // Detect next significant (>40°) bend, with remaining distance to it.
 let dist=0;
 const start=Math.min(i,points.length-2);
 let lastDx=points[start+1].col-points[start].col;
 let lastDy=points[start+1].row-points[start].row;

 for(let j=start+1;j<points.length-1;j++){
  dist+=Math.hypot(points[j].col-points[j-1].col,points[j].row-points[j-1].row)*5;
  const dx=points[j+1].col-points[j].col;
  const dy=points[j+1].row-points[j].row;
  const cross=lastDx*dy-lastDy*dx;
  const dot=lastDx*dx+lastDy*dy;
  const change=Math.atan2(cross,dot)*180/Math.PI;

  if(Math.abs(change)>=40&&dist>=5)return {
   turn:`After ${Math.round(dist)} m, turn ${Math.round(Math.abs(change))}° ${change>0?'clockwise':'counterclockwise'}`,
   distance:Math.round(dist),
   bearing,
   sub:'Relative to simulated travel heading. Bearing is clockwise from map north; follow the plotted terrain path.'
  };

  lastDx=dx;
  lastDy=dy;
 }

 return {
  turn:`Follow bearing ${bearing} toward destination`,
  distance:Math.round(route.metrics.distanceMeters*(1-progress/100)),
  bearing,
  sub:'No major route turn detected ahead'
 };
}

export function Navigate({
 go,missionId,candidates,candidate,destination,route,progress,setProgress,
 completed,setCompleted,layers,setLayers,onStarted
}:{
 go:(p:Page)=>void;
 missionId:MissionId;
 candidates:Candidate[];
 candidate:Candidate|null;
 destination:Point;
 route:Route|null;
 progress:number;
 setProgress:(n:number)=>void;
 completed:boolean;
 setCompleted:(n:boolean)=>void;
 layers:LayerFlags;
 setLayers:(l:LayerFlags)=>void;
 onStarted:()=>void;
}){
 const [walking,setWalking]=useState(false);
 const [walkHeading,setWalkHeading]=useState(0);
 const [speed,setSpeed]=useState(60);
 const [view,setView]=useState<'orbital'|'visor'>('orbital');
 const [dismissedWarning,setDismissedWarning]=useState('');

 const [status,setStatus]=useState<'ready'|'running'|'paused'|'stopped'>('ready');
 const [mode,setMode]=useState<'simulation'|'manual'|'future'>('simulation');
 const [follow,setFollow]=useState(false);
 const [deviationDemo,setDeviationDemo]=useState(false);
 const [manual,setManual]=useState<Point|null>(null);
 const [manualRow,setManualRow]=useState('');
 const [manualCol,setManualCol]=useState('');
 const [manualError,setManualError]=useState('');
 const [stopConfirm,setStopConfirm]=useState(false);
 const [terrainCost,setTerrainCost]=useState<number|null>(null);

 useEffect(()=>{
  if(status!=='running'||mode!=='simulation'||progress>=100||!route?.metrics.distanceMeters)return;

  const t=window.setInterval(()=>{
   setProgress(Math.min(100,progress+(22/60)*speed*.25/route.metrics.distanceMeters*100));
  },250);

  return ()=>window.clearInterval(t);
 },[status,mode,progress,setProgress,route,speed]);

 useEffect(()=>{
  if(progress>=100&&!completed){
   setCompleted(true);
   setStatus('stopped');
  }
 },[progress,completed,setCompleted]);

 const current=mode==='manual'?manual:positionAt(route?.geometry,progress);
 const routeDeviation=manual&&route?nearestRouteDistance(manual,route.geometry):0;
 const offRoute=deviationDemo||(mode==='manual'&&routeDeviation>20);

 const warning=offRoute
  ?'Possible Route Deviation'
  :terrainCost===255
   ?'Blocked model terrain'
   :terrainCost===5
    ?'Higher-cost model terrain'
    :'';

 useEffect(()=>{
  setDismissedWarning('');
  if(warning)setStatus(s=>s==='running'?'paused':s);
 },[warning]);

 let walked=0;
 let nextStop:{name:string;distance:number}|null=null;

 if(route){
  let from=0;

  for(const stop of route.scienceStops||[]){
   const end=route.geometry.findIndex((p,i)=>i>=from&&p.row===stop.point.row&&p.col===stop.point.col);
   if(end<0)continue;

   for(let i=from+1;i<=end;i++){
    walked+=Math.hypot(
     route.geometry[i].row-route.geometry[i-1].row,
     route.geometry[i].col-route.geometry[i-1].col
    )*5;
   }

   from=end;

   if(walked>route.metrics.distanceMeters*progress/100+.5){
    nextStop={name:stop.id,distance:walked-route.metrics.distanceMeters*progress/100};
    break;
   }
  }
 }

 const text=guidance(route||undefined,progress,mode==='manual',mode==='manual'?manual:null);
 const remaining=route?route.metrics.distanceMeters*(1-progress/100):0;

 useEffect(()=>{
  if(!current||!Number.isFinite(current.row))return;

  let ignore=false;

  getCell({
   row:Math.max(0,Math.min(400,Math.round(current.row))),
   col:Math.max(0,Math.min(400,Math.round(current.col)))
  }).then(data=>{
   if(!ignore)setTerrainCost(data.cost);
  }).catch(()=>{
   if(!ignore)setTerrainCost(null);
  });

  return ()=>{ignore=true};
 },[Math.round(current?.row??0),Math.round(current?.col??0)]);

 const manualSubmit=()=>{
  const row=Number(manualRow);
  const col=Number(manualCol);

  if(!manualRow.trim()||!manualCol.trim()||!Number.isInteger(row)||!Number.isInteger(col)||row<0||row>400||col<0||col>400){
   setManualError('Enter whole-number grid row and column between 0 and 400.');
   return;
  }

  setManualError('');
  setManual({row,col});
  setFollow(false);
 };

 const statusLabel=completed
  ?'Simulation complete'
  :{ready:'Ready',running:'Running',paused:'Paused',stopped:'Stopped'}[status];

 return (
  <main id="main-content" tabIndex={-1} className="navigation-page">
   {warning&&dismissedWarning!==warning&&(
    <section className="warning-popup" role="alert" aria-live="assertive">
     <strong>{warning}</strong>
     <p>
      {offRoute
       ?'The position is outside the planned route corridor, or the deviation demonstration is active. Review the position before continuing.'
       :'The terrain-cost grid classifies this position as blocked or higher cost. This is a model advisory, not a live hazard measurement.'}
     </p>
     <button type="button" className="btn btn-primary btn-sm" onClick={()=>setDismissedWarning(warning)}>Acknowledge</button>
    </section>
   )}

   <PageHeader title="Marswalk navigation" actions={<span className={`nav-status nav-status-${completed?'complete':status}`}>{statusLabel}</span>}>
    This is a simulation. Positions are simulated or entered manually; there is no live Mars positioning.
   </PageHeader>

   <div className="navigation-layout">
    <div className="navigation-map">
     <div className="view-switch" role="group" aria-label="Navigation view">
      <button type="button" aria-pressed={view==='orbital'} onClick={()=>setView('orbital')}>Orbital map</button>
      <button type="button" aria-pressed={view==='visor'} disabled={!route||mode==='future'} onClick={()=>setView('visor')}>Visor simulation</button>
     </div>

     <div className="navigation-surface" style={{display:view==='orbital'?'flex':'none'}}>
      <MapView
       missionId={missionId}
       candidates={candidates}
       selectedId={candidate?.id||null}
       start={route?.geometry[0]}
       startMode={route?.geometry[0]&&(route.geometry[0].row!==200||route.geometry[0].col!==200)?'manual':'butler'}
       destination={destination}
       routes={route?[route]:[]}
       routeChoice={route?.id}
       progress={progress}
       manualPosition={mode==='manual'?manual:null}
       positionMode={mode==='simulation'?'simulation':'manual'}
       follow={follow}
       onManualCamera={()=>setFollow(false)}
       layers={layers}
       onLayers={setLayers}
      />
     </div>

     {view==='visor'&&<VisorView route={route} progress={progress} position={current} manual={mode!=='simulation'} travelHeading={walking?walkHeading:undefined}/>}
    </div>

    <aside className="nav-sidebar" aria-label="Navigation guidance">
     <section className="panel-section">
      {route&&(
       <button
        className="btn btn-outline"
        aria-pressed={walking}
        onClick={()=>{
         setWalking(v=>!v);
         setStatus('paused');
         setMode(walking?'simulation':'manual');
         if(!walking)setManual(current||route.geometry[0]);
        }}
       >
        {walking?'Return to route preview':'Explore manually · walk controls'}
       </button>
      )}

      {walking&&route&&current&&<WalkSimulator route={route} position={current} onPosition={setManual} onHeading={setWalkHeading}/>}

      <PlaybackSpeed value={speed} onChange={setSpeed} disabled={mode!=='simulation'}/>
     </section>

     <section className="panel-section">
      <h2>Next maneuver</h2>
      <p className="guidance-instruction">{text.turn}</p>

      <div className="guidance-primary">
       <strong>{formatNumber(text.distance,0)} m</strong>
       <span>{mode==='manual'?'Estimated distance along route':'To the next maneuver or destination'}</span>
       <small>Bearing {text.bearing} · {text.sub}</small>
      </div>
     </section>

     <section className="panel-section">
      <div className="nav-progress">
       <div><span>Route progress</span><b>{formatNumber(progress,0)}%</b></div>
       <div className="progress-track"><i style={{width:`${progress}%`}}/></div>
      </div>

      <div className="nav-stat-row">
       <LabeledMetric label="Remaining" value={`${formatNumber(remaining,0)} m`}/>
       <LabeledMetric label="Time left" value={`${formatNumber((route?.metrics.estimatedMinutes||0)*(1-progress/100),1)} min`}/>
      </div>

      {route?.scienceStops?.length?(
       <div className="planning-panel">
        <strong>Planned science stops</strong>
        <p>
         {mode==='simulation'
          ?(nextStop?`${nextStop.name}, ${formatNumber(nextStop.distance,0)} m ahead on the route`:'All planned stops have been passed in the simulation')
          :'Stop progress uses simulated travel only.'}
        </p>
        <small>Passing a stop does not record a science observation.</small>
       </div>
      ):null}
     </section>

     <section className="panel-section">
      <h2>Position source</h2>

      <div className="segmented" role="group" aria-label="Position source">
       {(['simulation','manual','future'] as const).map(m=>(
        <button
         type="button"
         key={m}
         className={mode===m?'active':''}
         aria-pressed={mode===m}
         onClick={()=>{
          setWalking(false);
          setMode(m);
          setStatus('paused');
          setFollow(false);
          if(m==='future')setView('orbital');
         }}
        >
         {m==='simulation'?'Simulation':m==='manual'?'Manual':'Future sensors'}
        </button>
       ))}
      </div>

      {mode==='manual'&&(
       <div className="manual-controls">
        <div className="two-inputs">
         <label className="field">
          Row
          <input type="number" min="0" max="400" placeholder="e.g. 200" value={manualRow} onChange={e=>setManualRow(e.target.value)}/>
         </label>

         <label className="field">
          Column
          <input type="number" min="0" max="400" placeholder="e.g. 200" value={manualCol} onChange={e=>setManualCol(e.target.value)}/>
         </label>
        </div>

        <PrimaryButton outline onClick={manualSubmit}>Set position</PrimaryButton>
        {manualError&&<Status kind="error">{manualError}</Status>}

        {manual&&<span className="muted">{`Grid (${manual.row}, ${manual.col}) · ${formatNumber(routeDeviation)} m from the route`}</span>}
       </div>
      )}

      {mode==='future'&&<Status kind="info">Visual odometry and other sensor-based localisation are future concepts, not connected hardware. Earth GPS cannot position an astronaut on Mars.</Status>}

      <div className="toggle-row">
       <button type="button" className={`toggle ${follow?'on':''}`} aria-pressed={follow} onClick={()=>setFollow(v=>!v)}>
        Follow position: {follow?'On':'Off'}
       </button>

       <button type="button" className="toggle" onClick={()=>setDeviationDemo(x=>!x)}>
        {deviationDemo?'Clear deviation demo':'Simulate off-route'}
       </button>
      </div>

      {warning&&dismissedWarning===warning&&(
       <div className="warning-status" role="status">
        {warning} (acknowledged)
        <button type="button" className="inline-link" onClick={()=>setDismissedWarning('')}>Review</button>
       </div>
      )}

      {offRoute&&(
       <button
        type="button"
        className="inline-link"
        onClick={()=>{
         setDeviationDemo(false);
         setManual(null);
         setMode('simulation');
         setStatus('paused');
        }}
       >
        Return to route simulation
       </button>
      )}
     </section>

     <HeadingMonitor bearing={parseFloat(text.bearing)||0} active={!!route&&!completed&&mode!=='future'&&!walking} onWarning={()=>setStatus('paused')}/>
     <TerrainReadout point={current}/>

     <div className="nav-control-buttons">
      <PrimaryButton
       disabled={!route||completed||mode!=='simulation'}
       onClick={()=>{
        // Reveal the observation sections when Start or Resume is pressed.
        // Pressing Pause does not change their visibility.
        if(status!=='running')onStarted();
        setStatus(s=>s==='running'?'paused':'running');
       }}
      >
       {status==='running'?'Pause':status==='paused'?'Resume':'Start'}
      </PrimaryButton>

      <PrimaryButton outline onClick={()=>setStatus('stopped')} disabled={status==='stopped'}>Stop</PrimaryButton>
      <PrimaryButton danger onClick={()=>setStopConfirm(true)}>Exit</PrimaryButton>
     </div>

     {completed&&<PrimaryButton onClick={()=>go('summary')}>View mission summary</PrimaryButton>}
    </aside>
   </div>

   {stopConfirm&&(
    <div className="modal-backdrop">
     <div className="modal" role="dialog" aria-modal="true" aria-labelledby="exit-title">
      <h2 id="exit-title">Exit navigation?</h2>
      <p>The planned route is kept for this browser session. The navigation will be recorded as {completed?'completed':'incomplete'}.</p>

      <div className="action-row">
       <PrimaryButton outline onClick={()=>setStopConfirm(false)}>Keep navigating</PrimaryButton>
       <PrimaryButton danger onClick={()=>{setStatus('stopped');go('summary')}}>Exit to summary</PrimaryButton>
      </div>
     </div>
    </div>
   )}
  </main>
 );
}
