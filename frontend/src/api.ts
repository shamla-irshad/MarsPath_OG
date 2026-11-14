import type {Observation,ObservationLocation,SessionPayload,SessionRecord,SessionStatus,RouteKind} from './types';
import type {RegionalRouteResponse,Candidate,MarsCoordinates,MissionId,Point,RouteResponse,StartMode} from './types';
const URL_BASE=(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/,'');
export const API_BASE=URL_BASE;
async function json<T>(url:string,opts?:RequestInit,timeoutMs=25000):Promise<T>{
 const res=await fetch(url,{...opts,signal:AbortSignal.timeout(timeoutMs)});
 if(!res.ok){let reason='';try{const body=await res.json(); reason=typeof body.detail==='string'?body.detail:(body.detail?.message||'');}catch{} throw Object.assign(new Error(reason||`API request failed (${res.status})`),{status:res.status});}
 return res.json() as Promise<T>;
}
export async function checkHealth(){try{return await json<{status:string;gridLoaded:boolean;candidateCount:number}>(`${URL_BASE}/api/health`);}catch{return null;}}
export async function loadCandidates(missionId:MissionId):Promise<{candidates:Candidate[];source:'api'|'local'}>{
 try{const d=await json<{candidates:Candidate[]}>(`${URL_BASE}/api/missions/${missionId}/candidates`);return {...d,source:'api'};}
 catch{
  const d=await json<{candidates:Candidate[]}>('/data/gis/candidates_manifest.json');
  const filtered=d.candidates.filter(c=>c.missionId===missionId).map(c=>({...c,routingSupported:false,localGridPoint:null}));
  return {candidates:filtered,source:'local'};
 }
}
export async function getCell(p:Point):Promise<{cost:number;traversable:boolean}> {return json(`${URL_BASE}/api/cell/${p.row}/${p.col}`);}
export async function resolveManualStart(coords:MarsCoordinates):Promise<{start:Point;snapDistanceMeters:number;terrainCost:number;crs:string;note:string}>{
 return json(`${URL_BASE}/api/mars/resolve-start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(coords)});
}
export async function planRoutes(destination:Point,candidateId:string|null,startMode:StartMode,startCoordinates?:MarsCoordinates,scienceStopIds:string[]=[],evaBudgetMinutes=90,scienceStopMinutes=10,returnReserveMinutes=15):Promise<RouteResponse>{
 return json(`${URL_BASE}/api/routes/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({missionId:'rover-navigation-jezero',objective:'Risk-aware Marswalk planning',candidateId,scienceStopIds,startMode,evaBudgetMinutes,scienceStopMinutes,intermediateScienceStopMinutes:10,returnReserveMinutes,...(startMode==='manual'?{startCoordinates}:{}),destination})});
}
export async function verifyDeviation(position:Point,route:Point[],corridorMeters=20){return json<{distanceFromRouteMeters:number;offRoute:boolean}>(`${URL_BASE}/api/navigation/deviation`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({position,route,corridorMeters,accuracyMeters:0})});}
// Consistent Mars spherical equirectangular projection: ESRI:103885, R=3396190 m.
export {lonLatToGrid as lonLatToLocal} from './mapMetadata';
export function isLocalPoint(point:Point){return point.row>=0&&point.row<=400&&point.col>=0&&point.col<=400;}
export function formatNumber(v:number,d=1){return Number.isFinite(v)?v.toLocaleString(undefined,{maximumFractionDigits:d}):'â€”';}

export async function planPastLifeRoutes(candidateId:string,startMode:StartMode,startCoordinates?:MarsCoordinates):Promise<RegionalRouteResponse>{
 return json(`${URL_BASE}/api/past-life/routes/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId,startMode,...(startMode==='manual'?{startCoordinates}: {})})},120000);
}

export type SessionPatch={candidateId?:string|null;status?:SessionStatus;progressPercent?:number;selectedRoute?:RouteKind|null;events?:Record<string,unknown>[]};
export async function createSession(missionId:MissionId,candidateId:string|null):Promise<SessionPayload>{
 return json(`${URL_BASE}/api/sessions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({missionId,candidateId})},10000);
}
export async function getSession(id:string):Promise<SessionPayload>{
 return json(`${URL_BASE}/api/sessions/${encodeURIComponent(id)}`,undefined,10000);
}
export async function patchSession(id:string,patch:SessionPatch):Promise<SessionPayload>{
 return json(`${URL_BASE}/api/sessions/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)},10000);
}
export async function addObservation(id:string,text:string,location?:ObservationLocation):Promise<SessionPayload&{observation:Observation}>{
 return json(`${URL_BASE}/api/sessions/${encodeURIComponent(id)}/observations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,...(location?{location}: {})})},10000);
}
