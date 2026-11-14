import {formatNumber} from '../api';
import type {Candidate,MissionId} from '../types';

export function getString(v:unknown){return typeof v==='string'?v:'';}
export function propertyText(c:Candidate,key:string,unit=''){const v=c.properties[key];return v==null?'Unavailable':typeof v==='number'?`${formatNumber(v,2)}${unit}`:String(v)}
export function positionLabel(c:Candidate){return `${formatNumber(c.latNorth,5)}° N · ${formatNumber(c.lonEast,5)}° E`}
export function idCopy(c:Candidate){return c.id.replace(/_/g,' ')}
export function missionFacts(c:Candidate):{label:string;value:string}[]{
 if(c.missionId==='rover-navigation-jezero')return [{label:'Mean slope',value:propertyText(c,'slope_mean','°')},{label:'Mean elevation',value:propertyText(c,'elev_mean',' m')},{label:'Relief',value:propertyText(c,'relief_m',' m')},{label:'Area',value:propertyText(c,'area_m2',' m²')}];
 if(c.missionId==='water-ice-arcadia')return [{label:'0–1 m SWIM consistency',value:propertyText(c,'ice01_mean')},{label:'1–5 m SWIM consistency',value:propertyText(c,'ice15_mean')},{label:'Combined ice indicator',value:propertyText(c,'ice_mean')},{label:'Area',value:propertyText(c,'area_km2',' km²')}];
 return [{label:'Rock / sample',value:propertyText(c,'sample_name')},{label:'Feature',value:propertyText(c,'feature_name')},{label:'Sampling sol',value:propertyText(c,'sampling_sol')},{label:'Coordinate status',value:c.coordinateVerified===true?'PDS reported / verified':c.coordinateVerified===false?'Further verification required':'See source notes'}];
}
export function missionExplanation(id:MissionId){
 if(id==='water-ice-arcadia')return 'SWIM values describe evidence consistent with subsurface ice at two depth intervals; they are not probabilities, confirmed deposits, or excavation instructions. No Arcadia walking route data is supplied.';
 if(id==='past-life-jezero')return 'These are science sampling targets and geological observations, not confirmed evidence of life. Two coordinates require further source verification. These sites use a separate 20 m regional routing model; they lie outside the local rover DEM.';
 return 'Three GIS candidate zones lie within the supplied local Jezero navigation raster. Representative points are traversable, but this does not establish astronaut safety or route clearance through each entire polygon.';
}
export function candidateNotice(c:Candidate){return c.coordinateVerified===false?'Coordinate requires further primary-source verification.':c.routingSupported?'Representative grid point traversable in the local model.':c.missionId==='rover-navigation-jezero'?'Routing not available without backend coordinate validation.':c.missionId==='past-life-jezero'?'Regional 20 m planning routes available with the backend.':'Discovery only — no supported local routing grid.'}
