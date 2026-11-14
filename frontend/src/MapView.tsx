import {regionalPosition} from './regionalGeometry';
import {pastLifeMetadata,pastLifeXY,pastLifeLonLat} from './pastLifeMap';
import {Compass} from './Terrain';
import {useCallback,useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {formatNumber,lonLatToLocal} from './api';
import type {RegionalRoute,Candidate,LayerFlags,MissionId,Point,Route,RouteKind,StartMode} from './types';

type MapProps={onSelectRegionalStart?:(p:{lonEast:number;latNorth:number})=>void;regionalStart?:{lonEast:number;latNorth:number};regionalRoutes?:RegionalRoute[];regionalProgress?:number;missionId:MissionId;candidates:Candidate[];selectedId:string|null;onChoose?:(id:string)=>void;onSelectGrid?:(p:Point)=>void;onInvalidGridTap?:()=>void;destination?:Point;start?:Point;startMode?:StartMode;routes?:Route[];routeChoice?:RouteKind;progress?:number;manualPosition?:Point|null;positionMode?:'simulation'|'manual';follow?:boolean;onManualCamera?:()=>void;layers:LayerFlags;onLayers:(v:LayerFlags)=>void;compact?:boolean};
const radius=3396190;
export function positionAt(route:Point[]|undefined,percent:number):Point|null{
 if(!route?.length)return null;
 if(route.length===1)return route[0];
 const ls=route.slice(1).map((b,i)=>Math.hypot(b.row-route[i].row,b.col-route[i].col));
 let distance=ls.reduce((a,b)=>a+b,0)*Math.min(1,Math.max(0,percent/100));
 for(let i=0;i<ls.length;i++){if(distance<=ls[i]){const f=ls[i]?distance/ls[i]:0;return {row:route[i].row+(route[i+1].row-route[i].row)*f,col:route[i].col+(route[i+1].col-route[i].col)*f}}distance-=ls[i];}
 return route[route.length-1];
}
export function nearestRouteDistance(p:Point,route:Point[]):number{
 if(route.length<2)return Infinity;
 let best=Infinity;
 for(let i=0;i<route.length-1;i++){const a=route[i],b=route[i+1],dx=b.col-a.col,dy=b.row-a.row;
  const t=Math.max(0,Math.min(1,((p.col-a.col)*dx+(p.row-a.row)*dy)/(dx*dx+dy*dy||1)));
  best=Math.min(best,Math.hypot(p.col-a.col-t*dx,p.row-a.row-t*dy));
 }
 return best*5;
}
function Icon({kind}:{kind:string}){const paths:Record<string,string>={plus:'M12 5v14M5 12h14',minus:'M5 12h14',layers:'m3 7 9-4 9 4-9 4-9-4m0 5 9 4 9-4m-18 5 9 4 9-4',home:'m3 11 9-8 9 8v10H3z',focus:'M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5',route:'M6 20C2 14 16 10 19 4M4 18l2 2 2-2M17 6l2-2 2 2',eye:'M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6'};return <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]||paths.focus}/></svg>}
export default function MapView({onSelectRegionalStart,regionalStart,missionId,candidates,selectedId,onChoose,onSelectGrid,onInvalidGridTap,destination,start,startMode='butler',routes=[],routeChoice='shortest',progress=0,manualPosition=null,positionMode='simulation',follow=false,onManualCamera,layers,onLayers,compact=false,regionalRoutes=[],regionalProgress}:MapProps){
 const [terrainLayer,setTerrainLayer]=useState<'none'|'elevation'|'slope'>('none');
 const local=missionId==='rover-navigation-jezero';const pastLife=missionId==='past-life-jezero';
 const host=useRef<HTMLDivElement>(null),drag=useRef<{id:number;startX:number;startY:number;x:number;y:number;moved:boolean}|null>(null);
 const [size,setSize]=useState(480),[cam,setCam]=useState({zoom:1,x:0,y:0}),[layerOpen,setLayerOpen]=useState(false),[imgError,setImgError]=useState(false),[isPanning,setIsPanning]=useState(false);
 const [opacity,setOpacity]=useState(()=>Math.min(100,Math.max(0,Number(sessionStorage.getItem('marspath_opacity')||65))));
 const worldWidth=pastLife?size*pastLifeMetadata.width/pastLifeMetadata.height:size;
 // The supplied local orbital preview is only 2001 x 2001 px.
 // Prevent magnifying it so far that individual source pixels dominate the screen.
 // Replacing the preview with matching higher-resolution imagery is the only way to reveal more surface detail.
 const usefulLocalZoom=Math.min(7,Math.max(1,2001/Math.max(1,size)*1.12));
 // Preserve clickable geographic locations while making pins slightly more discreet in detailed views.
 const markerVisualScale=Math.max(.8,1-.08*Math.log2(Math.max(1,cam.zoom)));
 const pinTransform=`translate(-50%,-50%) scale(${markerVisualScale/cam.zoom})`;
 // Routes are drawn in viewport coordinates; reduce their width at high magnification.
 const selectedRouteWidth=Math.max(1.15,2.35/Math.sqrt(Math.max(1,cam.zoom)));
 const alternativeRouteWidth=Math.max(1,2/Math.sqrt(Math.max(1,cam.zoom)));
 const camRef=useRef(cam); camRef.current=cam;
 const [stageWidth,setStageWidth]=useState(750),[stageHeight,setStageHeight]=useState(600);
 useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;setStageWidth(width);setStageHeight(height);setSize(Math.max(250,Math.min(width,height)));});observer.observe(host.current);return ()=>observer.disconnect();},[]);
 const regionalBounds=useMemo(()=>{
  const coords:[number,number][]=[];
  for(const c of candidates){coords.push([c.lonEast,c.latNorth]);if(c.geometry.type==='Polygon')for(const ring of c.geometry.coordinates)for(const pair of ring)if(pair.length===2)coords.push(pair);}
  if(!coords.length)return {xmin:0,xmax:1,ymin:0,ymax:1};
  const xs=coords.map(v=>v[0]),ys=coords.map(v=>v[1]);const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const padX=Math.max((xmax-xmin)*.15,.005),padY=Math.max((ymax-ymin)*.15,.005);
  return {xmin:xmin-padX,xmax:xmax+padX,ymin:ymin-padY,ymax:ymax+padY};
 },[candidates]);
 const toXY=useCallback((lon:number,lat:number)=>{
  if(local){const p=lonLatToLocal(lon,lat);return [(p.col*5+2.5)/2001*1000,(p.row*5+2.5)/2001*1000] as const;}
  if(pastLife)return pastLifeXY(lon,lat);
  return [(lon-regionalBounds.xmin)/(regionalBounds.xmax-regionalBounds.xmin)*1000,(regionalBounds.ymax-lat)/(regionalBounds.ymax-regionalBounds.ymin)*1000] as const;
 },[local,pastLife,regionalBounds]);
 const fitScienceSites=useCallback(()=>{if(!pastLife||!candidates.length)return;const points=candidates.map(c=>pastLifeXY(c.lonEast,c.latNorth));const xs=points.map(p=>p[0]/1000),ys=points.map(p=>p[1]/1000);const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;const z=Math.min(7,Math.max(1,Math.min(stageWidth*.65/(Math.max(...xs)-Math.min(...xs)||1)/worldWidth,stageHeight*.65/(Math.max(...ys)-Math.min(...ys)||1)/size)));setCam({zoom:z,x:-(x-.5)*worldWidth*z,y:-(y-.5)*size*z});},[pastLife,candidates,worldWidth,size,stageWidth,stageHeight]);
 const selectedRoute=routes.find(r=>r.id===routeChoice)||routes[0];
 const selectedRegional=regionalRoutes.find(r=>r.id===routeChoice)||regionalRoutes[0];
 const regionalPos=selectedRegional&&regionalProgress!=null?pastLifeXY(...regionalPosition(selectedRegional,regionalProgress)):null;
 const fitRegionalRoute=useCallback(()=>{if(!pastLife||!regionalRoutes.length)return;const r=regionalRoutes.find(r=>r.id===routeChoice)||regionalRoutes[0];const pts=r.geometry.map(p=>pastLifeXY(...p));const xs=pts.map(p=>p[0]/1000),ys=pts.map(p=>p[1]/1000);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const z=Math.max(.75,Math.min(12,stageWidth*.75/(Math.max(.04,maxX-minX)*worldWidth),stageHeight*.7/(Math.max(.04,maxY-minY)*size)));setCam({zoom:z,x:-((minX+maxX)/2-.5)*worldWidth*z,y:-((minY+maxY)/2-.5)*size*z});},[pastLife,regionalRoutes,routeChoice,stageWidth,stageHeight,worldWidth,size]);
 const fitted=useRef<RegionalRoute[]|null>(null);
 useEffect(()=>{if(regionalRoutes.length&&fitted.current!==regionalRoutes){fitted.current=regionalRoutes;fitRegionalRoute()}},[regionalRoutes,fitRegionalRoute]);
 const activePosition=positionMode==='manual'?manualPosition:(manualPosition||positionAt(selectedRoute?.geometry,progress));
 const zoom=useCallback((factor:number,clientX?:number,clientY?:number)=>{onManualCamera?.();setCam(old=>{
  const next=Math.min(pastLife?12:local?usefulLocalZoom:7,Math.max(.75,old.zoom*factor));const rect=host.current?.getBoundingClientRect();
  const ax=rect&&clientX!=null?clientX-rect.left-stageWidth/2:0,ay=rect&&clientY!=null?clientY-rect.top-stageHeight/2:0;
  return {zoom:next,x:ax-(ax-old.x)*next/old.zoom,y:ay-(ay-old.y)*next/old.zoom};
 });},[onManualCamera,stageWidth,stageHeight,pastLife,local,usefulLocalZoom]);
 const centerGrid=useCallback((p:Point,changeZoom=false)=>{setCam(c=>({zoom:changeZoom?2.1:c.zoom,x:-((p.col*5+2.5)/2001-.5)*size*(changeZoom?2.1:c.zoom),y:-((p.row*5+2.5)/2001-.5)*size*(changeZoom?2.1:c.zoom)}));},[size]);
 useEffect(()=>{if(follow&&local&&activePosition)centerGrid(activePosition,false);},[follow,local,activePosition?.row,activePosition?.col,centerGrid]);
 useEffect(()=>{const node=host.current;if(!node)return;const handle=(e:globalThis.WheelEvent)=>{e.preventDefault();zoom(e.deltaY>0?.86:1.16,e.clientX,e.clientY)};node.addEventListener('wheel',handle,{passive:false});return ()=>node.removeEventListener('wheel',handle);},[zoom]);
 const pointerDown=(e:PointerEvent<HTMLDivElement>)=>{if((e.pointerType==='mouse'&&e.button!==0)||(e.target as HTMLElement).closest('button, input, select, textarea, label, .map-marker-clickable, .map-title, .map-bottom-note, .map-layer-panel'))return;
  host.current?.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:camRef.current.x,y:camRef.current.y,moved:false};};
 const pointerMove=(e:PointerEvent<HTMLDivElement>)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.startX,dy=e.clientY-d.startY;if(Math.hypot(dx,dy)>4){if(!d.moved){onManualCamera?.();setIsPanning(true)}d.moved=true;}if(d.moved)setCam(c=>({...c,x:d.x+dx,y:d.y+dy}));};
 const pointerUp=(e:PointerEvent<HTMLDivElement>)=>{const d=drag.current;drag.current=null;setIsPanning(false);
 if(d&&!d.moved&&pastLife&&onSelectRegionalStart){const rect=host.current?.getBoundingClientRect();if(!rect)return;const x=(e.clientX-rect.left-stageWidth/2-camRef.current.x)/(worldWidth*camRef.current.zoom)+.5,y=(e.clientY-rect.top-stageHeight/2-camRef.current.y)/(size*camRef.current.zoom)+.5;if(x>=0&&x<=1&&y>=0&&y<=1)onSelectRegionalStart(pastLifeLonLat(x*pastLifeMetadata.width-.5,y*pastLifeMetadata.height-.5));else onInvalidGridTap?.();return;}
 if(d&&!d.moved&&local&&onSelectGrid){const rect=host.current?.getBoundingClientRect();if(!rect)return;
  const x=e.clientX-rect.left-stageWidth/2-camRef.current.x,y=e.clientY-rect.top-stageHeight/2-camRef.current.y;
  const col=Math.floor((x/(size*camRef.current.zoom)+.5)*2001/5),row=Math.floor((y/(size*camRef.current.zoom)+.5)*2001/5);
  if(row>=0&&row<=400&&col>=0&&col<=400)onSelectGrid({row,col});else onInvalidGridTap?.();
 }};
 const loc=local?(p:Point)=>[(p.col*5+2.5)/2001*1000,(p.row*5+2.5)/2001*1000] as const:()=>[500,500] as const;
 const screenX=(p:number)=>`${p/10}%`;
 const filteredLayers=[{id:'imagery',name:'NASA orbital imagery',local:true},{id:'candidates',name:'Candidate markers / areas',local:false},{id:'labels',name:'Location labels',local:false},{id:'grid',name:'Coordinate grid',local:false},{id:'cost',name:'Higher-cost terrain',local:true},{id:'blocked',name:'Blocked cells',local:true},{id:'route',name:'Selected route',local:true},{id:'alternative',name:'Alternative route',local:true}] as const;
 const scaleKm=local?100:pastLife?1000:0;
 const scaleBarPx=local?100/2001*size*cam.zoom:pastLife?1000/(pastLifeMetadata.width*pastLifeMetadata.resolutionMeters[0])*worldWidth*cam.zoom:0;
 const displayedRoutes=(pastLife?regionalRoutes.map(r=>({id:r.id,points:r.geometry.map(p=>pastLifeXY(...p))})):routes.map(r=>({id:r.id,points:r.geometry.map(loc)})));
 return <div className={`mars-map-shell ${compact?'compact':''} ${isPanning?'is-panning':''}`} ref={host} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;setIsPanning(false)}} onDoubleClick={e=>zoom(1.3,e.clientX,e.clientY)} aria-label={local?"Interactive Jezero map: tap a destination to calculate a route from the selected starting option, drag to pan, scroll to zoom":"Interactive Mars science map: drag to pan and scroll to zoom"}>
   <div className="map-checker"/><div className="map-compass" title="North-up Mars map; no magnetic sensor"><Compass/></div><div className="map-resolution">{local&&cam.zoom>=usefulLocalZoom*.97?'Maximum useful detail for the supplied 2001 px preview; higher-resolution registered imagery required for deeper zoom.':cam.zoom>=3?'Detail view · limited by source raster resolution.':'Overview · zoom to inspect candidate boundaries and terrain.'}{local&&' Image: 1 m/pixel · routing cells: 5 m.'}{pastLife&&' Supplied CTX preview: approximately 20 m/pixel.'}</div>
   <div className="map-world" style={{width:worldWidth,height:size,transform:`translate(calc(-50% + ${cam.x}px),calc(-50% + ${cam.y}px)) scale(${cam.zoom})`}}>
    {local? <>{layers.imagery&&!imgError?<img draggable="false" className="map-image" src="/data/landing_area_ortho_preview.png" alt="NASA-derived Jezero landing area orbital map" onError={()=>setImgError(true)}/>:<div className="map-no-imagery">{imgError?'NASA image unavailable':'Imagery hidden'}</div>}
      {terrainLayer!=='none'&&<img draggable="false" className="map-data-overlay" style={{opacity:opacity/100}} src={`/data/terrain/${terrainLayer}.png`} alt={`${terrainLayer} from supplied GeoTIFF`}/>}
      {layers.cost&&<img draggable="false" className="map-data-overlay" style={{opacity:opacity/100,width:`${2005/2001*100}%`,height:`${2005/2001*100}%`}} src="/data/navigation_cost_overlay.png" alt=""/>}
      {layers.blocked&&<img draggable="false" className="map-data-overlay" style={{opacity:opacity/100,width:`${2005/2001*100}%`,height:`${2005/2001*100}%`}} src="/data/blocked_cells_overlay.png" alt=""/>}
    </>:pastLife?<>{layers.imagery&&!imgError?<img draggable="false" className="map-image" src="/data/past-life/jezero_ctx_web.png" alt="Supplied georeferenced Jezero CTX regional preview" onError={()=>setImgError(true)}/>:<div className="map-no-imagery">{imgError?'Regional image unavailable':'Imagery hidden'}</div>}</>:<div className="coordinate-map-base"><span>PLANETARY COORDINATE VIEW</span><strong>{missionId==='water-ice-arcadia'?'ARCADIA PLANITIA':'JEZERO SCIENCE SITES'}</strong><small>No registered local basemap supplied · geographic positions schematic</small></div>}
    {layers.grid&&<div className="map-grid"/>}
    <svg className="map-geometries" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      {layers.candidates&&candidates.map(c=>c.geometry.type==='Polygon'&&<path key={c.id} className={selectedId===c.id?'candidate-outline active':'candidate-outline'} style={{opacity:opacity/100}} d={c.geometry.coordinates.map(ring=>ring.map(([lon,lat],i)=>{const [x,y]=toXY(lon,lat);return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`}).join(' ')+' Z').join(' ')} />)}
      {/* Put routes inside the SAME georeferenced world as the imagery.
          CSS camera interpolation now keeps raster + routes + candidate polygons aligned. */}
      {(local||pastLife)&&layers.alternative&&displayedRoutes.filter(r=>r.id!==routeChoice).map(r=><polyline key={r.id} className="map-screen-route-alt" style={{strokeWidth:alternativeRouteWidth}} points={r.points.map(p=>p.join(',')).join(' ')}/>)}
      {(local||pastLife)&&layers.route&&displayedRoutes.filter(r=>r.id===routeChoice).map(r=><polyline key={r.id} className="map-screen-route-main" style={{strokeWidth:selectedRouteWidth}} points={r.points.map(p=>p.join(',')).join(' ')}/>)}
    </svg>
    {layers.candidates&&candidates.map(c=>{const [x,y]=toXY(c.lonEast,c.latNorth);return <button key={c.id} className={`map-candidate map-marker-clickable ${selectedId===c.id?'selected':''}`} style={{left:screenX(x),top:screenX(y),transform:pinTransform}} title={`Select ${c.name}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onChoose?.(c.id)}}><i/>{layers.labels&&(!pastLife||!regionalRoutes.length||selectedId===c.id)&&(cam.zoom>=1.8||selectedId===c.id)&&<span>{c.name}</span>}</button>})}
    {pastLife&&regionalStart&&!selectedRegional&&<div className="map-landing" style={{left:screenX(toXY(regionalStart.lonEast,regionalStart.latNorth)[0]),top:screenX(toXY(regionalStart.lonEast,regionalStart.latNorth)[1]),transform:pinTransform}}><b>◎</b><span>Selected start · pending validation</span></div>}
    {pastLife&&selectedRegional&&<div className="map-landing" style={{left:screenX(toXY(...selectedRegional.geometry[0])[0]),top:screenX(toXY(...selectedRegional.geometry[0])[1]),transform:pinTransform}}><b>◎</b>{layers.labels&&<span>Model start</span>}</div>}
    {pastLife&&regionalPos&&<div className="map-position" style={{left:screenX(regionalPos[0]),top:screenX(regionalPos[1]),transform:pinTransform}} title="Simulated regional position"><b>●</b></div>}
    {local&&<div className="map-landing" style={{left:`${1002.5/2001*100}%`,top:`${1002.5/2001*100}%`,transform:pinTransform}} title="Octavia E. Butler landing-area reference (grid 200,200)"><b>◎</b>{layers.labels&&<span>{startMode==='manual'?'Butler reference':'Butler start'}</span>}</div>}
    {local&&start&&(start.row!==200||start.col!==200)&&<div className="map-custom-start" style={{left:screenX((start.col*5+2.5)/2001*1000),top:screenX((start.row*5+2.5)/2001*1000),transform:pinTransform}} title={`Manual start (grid ${start.row},${start.col})`}><b>⬢</b>{layers.labels&&<span>Manual start</span>}</div>}
    {local&&layers.labels&&selectedRoute?.scienceStops?.map((stop,i)=><div key={stop.id} className="map-science-stop" style={{left:screenX((stop.point.col*5+2.5)/2001*1000),top:screenX((stop.point.row*5+2.5)/2001*1000),transform:pinTransform}}><b>{i+1}</b><span>{stop.id} · planned stop</span></div>)}
    {local&&destination&&<div className="map-destination" style={{left:screenX((destination.col*5+2.5)/2001*1000),top:screenX((destination.row*5+2.5)/2001*1000),transform:pinTransform}} title={`Destination grid ${destination.row}, ${destination.col}`}><b>◆</b></div>}
    {local&&activePosition&&<div className="map-position" style={{left:screenX((activePosition.col*5+2.5)/2001*1000),top:screenX((activePosition.row*5+2.5)/2001*1000),transform:pinTransform}} title="Simulated or manual position"><b>●</b></div>}
   </div>
   <div className="map-title"><small>{local?'JEZERO · SUPPLIED ORBITAL IMAGE':pastLife?'JEZERO · SUPPLIED CTX PREVIEW':'MARS SCIENTIFIC DATA VIEW'}</small><strong>{local?'ESRI:103885 · 5 m NAVIGATION GRID':pastLife?'MARS EQUIRECTANGULAR · 18.4663° STANDARD PARALLEL':'EAST-POSITIVE LONGITUDE · NORTH LATITUDE'}</strong></div>
   <div className="map-actions" onPointerDown={e=>e.stopPropagation()}>
    <button title="Zoom in" aria-label="Zoom in" onClick={()=>zoom(1.23)}><Icon kind="plus"/></button>
    <button title="Zoom out" aria-label="Zoom out" onClick={()=>zoom(1/1.23)}><Icon kind="minus"/></button>
    <button title="Show or hide layers" aria-label="Toggle layer panel" aria-expanded={layerOpen} onClick={()=>setLayerOpen(v=>!v)}><Icon kind="layers"/></button>
    {pastLife&&regionalRoutes.length>0&&<button title="Fit regional route" aria-label="Fit regional route" onClick={fitRegionalRoute}><Icon kind="route"/></button>}
    {pastLife&&<button title="Fit science sites" aria-label="Fit science sites" onClick={fitScienceSites}><Icon kind="focus"/></button>}
    <button title="Reset view" aria-label="Reset map view" onClick={()=>{onManualCamera?.();setCam({zoom:1,x:0,y:0})}}><Icon kind="home"/></button>
    {local&&activePosition&&<button title="Recenter on position, preserve zoom" aria-label="Recenter on position" onClick={()=>centerGrid(activePosition)}><Icon kind="focus"/></button>}
    {local&&routes.length>0&&<button title="Fit route" aria-label="Fit route" onClick={()=>{onManualCamera?.();const pts=routes.flatMap(r=>r.geometry);const r0=Math.min(...pts.map(p=>p.row)),r1=Math.max(...pts.map(p=>p.row)),c0=Math.min(...pts.map(p=>p.col)),c1=Math.max(...pts.map(p=>p.col));const zoom=Math.max(.75,Math.min(usefulLocalZoom,270/Math.max(r1-r0,c1-c0,70)));setCam({zoom,x:-(((c0+c1)/2*5+2.5)/2001-.5)*size*zoom,y:-(((r0+r1)/2*5+2.5)/2001-.5)*size*zoom})}}><Icon kind="route"/></button>}
   </div>
   {layerOpen&&<aside className="map-layer-panel" onPointerDown={e=>e.stopPropagation()}><div className="map-layer-head"><strong>Map visibility</strong><button aria-label="Close layers" onClick={()=>setLayerOpen(false)}>×</button></div>{filteredLayers.filter(l=>!l.local||local||(pastLife&&['imagery','route','alternative'].includes(l.id))).map(item=><label key={item.id}><input type="checkbox" checked={layers[item.id]} onChange={e=>onLayers({...layers,[item.id]:e.target.checked})}/><span>{item.name}</span></label>)}{local&&<label>Terrain overlay<select aria-label="Terrain overlay" value={terrainLayer} onChange={e=>setTerrainLayer(e.target.value as 'none'|'elevation'|'slope')}><option value="none">None</option><option value="elevation">Elevation (m)</option><option value="slope">Slope (degrees)</option></select></label>}{terrainLayer!=='none'&&<p>{terrainLayer==='elevation'?'Elevation: dark −2607.6 m → light −2544.7 m':'Slope: dark 0° → light 38.3°'} · transparent = NoData. Metadata in Science & Data.</p>}<div className="map-opacity"><label htmlFor="overlay-opacity">Overlay opacity <strong>{opacity}%</strong></label><input id="overlay-opacity" type="range" min="0" max="100" value={opacity} onChange={e=>{const v=Number(e.target.value);setOpacity(v);sessionStorage.setItem('marspath_opacity',String(v))}} /></div><div className="map-layer-bottom"><button onClick={()=>{setTerrainLayer('none');onLayers({imagery:true,candidates:false,labels:false,grid:false,cost:false,blocked:false,route:false,alternative:false})}}>Clear overlays</button><button onClick={()=>{setTerrainLayer('none');onLayers({imagery:true,candidates:true,labels:true,grid:false,cost:false,blocked:false,route:true,alternative:false})}}>Defaults</button></div><p>Terrain cost comes from the provided 1/5/255 model grid, not live hazard sensors.</p></aside>}
   <div className="map-bottom-note" onPointerDown={e=>e.stopPropagation()}><span>{local?'LOCAL ROUTING COVERAGE ~2 KM':pastLife?'REGISTERED CTX PREVIEW · REGIONAL MODEL ROUTES':'SCHEMATIC SCIENCE VIEW · NOT A ROUTABLE BASEMAP'}</span>{(local||pastLife)&&<span>{formatNumber(scaleKm,0)} m projected scale <i style={{width:scaleBarPx}}/></span>}</div>
 </div>;
}