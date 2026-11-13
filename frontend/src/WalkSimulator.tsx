import {nextWalkPoint,headingDifference,crossedCells} from './walkGeometry';

import {useEffect,useRef,useState} from 'react';

import {getCell} from './api';

import {nearestRouteDistance} from './MapView';

import type {Point,Route} from './types';

export default function WalkSimulator({route,position,onPosition,onHeading}:{route:Route;position:Point;onPosition:(p:Point)=>void;onHeading:(h:number)=>void}){

 const [heading,setHeading]=useState(0),[message,setMessage]=useState(''),[ack,setAck]=useState(false);const busy=useRef(false),dialog=useRef<HTMLDialogElement>(null);

 function routeBearing(){let index=0,best=Infinity;route.geometry.forEach((p,i)=>{const d=Math.hypot(p.row-position.row,p.col-position.col);if(d<best){best=d;index=i}});index=Math.min(index,route.geometry.length-2);const a=route.geometry[index],b=route.geometry[index+1];return (Math.atan2(b.col-a.col,a.row-b.row)*180/Math.PI+360)%360}
 function turn(delta:number){const next=(heading+delta+360)%360;setHeading(next);onHeading(next);const difference=headingDifference(next,routeBearing());if(difference>60){setMessage(`Wrong direction: travel heading is ${Math.round(difference)} degrees away from the route. Align with the route before walking.`);setAck(false)}else if(message.startsWith('Wrong direction')){setMessage('');setAck(false)}}

 async function move(sign:number){if(busy.current)return;busy.current=true;

  const next=nextWalkPoint(position,heading,sign);

  try{if(next.row<0||next.row>400||next.col<0||next.col>400){setMessage('Map coverage ends here. Return to the mapped area.');setAck(false);return}

   const cells=crossedCells(position,next);

   const result=await Promise.all(cells.map(getCell));if(result.some(c=>!c.traversable)){setMessage('Blocked terrain ahead. Movement stopped before entering the blocked model cell.');setAck(false);return}

   onPosition(next);

   let index=0,best=Infinity;route.geometry.forEach((p,i)=>{const d=Math.hypot(p.row-next.row,p.col-next.col);if(d<best){best=d;index=i}});

   const target=route.geometry[Math.min(index+1,route.geometry.length-1)];const desired=(Math.atan2(target.col-next.col,next.row-target.row)*180/Math.PI+360)%360;const travel=(heading+(sign<0?180:0))%360;const difference=headingDifference(travel,desired);

   const deviation=nearestRouteDistance(next,route.geometry);const warning=deviation>20?`Off route: ${Math.round(deviation)} m from the planned path. Review the map before proceeding.`:difference>60?'Wrong direction: your simulated movement is away from the next route point. Turn toward the plotted route.':result[0].cost===5?'Higher-cost terrain: this cell is classified as more difficult by the supplied model.':'';

   if(warning!==message){setMessage(warning);setAck(false)}

  }catch{setMessage('Terrain check unavailable. Movement paused; check the backend connection.');setAck(false)}finally{busy.current=false}

 }

 useEffect(()=>{if(message&&!ack){if(!dialog.current?.open)dialog.current?.showModal()}else dialog.current?.close()},[message,ack]);

 return <section className="walk-controls" tabIndex={0} aria-label="Manual walking simulator. W or up to walk, S or down to step back, A and D or left and right to turn." onKeyDown={e=>{if(dialog.current?.open)return;const key=e.key.toLowerCase();if(['w','s','a','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();if(key==='w'||key==='arrowup')void move(1);else if(key==='s'||key==='arrowdown')void move(-1);else turn(key==='a'||key==='arrowleft'?-15:15)}}}><h3>Walk & investigate</h3><p>Heading {heading}° from north · each step is 1 m. Focus this panel to use WASD or arrow keys.</p><div className="walk-pad"><button onClick={()=>turn(-15)}>↶ Turn 15°</button><button onClick={()=>void move(1)}>↑ Walk 1 m</button><button onClick={()=>turn(15)}>Turn 15° ↷</button><button onClick={()=>{const next=routeBearing();setHeading(next);onHeading(next);setMessage('');setAck(false)}}>Align with route</button><button onClick={()=>void move(-1)}>↓ Step back</button><button onClick={()=>{onPosition(route.geometry[0]);setMessage('');setAck(false)}}>Reset to start</button></div><small>Manual movement does not count as completing the route-preview simulation.</small>{message&&<p role="status">{message}<button onClick={()=>setAck(false)}>Review</button></p>}<dialog ref={dialog} className="heading-dialog" onCancel={()=>setAck(true)} aria-label="Walking advisory"><h2>Navigation warning</h2><p>{message}</p><button autoFocus onClick={()=>setAck(true)}>Review map & continue</button><small>Model-based simulation; no live hazard measurements.</small></dialog></section>

}

