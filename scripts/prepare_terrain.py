"""Prepare supplied, aligned Mars GeoTIFFs. Development only: Python + numpy + OpenCV."""
from pathlib import Path
import struct,json,hashlib,shutil,sys
import cv2,numpy as np
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'backend/data/terrain_original'
original=root/'backend/data/terrain_original';original.mkdir(exist_ok=True)
public=root/'frontend/public/data/terrain';public.mkdir(parents=True,exist_ok=True)
def tags(path):
 with path.open('rb') as f:
  endian='<' if f.read(2)==b'II' else '>';f.seek(4);offset=struct.unpack(endian+'I',f.read(4))[0];f.seek(offset);n=struct.unpack(endian+'H',f.read(2))[0];entries=[struct.unpack(endian+'HHII',f.read(12)) for _ in range(n)];out={}
  for tag,kind,count,val in entries:
   if tag in (33550,33922,34735,34736,34737,42113):
    f.seek(val);fmt={2:'s',3:'H',12:'d'}[kind];data=struct.unpack(endian+(str(count)+'s' if fmt=='s' else fmt*count),f.read(count*{2:1,3:2,12:8}[kind]));out[tag]=data[0].decode().rstrip('\x00') if kind==2 else list(data)
  return out
data={};meta={}
for key,name in [('elevation','landing_area_dem_1m.tif'),('slope','landing_area_slope_degrees.tif')]:
 path=source/name;t=tags(path);a=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)
 assert a.shape==(2001,2001) and t[33550]==[1,1,0] and t[33922]==[0,0,0,4589872,1094305,0]
 assert t[34736]==[0,0,0,0,0,3396190,3396190,0] and 'Equirectangular Mars' in t[34737]
 valid=np.isfinite(a)&(a!=float(t[42113]));a=np.where(valid,a,np.nan)
 data[key]=a;meta[key]={'file':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'minimum':float(np.nanmin(a)),'maximum':float(np.nanmax(a)),'missingPixels':int((~valid).sum()),'units':'m' if key=='elevation' else 'degrees','tags':t}
 if path.resolve()!=(original/name).resolve():shutil.copy2(path,original/name)
 lo,hi=(float(np.nanmin(a)),float(np.nanmax(a)))
 fraction=np.nan_to_num((a-lo)/(hi-lo));low=np.array([48,57,51]);high=np.array([217,231,184]) if key=='elevation' else np.array([205,173,222]);rgb=(low[None,None,:]+fraction[:,:,None]*(high-low)).astype(np.uint8)
 rgba=np.dstack([rgb[:,:,::-1],valid.astype(np.uint8)*255]);cv2.imwrite(str(public/f'{key}.png'),rgba)
# A navigation cell center is at 2.5 + 5*i m. Index 400 is beyond the 2001 m raster: missing, never clamped.
idx=np.arange(400)*5+2
samples={}
for key,a in data.items():
 sampled=np.full((401,401),np.nan);sampled[:400,:400]=a[np.ix_(idx,idx)]
 samples[key]=[[None if not np.isfinite(v) else round(float(v),3) for v in row] for row in sampled]
(public/'samples.json').write_text(json.dumps(samples,separators=(',',':'),allow_nan=False))
mesh=data['elevation'][::10,::10];(public/'mesh.json').write_text(json.dumps({'stepMeters':10,'offsetMeters':.5,'heights':[[None if not np.isfinite(v) else round(float(v),3) for v in row] for row in mesh]},separators=(',',':'),allow_nan=False))
meta.update({'crs':'Mars 2000 sphere equirectangular, consistent with ESRI:103885','resolutionMeters':1,'width':2001,'height':2001,'bounds':[4589872,1092304,4591873,1094305],'sampling':'Nearest raster pixel at 5 m navigation-cell centers; outer row/column outside raster are null. NoData preserved.','visor':'DEM subsampled at 10 m; rendering may use 20 m triangles. No ground-level photographs.','verticalDatum':'Not independently verified','observationDate':'Not supplied','routing':'Existing 1/5/255 cost model unchanged; slope and elevation are contextual measurements.'})
(public/'metadata.json').write_text(json.dumps(meta,indent=2));print(json.dumps(meta,indent=2))
