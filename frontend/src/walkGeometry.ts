import type {Point} from './types';
export function nextWalkPoint(position:Point,heading:number,sign:number):Point{const angle=heading*Math.PI/180;return {row:position.row-Math.cos(angle)*.2*sign,col:position.col+Math.sin(angle)*.2*sign}}
export function headingDifference(a:number,b:number){return Math.abs(((a-b+540)%360)-180)}
export function crossedCells(a:Point,b:Point){const start={row:Math.round(a.row),col:Math.round(a.col)},end={row:Math.round(b.row),col:Math.round(b.col)};const cells=[end];if(start.row!==end.row&&start.col!==end.col)cells.push({row:start.row,col:end.col},{row:end.row,col:start.col});return cells}
