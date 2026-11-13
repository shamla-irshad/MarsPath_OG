"""Integration tests of regional Past-Life routing against the supplied NASA-derived cost GeoTIFF."""
from pathlib import Path
import math

import pytest
from fastapi.testclient import TestClient
from main import app
from past_life_routes import RASTER

client = TestClient(app)

@pytest.mark.parametrize('site', ['LIFE_001','LIFE_002','LIFE_003'])
def test_precomputed_butler_routes_are_complete_and_consistent(site):
    r=client.get(f'/api/past-life/routes/{site}')
    assert r.status_code==200
    d=r.json()
    assert d['candidateId']==site and d['startMode']=='butler'
    assert {route['id'] for route in d['routes']}=={'shortest','lower'}
    assert all(len(route['geometry'])>100 for route in d['routes'])
    assert all(-90 <= lat <=90 and 0<=lon<360 for route in d['routes'] for lon,lat in route['geometry'])
    assert d['routes'][0]['metrics']['distanceMeters']<=d['routes'][1]['metrics']['distanceMeters']+0.01
    assert d['routes'][1]['metrics']['traversalCost']<=d['routes'][0]['metrics']['traversalCost']+0.01

@pytest.mark.parametrize('site', ['LIFE_001','LIFE_002','LIFE_003'])
def test_manually_entered_butler_position_uses_regional_raster(site):
    assert RASTER.is_file()
    response=client.post('/api/past-life/routes/generate',json={'candidateId':site,'startMode':'manual','startCoordinates':{'latNorth':18.44469993,'lonEast':77.4508}})
    assert response.status_code==200, response.text[:400]
    d=response.json()
    assert d['startMode']=='manual' and d['candidateId']==site
    assert all(len(route['geometry'])>2 for route in d['routes'])
    assert d['routes'][1]['metrics']['traversalCost']<=d['routes'][0]['metrics']['traversalCost']+0.1


def test_manual_region_start_rejects_malformed_and_outside():
    response=client.post('/api/past-life/routes/generate',json={'candidateId':'LIFE_001','startMode':'manual'})
    assert response.status_code==422
    response=client.post('/api/past-life/routes/generate',json={'candidateId':'LIFE_001','startMode':'manual','startCoordinates':{'latNorth':60,'lonEast':0}})
    assert response.status_code==422


def test_arcadia_remains_nonroutable():
    r=client.get('/api/missions')
    assert r.status_code==200
    found={m['id']:m['routingAvailable'] for m in r.json()['missions']}
    assert found['past-life-jezero'] is True
    assert found['water-ice-arcadia'] is False


def test_static_geojson_routes_do_not_cross_blocked_pixels():
    import rasterio
    from pyproj import CRS,Transformer
    routes=client.get('/api/past-life/routes/LIFE_003').json()['routes']
    geographic=CRS.from_proj4('+proj=longlat +R=3396190 +no_defs +type=crs')
    with rasterio.open(RASTER) as ds:
        converter=Transformer.from_crs(geographic,ds.crs,always_xy=True)
        for route in routes:
            pixels=[]
            for lon,lat in route['geometry']:
                x,y=converter.transform(lon,lat);r,c=ds.index(x,y)
                pixels.append((r,c))
            r0=max(0,min(p[0] for p in pixels)-1);r1=min(ds.height,max(p[0] for p in pixels)+2)
            c0=max(0,min(p[1] for p in pixels)-1);c1=min(ds.width,max(p[1] for p in pixels)+2)
            raster=ds.read(1,window=((r0,r1),(c0,c1)))
            for r,c in pixels:assert raster[r-r0,c-c0] in (1,5)
            for (r,c),(rr,cc) in zip(pixels,pixels[1:]):
                assert max(abs(rr-r),abs(cc-c))==1
                if rr!=r and cc!=c:
                    assert raster[rr-r0,c-c0] in (1,5)
                    assert raster[r-r0,cc-c0] in (1,5)
