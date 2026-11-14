export type Page='home'|'discover'|'map'|'compare'|'navigate'|'summary';
export type MissionId='rover-navigation-jezero'|'water-ice-arcadia'|'past-life-jezero';
export type Point={row:number;col:number};
export type StartMode='butler'|'manual';
export type MarsCoordinates={latNorth:number;lonEast:number};
export type GeoShape={type:'Point';coordinates:[number,number]}|{type:'Polygon';coordinates:[number,number][][]};
export type Candidate={
  id:string; name:string;missionId:MissionId;lonEast:number;latNorth:number;
  properties:Record<string,string|number|boolean|null>;
  geometry:GeoShape; sources:string[]; localGridPoint?:Point|null; localCellCost?:number|null;
  coordinateVerified?:boolean|null; routingSupported?:boolean;routingNote?:string;
};
export type RouteKind='shortest'|'lower'|'balanced';
export type Route={scienceStops?:{id:string;name:string;point:Point}[];legs?:{distanceMeters:number;estimatedMinutes:number}[];id:RouteKind;label:string;geometry:Point[];metrics:{distanceMeters:number;estimatedMinutes:number;traversalCost:number;highCostExposurePercent:number;waypoints:number;averageSlopeDegrees?:number|null;maximumSlopeDegrees?:number|null;unknownSlopeDistanceMeters?:number};returnRoute?:{geometry:Point[];metrics:{distanceMeters:number;estimatedMinutes:number}};resourceAssessment?:{estimatedRoundTripMinutes:number;outboundMinutes:number;returnMinutes:number;scienceMinutes:number;evaBudgetMinutes:number;returnReserveMinutes:number;usableMinutesBeforeReserve:number;estimatedOxygenUsePercent:number;estimatedBatteryUsePercent:number;withinPlanningBudget:boolean;status:string;assumptions:string[]};dataSources:string[];modelNotice?:string};
export type RouteResponse={source:string;status:string;start:Point;startMode:StartMode;startResolution?:{start:Point;snapDistanceMeters:number;terrainCost:number}|null;destination:Point;routes:Route[];notices?:string[]};
export type LayerFlags={imagery:boolean;candidates:boolean;labels:boolean;grid:boolean;cost:boolean;blocked:boolean;route:boolean;alternative:boolean};
export const INITIAL_LAYERS:LayerFlags={imagery:true,candidates:true,labels:true,grid:false,cost:false,blocked:false,route:true,alternative:false};
export type MissionState={missionId:MissionId;candidateId:string|null;destination:Point;routeChoice:RouteKind;progress:number;completed:boolean};
export const MISSIONS:{id:MissionId;label:string;region:string;capability:string;description:string;science:string;icon:string}[]=[
  {id:'rover-navigation-jezero',label:'Terrain Exploration',region:'Jezero Crater',capability:'Route planning',description:'Explore candidate terrain zones and investigate routes using a localized terrain-cost model.',science:'Slope, elevation and derived traversability',icon:'route'},
  {id:'water-ice-arcadia',label:'Water-Ice Exploration',region:'Arcadia Planitia',capability:'Science comparison',description:'Compare scientific evidence consistent with possible subsurface water ice in selected candidate regions.',science:'SWIM 0–1 m and 1–5 m consistency metrics',icon:'ice'},
  {id:'past-life-jezero',label:'Past Habitability Exploration',region:'Jezero Crater',capability:'Regional route planning',description:'Explore scientifically interesting rock and sampling locations associated with investigations of ancient Martian environments.',science:'Geological observations and sample references',icon:'science'}
];

export type RegionalRoute={id:RouteKind;label:string;geometry:[number,number][];metrics:{distanceMeters:number;estimatedMinutes:number;traversalCost:number;highCostExposurePercent:number;waypoints:number};source:string;modelNotice?:string};
export type RegionalRouteResponse={inputMars?:MarsCoordinates;status:string;missionId:'past-life-jezero';candidateId:string;startMode:StartMode;startMars:{lonEast:number;latNorth:number};routes:RegionalRoute[];source:string;notices:string[]};

// Saved planning sessions and observations.
export type SessionStatus='planning'|'navigating'|'completed'|'incomplete'|'science-only';
export type ObservationLocation={lonEast?:number;latNorth?:number;row?:number;col?:number};
export type Observation={id:string;created:string;sessionId:string;source:'user-recorded';text:string;location:ObservationLocation|null};
export type SessionRecord={id:string;created:string;updated:string;missionId:MissionId;candidateId:string|null;status:SessionStatus;progressPercent:number;selectedRoute:RouteKind|null;events:Record<string,unknown>[]};
export type SessionPayload={session:SessionRecord;observations:Observation[]};
