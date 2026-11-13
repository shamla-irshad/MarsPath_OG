import type {RegionalRoute} from './types';
const R=3396190,rad=Math.PI/180,k=Math.cos(18.4663*rad);
export function regionalDistance(a:readonly number[],b:readonly number[]){return Math.hypot((b[0]-a[0])*rad*R*k,(b[1]-a[1])*rad*R);}
export function regionalPosition(route:RegionalRoute,progress:number):[number,number]{const points=route.geometry;if(!points.length)return [0,0];const lengths=points.slice(1).map((p,i)=>regionalDistance(points[i],p));let remaining=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(100,progress))/100;for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]){const t=lengths[i]?remaining/lengths[i]:0;return [points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t]}remaining-=lengths[i]}return points[points.length-1];}
export function mapToScreen(x:number,y:number,rect:{x:number;y:number;width:number;height:number}):readonly [number,number]{return [rect.x+x/1000*rect.width,rect.y+y/1000*rect.height];}
