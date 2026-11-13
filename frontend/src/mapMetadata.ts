import type {Point} from './types';
type Metadata={transform:number[];navigation:{cell_size_m:number;width:number;height:number}};
let metadata:Metadata;
export async function loadMapMetadata(){
 const response=await fetch('/data/map_metadata.json');
 if(!response.ok)throw new Error('Map metadata could not be loaded. Reload the page to retry.');
 metadata=await response.json();
 if(!metadata.transform?.every(Number.isFinite)||!metadata.navigation?.cell_size_m)throw new Error('Map metadata is invalid.');
}
export function lonLatToGrid(lon:number,lat:number):Point{
 const scale=3396190*Math.PI/180,size=metadata.navigation.cell_size_m;
 return {row:(metadata.transform[5]-lat*scale)/size-.5,col:(lon*scale-metadata.transform[2])/size-.5};
}
export function gridToLonLat(p:Point){
 const scale=3396190*Math.PI/180,size=metadata.navigation.cell_size_m;
 return {latNorth:(metadata.transform[5]-(p.row+.5)*size)/scale,lonEast:(metadata.transform[2]+(p.col+.5)*size)/scale};
}
