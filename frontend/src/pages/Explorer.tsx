
import { gridToLonLat } from '../mapMetadata';
import { useContext, useEffect, useRef, useState } from 'react';
import MapView from '../MapView';
import { TerrainReadout } from '../Terrain';
import { PlanningContext, ScienceStops } from '../MissionPlanning';
import { getCell, planRoutes, resolveManualStart } from '../api';
import { MISSIONS } from '../types';
import type { Candidate, LayerFlags, MarsCoordinates, MissionId, Page, Point, RouteKind, RouteResponse, StartMode } from '../types';
import { PageHeader, PrimaryButton, Status } from '../components/ui';
import { ScienceDetails } from '../components/ScienceDetails';

export function Explorer({ go, missionId, candidates, candidate, choose, clearCandidate, routeResponse, setRouteResponse, destination, setDestination, routeChoice, setRouteChoice, layers, setLayers, apiReady, budgetMinutes, setBudgetMinutes, scienceMinutes, setScienceMinutes, returnReserveMinutes, setReturnReserveMinutes, startMode, setStartMode, manualLat, setManualLat, manualLon, setManualLon }: {
  go: (p: Page) => void; missionId: MissionId; candidates: Candidate[]; candidate: Candidate | null;
  choose: (c: Candidate) => void; clearCandidate: () => void;
  routeResponse: RouteResponse | null; setRouteResponse: (r: RouteResponse | null) => void;
  destination: Point; setDestination: (p: Point) => void;
  routeChoice: RouteKind; setRouteChoice: (c: RouteKind) => void;
  layers: LayerFlags; setLayers: (l: LayerFlags) => void; apiReady: boolean;
  budgetMinutes: number; setBudgetMinutes: (n: number) => void;
  scienceMinutes: number; setScienceMinutes: (n: number) => void;
  returnReserveMinutes: number; setReturnReserveMinutes: (n: number) => void;
  startMode: StartMode; setStartMode: (mode: StartMode) => void;
  manualLat: string; setManualLat: (value: string) => void;
  manualLon: string; setManualLon: (value: string) => void;
}) {
  const { ids: scienceStopIds } = useContext(PlanningContext);
  const isRover = missionId === 'rover-navigation-jezero';
  const mission = MISSIONS.find(m => m.id === missionId)!;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [cellInfo, setCellInfo] = useState('');
  const [customSelected, setCustomSelected] = useState(false);
  const [pickStart, setPickStart] = useState(false);
  const [resolvedStart, setResolvedStart] = useState<Point | null>(routeResponse?.startMode === 'manual' ? routeResponse.start : null);
  const [snapNotice, setSnapNotice] = useState('');

  const switchMode = (value: StartMode) => {
    setStartMode(value);
    invalidate();
    setResolvedStart(null);
    setSnapNotice('');
    setCellInfo('');
  };

  const updateLat = (value: string) => {
    setManualLat(value);
    invalidate();
    setResolvedStart(null);
    setSnapNotice('');
  };

  const updateLon = (value: string) => {
    setManualLon(value);
    invalidate();
    setResolvedStart(null);
    setSnapNotice('');
  };

  // Ignore a previous response if the user has already tapped a new destination.
  const requestSequence = useRef(0);
  const autoRoutedCandidate = useRef<string | null>(null);

  const invalidate = () => {
    requestSequence.current += 1;
    setRouteResponse(null);
    setPending(false);
    setError('');
  };

  const validGridPoint = (p: Point) =>
    Number.isInteger(p.row) &&
    Number.isInteger(p.col) &&
    p.row >= 0 &&
    p.row <= 400 &&
    p.col >= 0 &&
    p.col <= 400;

  // A* uses one of exactly two Jezero starts: Butler or manually entered Mars coordinates.
  // Both are constrained to the local 401×401 grid. No Arcadia/Past-Life routing yet.
  const calculate = async (p: Point, candidateId: string | null) => {
    const seq = ++requestSequence.current;

    setRouteResponse(null);
    setError('');
    setPending(false);
    setRouteChoice('shortest');
    setResolvedStart(null);
    setSnapNotice('');

    if (!validGridPoint(p)) {
      setError('Destination is outside the available 401 × 401 grid.');
      return;
    }

    if (!apiReady) {
      setError('FastAPI is offline. Start start_all_windows.bat first.');
      return;
    }

    let manualCoords: MarsCoordinates | undefined;

    if (startMode === 'manual') {
      if (manualLat.trim() === '' || manualLon.trim() === '') {
        setError('Enter both Mars latitude and longitude for the manual starting option.');
        return;
      }

      const latNorth = Number(manualLat);
      const lonEast = Number(manualLon);

      if (
        !Number.isFinite(latNorth) ||
        !Number.isFinite(lonEast) ||
        latNorth < -90 ||
        latNorth > 90 ||
        lonEast < 0 ||
        lonEast >= 360
      ) {
        setError('Enter valid Mars coordinates: latitude −90° to 90°, east longitude 0° to less than 360°.');
        return;
      }

      manualCoords = { latNorth, lonEast };
    }

    setPending(true);
    setCellInfo(`Checking destination cell ${p.row}, ${p.col}…`);

    try {
      let effectiveStart: Point = { row: 200, col: 200 };

      if (manualCoords) {
        const resolved = await resolveManualStart(manualCoords);

        if (seq !== requestSequence.current) return;

        effectiveStart = resolved.start;
        setResolvedStart(effectiveStart);

        setSnapNotice(
          `Manual Mars position → grid (${effectiveStart.row}, ${effectiveStart.col}), model cost ${resolved.terrainCost}; snapped ${resolved.snapDistanceMeters} m to cell center.`
        );
      }

      if (effectiveStart.row === p.row && effectiveStart.col === p.col) {
        setError('Start and destination are in the same 5 m grid cell. Choose another destination.');
        return;
      }

      const cell = await getCell(p);

      if (seq !== requestSequence.current) return;

      if (!cell.traversable) {
        setCellInfo(`Blocked / unknown terrain at grid ${p.row}, ${p.col}`);
        setError('Destination is blocked in the NASA-derived model grid. Tap another point.');
        return;
      }

      setCellInfo(
        `Destination grid ${p.row}, ${p.col} · model terrain cost ${cell.cost} (${cell.cost === 1 ? 'lower' : 'higher'}).`
      );

      const stops = scienceStopIds.filter(id => id !== candidateId);

      const conflict = stops.find(id => {
        const q = candidates.find(c => c.id === id)?.localGridPoint;

        return q && (
          (q.row === p.row && q.col === p.col) ||
          (q.row === effectiveStart.row && q.col === effectiveStart.col)
        );
      });

      if (conflict) {
        setError(`Remove ${conflict} from optional stops: it coincides with your start or destination.`);
        return;
      }

      const result = await planRoutes(
        p,
        candidateId,
        startMode,
        manualCoords,
        stops,
        budgetMinutes,
        scienceMinutes,
        returnReserveMinutes
      );

      if (seq !== requestSequence.current) return;

      setRouteResponse(result);
      setResolvedStart(result.start);
      setLayers({ ...layers, route: true, alternative: true });

    } catch (ex) {
      if (seq === requestSequence.current) {
        setError(
          ex instanceof Error
            ? ex.message
            : 'Could not calculate a route with these coordinates.'
        );
      }
    } finally {
      if (seq === requestSequence.current) setPending(false);
    }
  };

  const selectStart = async (p: Point) => {
    invalidate();
    const seq = requestSequence.current;
    setPending(true);

    try {
      const cell = await getCell(p);

      if (seq !== requestSequence.current) return;

      if (!cell.traversable) {
        setError('This start is blocked or has no terrain data. Choose another point.');
        return;
      }

      const coords = gridToLonLat(p);

      setManualLat(String(coords.latNorth));
      setManualLon(String(coords.lonEast));
      setStartMode('manual');
      setResolvedStart(p);
      setPickStart(false);

      setSnapNotice('Starting point selected on map. Choose a destination, then generate your route.');

    } catch {
      if (seq === requestSequence.current) {
        setError('Could not validate this start. Check the backend connection.');
      }
    } finally {
      if (seq === requestSequence.current) setPending(false);
    }
  };

  const chooseAndRoute = (c: Candidate) => {
    autoRoutedCandidate.current = c.id;
    choose(c);
    setCustomSelected(false);
    invalidate();
    setCellInfo('');

    if (!isRover) return;

    if (!c.routingSupported || !c.localGridPoint) {
      setError('This science candidate is outside the supported local navigation grid.');
      return;
    }

    setDestination(c.localGridPoint);
    void calculate(c.localGridPoint, c.id);
  };

  const chooseCustom = (p: Point, fromMap: boolean) => {
    invalidate();
    clearCandidate();
    setCustomSelected(true);
    setDestination(p);
    setCellInfo('');

    if (fromMap) void calculate(p, null);
  };

  // A/B/C selected in Mission Discovery should route automatically on first opening the map.
  useEffect(() => {
    if (
      !isRover ||
      !apiReady ||
      !candidate?.localGridPoint ||
      !candidate.routingSupported ||
      routeResponse?.routes.length
    ) return;

    if (autoRoutedCandidate.current === candidate.id) return;

    autoRoutedCandidate.current = candidate.id;
    void calculate(candidate.localGridPoint, candidate.id);
  }, [isRover, apiReady, candidate?.id]);

  useEffect(() => () => { requestSequence.current += 1; }, []);

  const selectedHasRoute = Boolean(routeResponse?.routes.length);

  const preferredRoute =
    routeResponse?.routes.find(r => r.id === routeChoice) ||
    routeResponse?.routes[0];

  return (
    <main id="main-content" tabIndex={-1} className="workspace-page">
      <PageHeader
        title={mission.label}
        actions={<>
          <PrimaryButton outline onClick={() => go('discover')}>
            Change mission
          </PrimaryButton>

          <PrimaryButton outline onClick={() => go('summary')}>
            {isRover ? 'Skip routing and view summary' : 'Continue to summary'}
          </PrimaryButton>
        </>}
      >
        {mission.region} · {isRover ? 'Local routing area, about 2 km × 2 km' : 'Geographic candidate overview (science only)'}
      </PageHeader>

      {isRover && (
        <p className="tip" role="note">
          {pickStart
            ? 'Tap your starting point on the map.'
            : 'Candidate outlines are study areas. Routes use representative points; both alternatives use the same terrain-cost model.'}
        </p>
      )}

      <div className="workspace-grid">
        <aside className="sidebar" aria-label="Mission controls">
          <section className="panel-section">
            <h2>{isRover ? 'Destination' : 'Candidate'}</h2>

            <label className="field">
              Choose a location

              <select
                aria-label="Destination"
                value={candidate?.id || 'custom'}
                onChange={e => {
                  setPickStart(false);
                  const c = candidates.find(c => c.id === e.target.value);

                  if (c) {
                    chooseAndRoute(c);
                  } else {
                    clearCandidate();
                    invalidate();
                    setCustomSelected(true);
                  }
                }}
              >
                <option value="custom">Select a point on the map</option>

                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.geometry.type === 'Polygon' ? ' — study area' : ''}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {isRover ? (
            <>
              <section className="panel-section">
                <h2>Starting point</h2>

                <fieldset className="option-group">
                  <legend className="visually-hidden">Starting point</legend>

                  <label className={startMode === 'butler' ? 'active' : ''}>
                    <input
                      type="radio"
                      name="jezero-start-mode"
                      value="butler"
                      checked={startMode === 'butler'}
                      onChange={() => {
                        setPickStart(false);
                        switchMode('butler');
                      }}
                    />

                    <span>
                      <strong>Landing point</strong>
                      <small>Octavia E. Butler reference, grid (200, 200)</small>
                    </span>
                  </label>

                  <label className={startMode === 'manual' ? 'active' : ''}>
                    <input
                      type="radio"
                      name="jezero-start-mode"
                      value="manual"
                      checked={startMode === 'manual'}
                      onChange={() => {
                        switchMode('manual');
                        setPickStart(true);
                      }}
                    />

                    <span>
                      <strong>Choose start on map</strong>
                      <small>Select a supported point on the map</small>
                    </span>
                  </label>
                </fieldset>

                {startMode === 'manual' && (
                  <div className="manual-mars-coordinates">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setPickStart(v => !v)}
                    >
                      {pickStart ? 'Selecting start · cancel' : 'Change start on map'}
                    </button>

                    <details>
                      <summary>Advanced start coordinates</summary>

                      <div className="two-inputs">
                        <label className="field">
                          Latitude (°N)

                          <input
                            type="number"
                            step="any"
                            min="-90"
                            max="90"
                            aria-label="Manual Mars start latitude"
                            placeholder="18.44383094"
                            value={manualLat}
                            onChange={e => updateLat(e.target.value)}
                          />
                        </label>

                        <label className="field">
                          Longitude (°E)

                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="359.999999"
                            aria-label="Manual Mars start east longitude"
                            placeholder="77.45082964"
                            value={manualLon}
                            onChange={e => updateLon(e.target.value)}
                          />
                        </label>
                      </div>

                      <small>
                        Example: 18.44383094° N, 77.45082964° E (grid 210, 200).
                        Positions must lie inside the local Jezero grid. Elevation is not needed.
                      </small>
                    </details>
                  </div>
                )}

                {snapNotice && <Status kind="info">{snapNotice}</Status>}
              </section>

              <section className="panel-section">
                <details>
                  <summary>Advanced destination coordinates</summary>

                  <div className="field">
                    <span className="field-label">Grid row and column (5 m cells)</span>

                    <div className="two-inputs">
                      <input
                        type="number"
                        min="0"
                        max="400"
                        value={destination.row}
                        aria-label="Destination row"
                        onChange={e => chooseCustom({
                          ...destination,
                          row: e.target.value === '' ? 0 : Number(e.target.value)
                        }, false)}
                      />

                      <input
                        type="number"
                        min="0"
                        max="400"
                        value={destination.col}
                        aria-label="Destination column"
                        onChange={e => chooseCustom({
                          ...destination,
                          col: e.target.value === '' ? 0 : Number(e.target.value)
                        }, false)}
                      />
                    </div>

                    <small>
                      Or select a point on the map to calculate immediately.
                      These are local grid cells, not longitude and latitude.
                    </small>
                  </div>
                </details>

                {cellInfo && <Status kind="info">{cellInfo}</Status>}

                <PrimaryButton
                  disabled={pending || !apiReady}
                  onClick={() => void calculate(
                    destination,
                    candidate?.localGridPoint?.row === destination.row &&
                      candidate?.localGridPoint?.col === destination.col
                      ? candidate?.id ?? null
                      : null
                  )}
                >
                  {pending ? 'Calculating routes…' : 'Generate routes'}
                </PrimaryButton>

                {pending && (
                  <Status>
                    Calculating three route options using distance, terrain cost and sampled slope…
                  </Status>
                )}

                {error && <Status kind="error">{error}</Status>}

                {!apiReady && (
                  <Status kind="warn">
                    The backend is offline. Route planning needs the FastAPI server.
                  </Status>
                )}
              </section>

              {selectedHasRoute && (
                <section className="panel-section route-preview" aria-label="Generated routes">
                  <Status kind="success">
                    Route options generated successfully.
                  </Status>

                  <p>
                    Compare the available route options, or start navigation using the currently selected route.
                  </p>

                  <div
                    className="route-preview-actions"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '10px'
                    }}
                  >
                    <PrimaryButton onClick={() => go('compare')}>
                      Compare all routes
                    </PrimaryButton>

                    <PrimaryButton
                      disabled={!preferredRoute}
                      onClick={() => go('navigate')}
                    >
                      Start navigation
                    </PrimaryButton>
                  </div>
                </section>
              )}

              <details className="panel-section collapsible">
                <summary>Planning options</summary>

                <label className="field">
                  EVA time budget

                  <select
                    value={budgetMinutes}
                    onChange={e => setBudgetMinutes(Number(e.target.value))}
                  >
                    {[60, 90, 120, 180].map(m => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>

                  <small>Planning reference only. No live suit data is used.</small>
                </label>

                <label className="field">
                  Science observation time

                  <select
                    value={scienceMinutes}
                    onChange={e => setScienceMinutes(Number(e.target.value))}
                  >
                    {[0, 10, 20, 30].map(m => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Protected return reserve

                  <select
                    value={returnReserveMinutes}
                    onChange={e => setReturnReserveMinutes(Number(e.target.value))}
                  >
                    {[10, 15, 20, 30].map(m => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>

                  <small>
                    Reserved time is subtracted from the available EVA planning budget.
                  </small>
                </label>

                <ScienceStops
                  candidates={candidates}
                  destinationId={candidate?.id || null}
                  route={preferredRoute}
                  onChange={invalidate}
                />
              </details>

              <p className="footnote">
                Routing covers the local 401 × 401 grid (about 2 km),
                not all of Jezero Crater.
              </p>
            </>
          ) : (
            <Status kind="info">
              This mission is science only: no aligned navigation grid exists
              for this region, so routes are not offered. You can still review
              the candidate data and continue to the summary.
            </Status>
          )}
        </aside>

        <section className="map-panel" aria-label="Map">
          <div className="map-header">
            <strong>{isRover ? 'Jezero orbital imagery' : 'Mars science view'}</strong>

            <small>
              {isRover
                ? 'Select a point to route · drag to pan · scroll to zoom'
                : 'Drag to pan · scroll to zoom · use Layers to show or hide data'}
            </small>
          </div>

          <MapView
            missionId={missionId}
            candidates={candidates}
            selectedId={candidate?.id || null}
            onChoose={id => {
              const c = candidates.find(x => x.id === id);

              if (c) {
                if (pickStart && c.localGridPoint) {
                  void selectStart(c.localGridPoint);
                } else {
                  chooseAndRoute(c);
                }
              }
            }}
            start={
              isRover
                ? (routeResponse?.start || (startMode === 'manual' ? resolvedStart : null) || undefined)
                : undefined
            }
            startMode={startMode}
            destination={
              isRover && (candidate || customSelected || routeResponse)
                ? destination
                : undefined
            }
            onSelectGrid={
              isRover
                ? p => {
                  if (pickStart) {
                    void selectStart(p);
                  } else {
                    chooseCustom(p, true);
                  }
                }
                : undefined
            }
            onInvalidGridTap={
              isRover
                ? () => {
                  invalidate();
                  setError('Select a point inside the square Jezero image. Outside it, no terrain-cost grid is available.');
                }
                : undefined
            }
            routes={routeResponse?.routes || []}
            routeChoice={routeChoice}
            layers={layers}
            onLayers={setLayers}
          />
        </section>

        <aside className="sidebar science-sidebar" aria-label="Location details">
          <section className="panel-section">
            <h2>
              {candidate
                ? 'Candidate details'
                : customSelected
                  ? 'Custom destination'
                  : 'Location details'}
            </h2>

            {candidate
              ? <ScienceDetails candidate={candidate} />
              : customSelected ? (
                <div className="science-id">
                  <h3>Grid ({destination.row}, {destination.col})</h3>

                  <p>
                    A point you selected on the map. It uses the same derived
                    cost grid as JEZERO A, B and C, but has not been analysed
                    as a science candidate.
                  </p>
                </div>
              )
                : <div className="empty-state">
                  Select a candidate, or select an open point on the Jezero map.
                </div>
            }
          </section>

          {isRover && <TerrainReadout point={destination} />}
        </aside>
      </div>
    </main>
  );
}
