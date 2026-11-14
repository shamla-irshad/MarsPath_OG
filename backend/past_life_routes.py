"""MarsPath regional Jezero Past-Life A* routing (20 m CTX DEM-derived cost raster).

Butler routes are exact precomputed, validated GIS polylines; manual starts are
calculated on the supplied native 20 m regional grid, never on the 5 m local grid.
Research prototype: slope-only cost classes are not rover safety thresholds.
"""
from __future__ import annotations

import heapq
import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
ROUTES = HERE / 'data' / 'past_life_routing' / 'jezero_past_life_astar_routes_mars_latlon.geojson'
RASTER = HERE / 'data' / 'past_life_routing' / 'jezero_regional_navigation_cost.tif'
VALID_IDS = {'LIFE_001', 'LIFE_002', 'LIFE_003'}
SPEED_M_PER_MIN = 22.0  # illustrative, not astronaut EVA forecast
router = APIRouter(prefix='/api/past-life', tags=['Past-Life regional routing'])

class MarsStart(BaseModel):
    lonEast: float = Field(ge=0, lt=360, allow_inf_nan=False)
    latNorth: float = Field(ge=-90, le=90, allow_inf_nan=False)

class RegionalRouteRequest(BaseModel):
    candidateId: Literal['LIFE_001', 'LIFE_002', 'LIFE_003']
    startMode: Literal['butler', 'manual'] = 'butler'
    startCoordinates: MarsStart | None = None

@lru_cache(maxsize=1)
def source_routes():
    if not ROUTES.is_file():
        raise HTTPException(503, 'Precomputed Past-Life routes are missing')
    data = json.loads(ROUTES.read_text('utf-8'))
    if len(data.get('features', [])) != 6:
        raise HTTPException(503, 'Expected six Past-Life route features')
    parsed = {}
    for f in data['features']:
        p = f['properties']; key = (p['site_id'], p['method'])
        if p['site_id'] not in VALID_IDS or p['method'] not in ('shortest', 'terrain_aware') or key in parsed:
            raise HTTPException(503, 'Unexpected regional route data')
        coords = f['geometry']['coordinates']
        if f['geometry']['type'] != 'LineString' or len(coords) < 2:
            raise HTTPException(503, 'Invalid regional route geometry')
        parsed[key] = (p, coords)
    if len(parsed) != 6:
        raise HTTPException(503, 'Incomplete regional route set')
    return parsed

def response_route(kind, geometry, distance, weighted, source):
    high_fraction = max(0, min(100, (weighted / distance - 1) * 25)) if distance > 0 else 0
    return {
        'id': kind, 'label': 'Shortest route' if kind == 'shortest' else 'Lower-terrain-cost route',
        'geometry': geometry,  # each [Mars east longitude, Mars north latitude], NEVER grid row/col
        'metrics': {
            'distanceMeters': round(distance, 2),
            'traversalCost': round(weighted, 2),
            'estimatedMinutes': round(distance / SPEED_M_PER_MIN, 1),
            'highCostExposurePercent': round(high_fraction, 1),
            'waypoints': len(geometry),
        },
        'source': source,
        'modelNotice': '20 m regional CTX DEM-derived slope-only 1/5/255 prototype; not rover-safe certification',
    }

def butler_routes(site):
    data = source_routes(); routes = []
    for key, method in [('shortest', 'shortest'), ('lower', 'terrain_aware')]:
        p, coords = data[(site, method)]
        routes.append(response_route(key, coords, float(p['distance_m']), float(p['weighted_cost']), 'verified_qgis_precomputed'))
    start = data[(site, 'shortest')][1][0]
    return {
        'status': 'success', 'missionId': 'past-life-jezero', 'candidateId': site,
        'startMode': 'butler', 'startMars': {'lonEast': start[0], 'latNorth': start[1]},
        'routes': routes, 'projection': 'Mars planetocentric north latitude and positive-east longitude',
        'source': 'qgis_precomputed_20m',
        'notices': ['These are precomputed regional QGIS A* routes from the Butler model starting cell.',
                    'Sample coordinates for LIFE_002 and LIFE_003 still require final primary-source verification.',
                    'Model costs and walking time are exploratory, not rover safety guarantees.'],
    }

