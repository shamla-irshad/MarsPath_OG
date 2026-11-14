/** Read-only science context. Never treat a regional photo or a historical
 * environmental reading as an observation at the user's chosen waypoint. */
import {API_BASE} from './api';
import type {MissionId} from './types';

export type ScienceImage = {
  id: string;
  missionId: MissionId;
  title: string;
  mission: string;
  instrument: string;
  sol: number;
  observationDate: string;
  productId: string;
  location: string;
  imageUrl: string;
  sourceUrl: string;
  credit: string;
  matchLevel: 'regional_context' | 'nearby_verified' | 'site_verified';
  matchedCandidateIds: string[];
  note: string;
};
export type ScienceObservation = {
  id: string;
  metric: 'air_temperature' | 'ground_temperature' | 'pressure' | 'wind_speed' | 'ionizing_radiation_dose_rate';
  value: number;
  unit: string;
  mission: string;
  instrument: string;
  location: string;
  sol: number | null;
  observationDate: string;
  productId: string;
  sourceUrl: string;
  contextualOnly: true;
};
export type SurfaceImageResponse = {images: ScienceImage[]; matchingPolicy?: string};
export type EnvironmentalResponse = {
  observations: ScienceObservation[];
  status: 'historical_context_only' | 'no_observations_uploaded';
  isLive: false;
  warning: string;
  references?: {instrument:string;site:string;url:string;note:string}[];
};
export type ScienceLoad<T> = {data:T; origin:'api' | 'static'};

/** Read the API first; for public URL demos, read an identical static snapshot.
 * No simulated data is generated if the backend is offline. */
async function readWithFallback<T>(path:string, staticPath:string):Promise<ScienceLoad<T>> {
  try {
    const response=await fetch(`${API_BASE}${path}`,{signal:AbortSignal.timeout(7500)});
    if(!response.ok) throw new Error(`Science API returned ${response.status}`);
    return {data:await response.json() as T,origin:'api'};
  } catch {
    const response=await fetch(staticPath);
    if(!response.ok)throw new Error('Neither API nor static science records could be loaded');
    return {data:await response.json() as T,origin:'static'};
  }
}

export function loadSurfaceImages() {
  return readWithFallback<SurfaceImageResponse>('/api/science/surface-images','/data/science/surface_images.json');
}
export function loadEnvironmentalContext() {
  return readWithFallback<EnvironmentalResponse>('/api/environment/observations','/data/science/environment_observations.json');
}
