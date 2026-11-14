<<<<<<< HEAD

import { MissionRecord } from './components/MissionRecord';
import { resetSession } from './lib/session';
import ExplorationNotes from './ExplorationNotes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import RegionalMission from './RegionalMission';
import { DataAvailability, PlanningContext } from './MissionPlanning';
import { checkHealth, loadCandidates } from './api';
import { INITIAL_LAYERS, MISSIONS } from './types';
import type { Candidate, LayerFlags, MissionId, Page, Point, RegionalRouteResponse, RouteKind, RouteResponse, StartMode } from './types';
import { PAGE_ORDER, PATHS, pageFromPath } from './routes';
import { Footer, TopBar, WorkflowBar } from './components/Shell';
import { HelpContent } from './components/HelpDialog';
import { Tour } from './components/Tour';
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Explorer } from './pages/Explorer';
import { Compare } from './pages/Compare';
import { Navigate } from './pages/Navigate';
import { Summary } from './pages/Summary';

const MISSION_IDS = MISSIONS.map((m) => m.id);

export default function App() {
    const [sessionEpoch, setSessionEpoch] = useState(0);
    const newSession = () => { resetSession(); setSessionEpoch(v => v + 1) };
    const [regionalResponse, setRegionalResponse] = useState<RegionalRouteResponse | null>(null);
    const dataDialog = useRef<HTMLDialogElement>(null);
    const helpDialog = useRef<HTMLDialogElement>(null);
    const [tourOpen, setTourOpen] = useState(false);
    const [tourSeen, setTourSeen] = useState(() => localStorage.getItem('marspath_tour_seen') === '1');
    const finishTour = () => { localStorage.setItem('marspath_tour_seen', '1'); setTourSeen(true); setTourOpen(false) };
    const [stopIds, setStopIds] = useState<string[]>([]);
    const [page, setPage] = useState<Page>(pageFromPath);

    // Controls when the observation and research sections become visible.
    const [navigationStarted, setNavigationStarted] = useState(false);

    const [missionId, setMissionIdState] = useState<MissionId>(() => { const stored = sessionStorage.getItem('marspath_mission'); return MISSION_IDS.includes(stored as MissionId) ? stored as MissionId : 'rover-navigation-jezero' });
    const [candidateId, setCandidateId] = useState<string | null>(() => sessionStorage.getItem('marspath_candidate'));
    const [destination, setDestination] = useState<Point>({ row: 200, col: 200 }), [routeResponse, setRouteResponse] = useState<RouteResponse | null>(null), [choice, setChoice] = useState<RouteKind>('shortest'), [progress, setProgress] = useState(0), [completed, setCompleted] = useState(false);
    const [startMode, setStartMode] = useState<StartMode>('butler');
    const [manualLat, setManualLat] = useState(''), [manualLon, setManualLon] = useState('');
    const [budgetMinutes, setBudgetMinutes] = useState(90), [scienceMinutes, setScienceMinutes] = useState(10), [returnReserveMinutes, setReturnReserveMinutes] = useState(15);
    const [layers, setLayers] = useState<LayerFlags>(INITIAL_LAYERS), [candidates, setCandidates] = useState<Candidate[]>([]), [source, setSource] = useState(''), [loading, setLoading] = useState(true), [apiReady, setApiReady] = useState(false);

    const setMissionId = (id: MissionId) => {
        newSession();
        setRegionalResponse(null);
        setStopIds([]);
        setMissionIdState(id);
        setStartMode('butler');
        setManualLat('');
        setManualLon('');
        setCandidateId(null);
        setRouteResponse(null);
        setProgress(0);
        setCompleted(false);
        setNavigationStarted(false);
        sessionStorage.setItem('marspath_mission', id);
        sessionStorage.removeItem('marspath_candidate');
    };

    useEffect(() => {
        let live = true;
        setLoading(true);
        loadCandidates(missionId).then(d => {
            if (!live) return;
            setCandidates(d.candidates);
            setSource(d.source);
            setApiReady(d.source === 'api');
            setLoading(false);
            const selected = d.candidates.find(c => c.id === sessionStorage.getItem("marspath_candidate"));
            if (!selected) {
                setCandidateId(null);
                sessionStorage.removeItem('marspath_candidate');
            } else if (selected.localGridPoint) {
                setDestination(selected.localGridPoint);
            }
        }).catch(() => {
            if (live) {
                setCandidates([]);
                setSource('error');
                setApiReady(false);
                setLoading(false);
            }
        });
        return () => { live = false };
    }, [missionId]);

    const needsHealth = page !== "home";

    useEffect(() => {
        if (!needsHealth) return;
        let active = true;
        const refresh = () => checkHealth().then(status => {
            if (active) setApiReady(status?.status === 'ok');
        });
        refresh();
        const timer = window.setInterval(refresh, 5000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [needsHealth]);

    const candidate = candidates.find(c => c.id === candidateId) || null;

    const clearCandidate = () => {
        setCandidateId(null);
        sessionStorage.removeItem('marspath_candidate');
    };

    const choose = (c: Candidate) => {
        setRegionalResponse(null);
        setStopIds(ids => ids.filter(id => id !== c.id));
        setCandidateId(c.id);
        sessionStorage.setItem('marspath_candidate', c.id);
        if (c.localGridPoint) setDestination(c.localGridPoint);
        setRouteResponse(null);
        setProgress(0);
        setCompleted(false);
        setNavigationStarted(false);
    };

    const go = useCallback((p: Page) => {
        // Every new visit to Navigation requires the Start button to be clicked.
        if (p === 'navigate') setNavigationStarted(false);

        if (p === 'home' && page === 'navigate' && progress > 0 && !completed && !window.confirm('Return home? The current simulated navigation session will be interrupted.')) return;

        const target = PATHS[p];
        if (window.location.pathname !== target) window.history.pushState({ marsPath: true }, '', target);
        setPage(p);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [page, progress, completed]);

    const back = () => {
        if (page === 'summary' && !routeResponse) {
            go('map');
            return;
        }
        const idx = PAGE_ORDER.indexOf(page);
        go(idx > 0 ? PAGE_ORDER[idx - 1] : 'home');
    };

    useEffect(() => {
        const handle = () => {
            const next = pageFromPath();
            if (next === 'navigate') setNavigationStarted(false);
            setPage(next);
        };
        window.addEventListener('popstate', handle);
        return () => window.removeEventListener('popstate', handle);
    }, []);

    useEffect(() => {
        if (page === 'compare') setLayers(prev => ({ ...prev, route: true, alternative: true }));
        if (page === 'navigate') setLayers(prev => ({ ...prev, alternative: false }));
    }, [page]);

    const route = useMemo(() => routeResponse?.routes.find(r => r.id === choice) || routeResponse?.routes[0] || null, [routeResponse, choice]);

    const openData = () => dataDialog.current?.showModal();
    const openHelp = () => helpDialog.current?.showModal();

    const resetForMission = () => {
        newSession();
        setStopIds([]);
        setCandidateId(null);
        sessionStorage.removeItem('marspath_candidate');
        setRouteResponse(null);
        setProgress(0);
        setCompleted(false);
        setNavigationStarted(false);
        go('discover');
    };

    const sharedExplorer = { go, missionId, candidates, candidate, layers, setLayers };

    let content;

    if (page === 'home') {
        content = <Home go={go} onSelectMission={(id) => { setMissionId(id); go('discover') }} />;
    } else if (page === 'discover') {
        content = <Discover go={go} missionId={missionId} setMissionId={setMissionId} candidates={candidates} source={source} candidateId={candidateId} selectCandidate={choose} loading={loading} />;
    } else if (missionId === 'past-life-jezero') {
        content = <RegionalMission page={page} go={go} candidate={candidate} candidates={candidates} choose={choose} response={regionalResponse} setResponse={setRegionalResponse} choice={choice} setChoice={setChoice} progress={progress} setProgress={setProgress} layers={layers} setLayers={setLayers} apiReady={apiReady} />;
    } else if (page === 'map') {
        content = <Explorer {...sharedExplorer} clearCandidate={clearCandidate} choose={choose} routeResponse={routeResponse} setRouteResponse={r => { setRouteResponse(r); setProgress(0); setCompleted(false) }} destination={destination} setDestination={setDestination} routeChoice={choice} setRouteChoice={setChoice} apiReady={apiReady} budgetMinutes={budgetMinutes} setBudgetMinutes={setBudgetMinutes} scienceMinutes={scienceMinutes} setScienceMinutes={setScienceMinutes} returnReserveMinutes={returnReserveMinutes} setReturnReserveMinutes={setReturnReserveMinutes} startMode={startMode} setStartMode={setStartMode} manualLat={manualLat} setManualLat={setManualLat} manualLon={manualLon} setManualLon={setManualLon} />;
    } else if (page === 'compare') {
        content = <Compare {...sharedExplorer} destination={destination} response={routeResponse} choice={choice} setChoice={setChoice} budgetMinutes={budgetMinutes} scienceMinutes={scienceMinutes} />;
    } else if (page === 'navigate') {
        content = <Navigate {...sharedExplorer} destination={destination} route={route} progress={progress} setProgress={setProgress} completed={completed} setCompleted={setCompleted} onStarted={() => setNavigationStarted(true)} />;
    } else {
        content = <Summary go={go} onNewMission={resetForMission} missionId={missionId} candidate={candidate} destination={destination} route={route} progress={progress} completed={completed} source={source} budgetMinutes={budgetMinutes} scienceMinutes={scienceMinutes} />;
    }

    const mission = MISSIONS.find(m => m.id === missionId);

    return (
        <PlanningContext.Provider value={{ ids: stopIds, setIds: setStopIds }}>
            <div className="app-shell">
                <a className="skip-link" href="#main-content">Skip to main content</a>

                <TopBar page={page} go={go} back={back} onData={openData} onHelp={openHelp} />

                <WorkflowBar scienceOnly={missionId === 'water-ice-arcadia'} page={page} context={page === 'discover' ? undefined : `${mission?.label} · ${candidate?.name || 'No candidate selected'}`} />

                {page === 'discover' && !tourSeen && (
                    <div className="tour-banner">
                        <span>New to MarsPath? Take a one-minute tour.</span>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setTourOpen(true)}>Start tour</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={finishTour}>Dismiss</button>
                    </div>
                )}

                {content}

                {/* Show Field observations only after the navigation Start button is clicked. */}
                {page === 'navigate' && navigationStarted && (
                    <MissionRecord
                        key={sessionEpoch}
                        missionId={missionId}
                        candidateId={candidateId}
                        page={page}
                        enabled={apiReady}
                        hasRoute={missionId === 'past-life-jezero' ? Boolean(regionalResponse) : Boolean(route)}
                        completed={missionId === 'past-life-jezero' ? progress >= 100 : completed}
                        progress={progress}
                        choice={choice}
                        location={candidate
                            ? { lonEast: candidate.lonEast, latNorth: candidate.latNorth }
                            : missionId === 'rover-navigation-jezero'
                                ? destination
                                : undefined}
                    />
                )}

                {/* Show Report a discovery and Research brief only after Start is clicked. */}
                {page === 'navigate' && navigationStarted && (
                    <section className="shared-science-tools">
                        <ExplorationNotes
                            key={`${missionId}:${candidate?.id || 'overview'}`}
                            missionId={missionId}
                            target={candidate?.id || 'Mission overview'}
                        />
                    </section>
                )}

                <Footer onData={openData} />

                <dialog ref={dataDialog} className="science-dialog" aria-label="Science and data">
                    <button type="button" className="btn btn-outline btn-sm dialog-close" autoFocus onClick={() => dataDialog.current?.close()}>Close</button>
                    <DataAvailability missionId={missionId} />
                </dialog>

                <dialog ref={helpDialog} className="science-dialog" aria-label="Help">
                    <button type="button" className="btn btn-outline btn-sm dialog-close" onClick={() => helpDialog.current?.close()}>Close</button>
                    <HelpContent onTour={() => { helpDialog.current?.close(); setTourOpen(true) }} />
                </dialog>

                <Tour open={tourOpen} onClose={finishTour} />
            </div>
        </PlanningContext.Provider>
    );
=======
import {MissionRecord} from './components/MissionRecord';
import {resetSession} from './lib/session';
import ExplorationNotes from './ExplorationNotes';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import RegionalMission from './RegionalMission';
import {DataAvailability, PlanningContext} from './MissionPlanning';
import {checkHealth, loadCandidates} from './api';
import {INITIAL_LAYERS, MISSIONS} from './types';
import type {Candidate, LayerFlags, MissionId, Page, Point, RegionalRouteResponse, RouteKind, RouteResponse, StartMode} from './types';
import {PAGE_ORDER, PATHS, pageFromPath} from './routes';
import {Footer, TopBar, WorkflowBar} from './components/Shell';
import {HelpContent} from './components/HelpDialog';
import {Tour} from './components/Tour';
import {Home} from './pages/Home';
import {Discover} from './pages/Discover';
import {Explorer} from './pages/Explorer';
import {Compare} from './pages/Compare';
import {Navigate} from './pages/Navigate';
import {Summary} from './pages/Summary';

const MISSION_IDS = MISSIONS.map((m) => m.id);

export default function App(){const [sessionEpoch,setSessionEpoch]=useState(0);const newSession=()=>{resetSession();setSessionEpoch(v=>v+1)};const [regionalResponse,setRegionalResponse]=useState<RegionalRouteResponse|null>(null);const dataDialog=useRef<HTMLDialogElement>(null);const helpDialog=useRef<HTMLDialogElement>(null);const [tourOpen,setTourOpen]=useState(false);const [tourSeen,setTourSeen]=useState(()=>localStorage.getItem('marspath_tour_seen')==='1');const finishTour=()=>{localStorage.setItem('marspath_tour_seen','1');setTourSeen(true);setTourOpen(false)};const [stopIds,setStopIds]=useState<string[]>([]);const [page,setPage]=useState<Page>(pageFromPath);
 const [missionId,setMissionIdState]=useState<MissionId>(()=>{const stored=sessionStorage.getItem('marspath_mission');return MISSION_IDS.includes(stored as MissionId)?stored as MissionId:'rover-navigation-jezero'});
 const [candidateId,setCandidateId]=useState<string|null>(()=>sessionStorage.getItem('marspath_candidate'));
 const [destination,setDestination]=useState<Point>({row:200,col:200}),[routeResponse,setRouteResponse]=useState<RouteResponse|null>(null),[choice,setChoice]=useState<RouteKind>('shortest'),[progress,setProgress]=useState(0),[completed,setCompleted]=useState(false);
 const [startMode,setStartMode]=useState<StartMode>('butler');
 const [manualLat,setManualLat]=useState(''),[manualLon,setManualLon]=useState('');
 const [budgetMinutes,setBudgetMinutes]=useState(90),[scienceMinutes,setScienceMinutes]=useState(10);const [layers,setLayers]=useState<LayerFlags>(INITIAL_LAYERS),[candidates,setCandidates]=useState<Candidate[]>([]),[source,setSource]=useState(''),[loading,setLoading]=useState(true),[apiReady,setApiReady]=useState(false);
 const setMissionId=(id:MissionId)=>{newSession();setRegionalResponse(null);setStopIds([]);setMissionIdState(id);setStartMode('butler');setManualLat('');setManualLon('');setCandidateId(null);setRouteResponse(null);setProgress(0);setCompleted(false);sessionStorage.setItem('marspath_mission',id);sessionStorage.removeItem('marspath_candidate')};
 useEffect(()=>{let live=true;setLoading(true);loadCandidates(missionId).then(d=>{if(!live)return;setCandidates(d.candidates);setSource(d.source);setApiReady(d.source==='api');setLoading(false);
  const selected=d.candidates.find(c=>c.id===sessionStorage.getItem("marspath_candidate"));if(!selected){setCandidateId(null);sessionStorage.removeItem('marspath_candidate')}else if(selected.localGridPoint)setDestination(selected.localGridPoint);
 }).catch(()=>{if(live){setCandidates([]);setSource('error');setApiReady(false);setLoading(false)}});return ()=>{live=false}},[missionId]);
 const needsHealth=page!=="home";
 useEffect(()=>{if(!needsHealth)return;let active=true; const refresh=()=>checkHealth().then(status=>{if(active)setApiReady(status?.status==='ok')}); refresh(); const timer=window.setInterval(refresh,5000); return()=>{active=false;window.clearInterval(timer)}},[needsHealth]);
 const candidate=candidates.find(c=>c.id===candidateId)||null;
 const clearCandidate=()=>{setCandidateId(null);sessionStorage.removeItem('marspath_candidate')};
 const choose=(c:Candidate)=>{setRegionalResponse(null);setStopIds(ids=>ids.filter(id=>id!==c.id));setCandidateId(c.id);sessionStorage.setItem('marspath_candidate',c.id);if(c.localGridPoint)setDestination(c.localGridPoint);setRouteResponse(null);setProgress(0);setCompleted(false)};
 const go=useCallback((p:Page)=>{if(p==='home'&&page==='navigate'&&progress>0&&!completed&&!window.confirm('Return home? The current simulated navigation session will be interrupted.'))return;const target=PATHS[p];if(window.location.pathname!==target)window.history.pushState({marsPath:true},'',target);setPage(p);window.scrollTo({top:0,behavior:'instant'})},[page,progress,completed]);
 const back=()=>{if(page==='summary'&&!routeResponse){go('map');return;}const idx=PAGE_ORDER.indexOf(page);go(idx>0?PAGE_ORDER[idx-1]:'home')};
 useEffect(()=>{const handle=()=>setPage(pageFromPath());window.addEventListener('popstate',handle);return ()=>window.removeEventListener('popstate',handle)},[]);
 useEffect(()=>{if(page==='compare')setLayers(prev=>({...prev,route:true,alternative:true}));if(page==='navigate')setLayers(prev=>({...prev,alternative:false}));},[page]);
 const route=useMemo(()=>routeResponse?.routes.find(r=>r.id===choice)||routeResponse?.routes[0]||null,[routeResponse,choice]);

 const openData=()=>dataDialog.current?.showModal();
 const openHelp=()=>helpDialog.current?.showModal();
 const resetForMission=()=>{newSession();setStopIds([]);setCandidateId(null);sessionStorage.removeItem('marspath_candidate');setRouteResponse(null);setProgress(0);setCompleted(false);go('discover')};
 const sharedExplorer={go,missionId,candidates,candidate,layers,setLayers};
 let content;
 if(page==='home'){
  content=<Home go={go} onSelectMission={(id)=>{setMissionId(id);go('discover')}}/>;
 }else if(page==='discover'){
  content=<Discover go={go} missionId={missionId} setMissionId={setMissionId} candidates={candidates} source={source} candidateId={candidateId} selectCandidate={choose} loading={loading}/>;
 }else if(missionId==='past-life-jezero'){
  content=<RegionalMission page={page} go={go} candidate={candidate} candidates={candidates} choose={choose} response={regionalResponse} setResponse={setRegionalResponse} choice={choice} setChoice={setChoice} progress={progress} setProgress={setProgress} layers={layers} setLayers={setLayers} apiReady={apiReady}/>;
 }else if(page==='map'){
  content=<Explorer {...sharedExplorer} clearCandidate={clearCandidate} choose={choose} routeResponse={routeResponse} setRouteResponse={r=>{setRouteResponse(r);setProgress(0);setCompleted(false)}} destination={destination} setDestination={setDestination} routeChoice={choice} setRouteChoice={setChoice} apiReady={apiReady} budgetMinutes={budgetMinutes} setBudgetMinutes={setBudgetMinutes} scienceMinutes={scienceMinutes} setScienceMinutes={setScienceMinutes} startMode={startMode} setStartMode={setStartMode} manualLat={manualLat} setManualLat={setManualLat} manualLon={manualLon} setManualLon={setManualLon}/>;
 }else if(page==='compare'){
  content=<Compare {...sharedExplorer} destination={destination} response={routeResponse} choice={choice} setChoice={setChoice} budgetMinutes={budgetMinutes} scienceMinutes={scienceMinutes}/>;
 }else if(page==='navigate'){
  content=<Navigate {...sharedExplorer} destination={destination} route={route} progress={progress} setProgress={setProgress} completed={completed} setCompleted={setCompleted}/>;
 }else{
  content=<Summary go={go} onNewMission={resetForMission} missionId={missionId} candidate={candidate} destination={destination} route={route} progress={progress} completed={completed} source={source} budgetMinutes={budgetMinutes} scienceMinutes={scienceMinutes}/>;
 }
 const mission=MISSIONS.find(m=>m.id===missionId);
 return (
  <PlanningContext.Provider value={{ids:stopIds,setIds:setStopIds}}>
   <div className="app-shell"><a className="skip-link" href="#main-content">Skip to main content</a>
    <TopBar page={page} go={go} back={back} onData={openData} onHelp={openHelp}/>
    <WorkflowBar scienceOnly={missionId==='water-ice-arcadia'} page={page} context={page==='discover'?undefined:`${mission?.label} · ${candidate?.name||'No candidate selected'}`}/>
    {page==='discover'&&!tourSeen&&(
     <div className="tour-banner">
      <span>New to MarsPath? Take a one-minute tour.</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={()=>setTourOpen(true)}>Start tour</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={finishTour}>Dismiss</button>
     </div>
    )}
    {content}
    <MissionRecord key={sessionEpoch} missionId={missionId} candidateId={candidateId} page={page} enabled={apiReady} hasRoute={missionId==='past-life-jezero'?Boolean(regionalResponse):Boolean(route)} completed={missionId==='past-life-jezero'?progress>=100:completed} progress={progress} choice={choice} location={candidate?{lonEast:candidate.lonEast,latNorth:candidate.latNorth}:missionId==='rover-navigation-jezero'?destination:undefined}/>
    {page!=='home'&&(missionId!=='past-life-jezero'||page==='discover')&&<section className="shared-science-tools"><ExplorationNotes key={`${missionId}:${candidate?.id||'overview'}`} missionId={missionId} target={candidate?.id||'Mission overview'}/></section>}
    <Footer onData={openData}/>
    <dialog ref={dataDialog} className="science-dialog" aria-label="Science and data">
     <button type="button" className="btn btn-outline btn-sm dialog-close" autoFocus onClick={()=>dataDialog.current?.close()}>Close</button>
     <DataAvailability missionId={missionId}/>
    </dialog>
    <dialog ref={helpDialog} className="science-dialog" aria-label="Help">
     <button type="button" className="btn btn-outline btn-sm dialog-close" onClick={()=>helpDialog.current?.close()}>Close</button>
     <HelpContent onTour={()=>{helpDialog.current?.close();setTourOpen(true)}}/>
    </dialog>
    <Tour open={tourOpen} onClose={finishTour}/>
   </div>
  </PlanningContext.Provider>
 );
>>>>>>> e40c8077cf500f1707a055744bc00b935020404b
}