@router.get('/routes/{site_id}')
def read_routes(site_id: str):
    if site_id not in VALID_IDS:
        raise HTTPException(404, 'Unknown Past-Life science target')
    return butler_routes(site_id)


def octile(r, c, er, ec):
    dr, dc = abs(r-er), abs(c-ec)
    return 20*(max(dr,dc)-min(dr,dc)) + 20*math.sqrt(2)*min(dr,dc)


def search_grid(arr, origin, dest, objective):
    """A* on a bounded raster window; 8-neighbor, no blocked-corner cutting."""
    import numpy as np
    height, width = arr.shape
    sr, sc = origin; er, ec = dest
    n = height*width
    scores = np.full(n, np.inf, dtype=np.float64)
    parent = np.full(n, -1, dtype=np.int32)
    seen = np.zeros(n, dtype=np.uint8)
    start_idx = sr*width+sc; end_idx = er*width+ec
    scores[start_idx] = 0
    queue = [(octile(sr,sc,er,ec),0.0,start_idx)]
    neighbors = [(-1,-1,20*math.sqrt(2)),(-1,0,20),(-1,1,20*math.sqrt(2)),
                 (0,-1,20),(0,1,20),(1,-1,20*math.sqrt(2)),(1,0,20),(1,1,20*math.sqrt(2))]
    explored=0
    while queue:
        _,g,idx=heapq.heappop(queue)
        if g>scores[idx]+1e-7 or seen[idx]:continue
        if idx==end_idx:
            path=[]
            while idx>=0:
                path.append((int(idx//width),int(idx%width)))
                idx=int(parent[idx])
            return path[::-1]
        seen[idx]=1;explored+=1
        if explored>550000:
            raise HTTPException(422, detail={'code':'REGIONAL_SEARCH_LIMIT','message':'This manual start needs a larger regional routing computation. Try a start closer to the selected site.'})
        r,c=divmod(idx,width)
        for dr,dc,step in neighbors:
            rr=r+dr; cc=c+dc
            if rr<0 or rr>=height or cc<0 or cc>=width:continue
            value=arr[rr,cc]
            if value not in (1,5):continue
            if dr and dc and (arr[r+dr,c] not in (1,5) or arr[r,c+dc] not in (1,5)):continue
            next_idx=rr*width+cc
            newg=g+step*(int(value) if objective=='lower' else 1)
            if newg+1e-7<scores[next_idx]:
                scores[next_idx]=newg;parent[next_idx]=idx
                heapq.heappush(queue,(newg+octile(rr,cc,er,ec),newg,next_idx))
    return None


def manual_routes(site, coords):
    try:
        import rasterio
        from pyproj import CRS, Transformer
        from rasterio.windows import Window
    except ImportError:
        raise HTTPException(503, detail={'code':'REGIONAL_DEPENDENCY_MISSING','message':'Install rasterio, pyproj and numpy from requirements.txt for regional manual routing.'})
    if not RASTER.is_file():
        raise HTTPException(503, detail={'code':'REGIONAL_RASTER_MISSING','message':'Regional cost raster not installed. Butler precomputed routes remain available.'})
    # The provided 20 m regional raster has different projection parameters from the local rover grid.
    source = source_routes()[(site,'shortest')][0]
    er,ec=int(source['dest_row']),int(source['dest_col'])
    geographic = CRS.from_proj4('+proj=longlat +R=3396190 +no_defs +type=crs')
    with rasterio.open(RASTER) as ds:
        to_region=Transformer.from_crs(geographic,ds.crs,always_xy=True)
        to_geo=Transformer.from_crs(ds.crs,geographic,always_xy=True)
        xx,yy=to_region.transform(coords.lonEast,coords.latNorth)
        sr,sc=ds.index(xx,yy)
        if not(0<=sr<ds.height and 0<=sc<ds.width):
            raise HTTPException(422, detail={'code':'OUTSIDE_REGIONAL_GRID','message':'Starting Mars coordinates fall outside this Jezero CTX terrain model.'})
        if (sr,sc)==(er,ec):
            raise HTTPException(422, detail={'code':'SAME_POINT','message':'Manual starting coordinates and selected destination resolve to the same 20 m cell.'})
        dx,dy=abs(sr-er),abs(sc-ec)
        if math.hypot(dx,dy)*20>17000:
            raise HTTPException(422, detail={'code':'REGIONAL_DISTANCE_LIMIT','message':'Manual starting point is more than 17 km from this science target. Choose a closer start for this prototype.'})
        # Corridor around start+target; enough for local regional analysis but cannot guarantee
        # a global optimum when a route would have to detour far outside this window.
        margin=160  # 3.2 km on every side
        r0=max(0,min(sr,er)-margin);r1=min(ds.height,max(sr,er)+margin+1)
        c0=max(0,min(sc,ec)-margin);c1=min(ds.width,max(sc,ec)+margin+1)
        if (r1-r0)*(c1-c0)>1200000:
            raise HTTPException(422, detail={'code':'REGIONAL_WINDOW_LIMIT','message':'The requested routing area is too large for the interactive prototype.'})
        arr=ds.read(1,window=Window(c0,r0,c1-c0,r1-r0))
        start_val=arr[sr-r0,sc-c0];end_val=arr[er-r0,ec-c0]
        if start_val not in (1,5):
            raise HTTPException(422, detail={'code':'START_BLOCKED','message':'Manual start falls on blocked or unknown regional terrain. Enter another point.'})
        if end_val not in (1,5):
            raise HTTPException(422, detail={'code':'DESTINATION_BLOCKED','message':'Science target falls on blocked or unknown regional terrain.'})
        result=[]
        for objective in ('shortest','lower'):
            subpath=search_grid(arr,(sr-r0,sc-c0),(er-r0,ec-c0),objective)
            if subpath is None:
                raise HTTPException(422,detail={'code':'REGIONAL_UNREACHABLE','message':'No path was found in the supported regional search window.'})
            path=[(r+r0,c+c0) for r,c in subpath]
            length=weighted=0
            for a,b in zip(path,path[1:]):
                step=20*(math.sqrt(2) if a[0]!=b[0] and a[1]!=b[1] else 1)
                length+=step
                weighted+=step*int(arr[b[0]-r0,b[1]-c0])
            coords_line=[]
            for r,c in path:
                x,y=rasterio.transform.xy(ds.transform,r,c,offset='center')
                lon,lat=to_geo.transform(x,y)
                coords_line.append([lon,lat])
            result.append(response_route(objective,coords_line,length,weighted,'computed_manual_regional_20m'))
    return {
        'status':'success','missionId':'past-life-jezero','candidateId':site,
        'startMode':'manual','startMars':{'lonEast':result[0]['geometry'][0][0],'latNorth':result[0]['geometry'][0][1]},
        'inputMars':{'lonEast':coords.lonEast,'latNorth':coords.latNorth},
        'routes':result,'source':'computed_regional_20m','projection':'Mars planetocentric north latitude and positive-east longitude',
        'notices':['Manual routes are recomputed on a bounded 20 m slope-only planning grid, not the original 5 m Jezero grid.',
                   'Paths may not be globally optimal if a better detour exists outside the 3.2 km search margin.',
                   'Not suitable for live rover or EVA navigation; source sample-coordinate verification remains incomplete.'],
    }

@router.post('/routes/generate')
def create_routes(request: RegionalRouteRequest):
    if request.startMode=='butler':
        if request.startCoordinates is not None:
            raise HTTPException(422, 'Do not send manual coordinates in Butler mode')
        return butler_routes(request.candidateId)
    if request.startCoordinates is None:
        raise HTTPException(422, detail={'code':'MANUAL_START_REQUIRED','message':'Enter both Mars latitude and east longitude.'})
    return manual_routes(request.candidateId,request.startCoordinates)
