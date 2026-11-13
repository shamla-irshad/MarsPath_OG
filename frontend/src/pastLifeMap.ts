import metadata from './data/past-life/metadata.json';
export const pastLifeMetadata=metadata;
export function pastLifePixel(lonEast:number,latNorth:number){
 const [a,d,b,e,c,f]=metadata.worldFile;const radians=Math.PI/180;
 const x=metadata.radiusMeters*(lonEast-metadata.centralMeridianDegrees)*radians*Math.cos(metadata.standardParallelDegrees*radians);
 const y=metadata.radiusMeters*latNorth*radians;const determinant=a*e-b*d;
 return {col:(e*(x-c)-b*(y-f))/determinant,row:(a*(y-f)-d*(x-c))/determinant};
}
export function pastLifeXY(lonEast:number,latNorth:number){const p=pastLifePixel(lonEast,latNorth);return [(p.col+.5)/metadata.width*1000,(p.row+.5)/metadata.height*1000] as const;}

export function pastLifeLonLat(col:number,row:number){const [a,d,b,e,c,f]=metadata.worldFile;const rad=Math.PI/180;return {lonEast:(a*col+b*row+c)/(metadata.radiusMeters*rad*Math.cos(metadata.standardParallelDegrees*rad))+metadata.centralMeridianDegrees,latNorth:(d*col+e*row+f)/(metadata.radiusMeters*rad)};}
