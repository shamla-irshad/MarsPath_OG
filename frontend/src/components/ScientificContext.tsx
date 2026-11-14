import '../scientific-context.css';
import {useEffect,useMemo,useState} from 'react';
import {loadEnvironmentalContext,loadSurfaceImages} from '../scienceContext';
import type {EnvironmentalResponse,ScienceImage,ScienceLoad,ScienceObservation,SurfaceImageResponse} from '../scienceContext';
import type {MissionId} from '../types';

function statusName(level:ScienceImage['matchLevel']):string {
  return level==='site_verified'?'Verified site photograph':level==='nearby_verified'?'Verified nearby observation':'Jezero regional context';
}

/** A real rover photograph is shown only as regional context unless its
 * original camera coordinates have been independently matched to a waypoint. */
export function SurfacePhotoView({missionId,candidateId}:{missionId:MissionId;candidateId?:string|null}) {
  const [result,setResult]=useState<ScienceLoad<SurfaceImageResponse>|null>(null);
  const [error,setError]=useState('');
  const [imageError,setImageError]=useState(false);
  useEffect(()=>{
    let live=true;
    loadSurfaceImages().then(data=>{if(live)setResult(data)}).catch(()=>{if(live)setError('Scientific image metadata could not be loaded.');});
    return ()=>{live=false};
  },[]);
  const picture=useMemo(()=>{
    const images=result?.data.images.filter(image=>image.missionId===missionId)||[];
    const exact=images.find(image=>image.matchLevel==='site_verified'&&candidateId&&image.matchedCandidateIds.includes(candidateId));
    const nearby=images.find(image=>image.matchLevel==='nearby_verified'&&candidateId&&image.matchedCandidateIds.includes(candidateId));
    return exact||nearby||images.find(image=>image.matchLevel==='regional_context')||null;
  },[result,missionId,candidateId]);
  useEffect(()=>setImageError(false),[picture?.id]);

  return <section className="science-photo-view" aria-label="NASA rover surface photograph">
    <div className="science-panel-heading"><div><span className="science-eyebrow">MARS 2020 / MASTCAM-Z</span><h2>Surface photograph</h2></div><span className="science-status-tag">Historical · Not live</span></div>
    {!result&&!error&&<p className="science-muted" role="status">Loading NASA image metadata…</p>}
    {error&&<p role="status" className="science-scientific-warning">{error}</p>}
    {picture&&<>
      <div className="science-photo-frame">
        {!imageError?<img src={picture.imageUrl} alt={`Historical ${picture.instrument} photograph: ${picture.title}`} loading="lazy" onError={()=>setImageError(true)}/>:<div className="science-photo-fallback"><p>The image could not be loaded. Open the original NASA publication instead.</p><a href={picture.sourceUrl} target="_blank" rel="noopener noreferrer">View NASA source</a></div>}
        <span className="science-photo-label">{statusName(picture.matchLevel)}</span>
      </div>
      <div className="science-photo-details">
        <h3>{picture.title}</h3>
        <div className="science-photo-facts"><span><b>Sol</b> {picture.sol}</span><span><b>Date</b> {picture.observationDate}</span><span><b>Product</b> {picture.productId}</span></div>
        <p><strong>Camera:</strong> {picture.instrument}</p>
        <p><strong>Photographed location:</strong> {picture.location}</p>
        <p className="science-scientific-warning">{picture.matchLevel==='regional_context'?'This is NOT a photograph taken at your selected destination. It is a genuine photograph from the Jezero landing region.':picture.note}</p>
        <p className="science-photo-credit">{picture.credit} · <a href={picture.sourceUrl} target="_blank" rel="noopener noreferrer">Original NASA image and attribution ↗</a></p>
      </div>
    </>}
    {result&&!picture&&<p className="science-muted">No documented rover photograph is currently associated with this mission region. The orbital map is the geographic reference.</p>}
    {result?.origin==='static'&&<small className="science-muted">Image metadata loaded from the site's static demo snapshot because the API is unavailable.</small>}
  </section>;
}

const categories:[string,ScienceObservation['metric']][]=[
  ['Air temperature','air_temperature'],
  ['Surface temperature','ground_temperature'],
  ['Atmospheric pressure','pressure'],
  ['Wind speed','wind_speed'],
  ['Ionizing radiation','ionizing_radiation_dose_rate'],
];

/** No invented environmental values. All readings require provenance,
 * observation date, site and units in the JSON source record. */
export function EnvironmentalPanel({missionId,compact=false}:{missionId:MissionId;compact?:boolean}) {
  const [result,setResult]=useState<ScienceLoad<EnvironmentalResponse>|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    loadEnvironmentalContext().then(data=>{if(live)setResult(data)}).catch(()=>{if(live)setError('Environmental records are currently unavailable.');});
    return ()=>{live=false};
  },[]);
  const observations=result?.data.observations||[];
  const isJezero=missionId!=='water-ice-arcadia';
  return <section className={`science-environment ${compact?'science-environment-compact':''}`} aria-label="Historical Martian environment">
    <div className="science-panel-heading"><div><span className="science-eyebrow">ENVIRONMENTAL INTELLIGENCE</span><h2>Mission environment</h2></div><span className="science-status-tag">No live feed</span></div>
    <p className="science-muted">Historical environmental context only. No real-time EVA assessment or radiation forecast is connected.</p>
    {!isJezero&&<p className="science-scientific-warning">The supplied observations do not establish conditions at Arcadia Planitia. Jezero and Gale measurements must not be attributed to Arcadia.</p>}
    <div className="science-environment-grid">
      {categories.map(([title,metric])=>{
        // MEDA recordings can be rover-location historical context; RAD's
        // ionizing dose data comes from Gale, always labeled as such.
        const records=isJezero?observations.filter(o=>o.metric===metric):[];
        const obs=records.length?records[records.length-1]:undefined;
        return <div className="science-environment-card" key={metric}>
          <span>{title}</span>
          {obs?<>
            <strong>{Number(obs.value).toLocaleString(undefined,{maximumFractionDigits:3})} <small>{obs.unit}</small></strong>
            <small>{obs.mission} · {obs.instrument}</small>
            <small>{obs.location} · {obs.observationDate}{obs.sol!==null?` · Sol ${obs.sol}`:''}</small>
            <a href={obs.sourceUrl} target="_blank" rel="noopener noreferrer">View original data ↗</a>
          </>:<><strong className="science-no-reading">Not available</strong><small>{metric==='ionizing_radiation_dose_rate'?'No uploaded RAD dose measurements':'No uploaded location-documented readings'}</small></>}
        </div>
      })}
    </div>
    <div className="science-communications"><strong>Communication relay</strong><span>Not modeled · no current coverage prediction</span></div>
    {error&&<p className="science-scientific-warning">{error}</p>}
    {result?.origin==='static'&&<small className="science-muted">Showing the site's static science record snapshot; the backend was unavailable.</small>}
    <details className="science-context-references"><summary>NASA data sources and limitations</summary>
      <p>Perseverance MEDA observes atmospheric conditions in Jezero. MSL RAD measures ionizing radiation at Gale Crater; it must not be presented as a live Jezero dose reading.</p>
      <a href="https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html" target="_blank" rel="noopener noreferrer">NASA PDS MEDA archive ↗</a>
      <a href="https://pds-geosciences.wustl.edu/missions/msl/rad.htm" target="_blank" rel="noopener noreferrer">NASA PDS MSL RAD archive ↗</a>
      <p>Missing data are intentionally shown as unavailable until verified observation files are supplied.</p>
    </details>
  </section>;
}
