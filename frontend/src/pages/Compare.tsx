import MapView from '../MapView';
import {TerrainProfile} from '../Terrain';
import {MissionTimeline} from '../MissionPlanning';
import {formatNumber} from '../api';
import type {Candidate, LayerFlags, MissionId, Page, Point, RouteKind, RouteResponse} from '../types';
import {LabeledMetric, PageHeader, PrimaryButton, Status} from '../components/ui';

type Props = {
  go: (p: Page) => void;
  missionId: MissionId;
  candidates: Candidate[];
  candidate: Candidate | null;
  destination: Point;
  response: RouteResponse | null;
  choice: RouteKind;
  setChoice: (c: RouteKind) => void;
  layers: LayerFlags;
  setLayers: (l: LayerFlags) => void;
  budgetMinutes: number;
  scienceMinutes: number;
};

const ROUTE_ADVICE: Record<RouteKind, string> = {
  shortest: 'Choose this when walking distance matters most. It may cross more higher-cost cells.',
  lower: 'Choose this when avoiding the model\u2019s higher-cost cells matters more, even if the walk is longer.',
  balanced: 'Balances the supplied terrain-cost classes with sampled slope penalties. It is an illustrative risk model, not a certified safety score.',
};

export function Compare({go, missionId, candidates, candidate, destination, response, choice, setChoice, layers, setLayers, budgetMinutes, scienceMinutes}: Props) {
  const routes = response?.routes || [];
  const selected = routes.find((r) => r.id === choice);
  const [a, b] = [routes.find((r) => r.id === 'shortest'), routes.find((r) => r.id === 'lower')];
  const identical = a && b && a.metrics.distanceMeters === b.metrics.distanceMeters && a.metrics.traversalCost === b.metrics.traversalCost;

  return (
    <main id="main-content" tabIndex={-1} className="page-main full-width">
      <PageHeader title="Compare routes">
        Compare three planning objectives: shortest distance, lower terrain cost, and a slope-aware balanced route. None is a guarantee of astronaut safety.
      </PageHeader>

      {!routes.length ? (
        <Status kind="warn">
          No routes have been calculated yet. <button type="button" className="inline-link" onClick={() => go('map')}>Return to Mars Explorer</button> to generate them.
        </Status>
      ) : (
        <div className="comparison-layout">
          <div className="comparison-map">
            <MapView missionId={missionId} candidates={candidates} selectedId={candidate?.id || null} start={response?.start} startMode={response?.startMode} destination={destination} routes={routes} routeChoice={choice} layers={layers} onLayers={setLayers} />
            <div className="route-legend"><span>Solid line: selected route</span><span>Dashed line: other route</span></div>
          </div>

          <div className="comparison-info">
            <div className="route-card-grid">
              {routes.map((r) => (
                <button type="button" key={r.id} className={`route-choice-card ${r.id === choice ? 'active' : ''}`} onClick={() => setChoice(r.id)} aria-pressed={r.id === choice}>
                  <span className="route-card-status">{r.id === choice ? 'Selected' : 'Select this route'}</span>
                  <h2>{r.label}</h2>
                  <p>{ROUTE_ADVICE[r.id]}</p>
                  <div className="route-stat-grid">
                    <LabeledMetric label="Distance" value={`${formatNumber(r.metrics.distanceMeters, 0)} m`} />
                    <LabeledMetric label="Estimated time" value={`${formatNumber(r.metrics.estimatedMinutes, 1)} min`} />
                    <LabeledMetric label="Terrain-cost score" value={formatNumber(r.metrics.traversalCost, 0)} />
                    <LabeledMetric label="Higher-cost terrain" value={`${formatNumber(r.metrics.highCostExposurePercent)}%`} />
                    <LabeledMetric label="Average sampled slope" value={r.metrics.averageSlopeDegrees==null?'Unavailable':`${formatNumber(r.metrics.averageSlopeDegrees)}°`} />
                    <LabeledMetric label="Maximum sampled slope" value={r.metrics.maximumSlopeDegrees==null?'Unavailable':`${formatNumber(r.metrics.maximumSlopeDegrees)}°`} />
                    <LabeledMetric label="Unknown-slope distance" value={`${formatNumber(r.metrics.unknownSlopeDistanceMeters||0,0)} m`} />
                  </div>
                </button>
              ))}
            </div>

            <section className="why-panel">
              <h2>Which should I choose?</h2>
              {identical && <p>Both goals found the same path, so the two routes are identical.</p>}
              {!identical && a && b && (
                <p>
                  The lower-cost route is {formatNumber(b.metrics.distanceMeters - a.metrics.distanceMeters, 0)} m {b.metrics.distanceMeters >= a.metrics.distanceMeters ? 'longer' : 'shorter'} than the shortest route
                  and reduces the terrain-cost score by {formatNumber(a.metrics.traversalCost - b.metrics.traversalCost, 0)}. Higher-cost terrain falls from {formatNumber(a.metrics.highCostExposurePercent)}% to {formatNumber(b.metrics.highCostExposurePercent)}% of the route.
                </p>
              )}
              <p>The shortest route minimises length. The lower-cost route minimises length multiplied by the existing cell cost. The balanced route also applies an illustrative penalty to sampled slope and missing slope data. These are planning scores, not measured energy use, radiation exposure or validated human mobility limits.</p>
            </section>

            {selected && <TerrainProfile route={selected} />}
            {selected && <MissionTimeline route={selected} scienceMinutes={scienceMinutes} budgetMinutes={budgetMinutes} />}
            {selected?.resourceAssessment && <section className="why-panel">
              <h2>Round-trip and astronaut resource planning</h2>
              <div className="route-stat-grid">
                <LabeledMetric label="Return journey" value={`${formatNumber(selected.resourceAssessment.returnMinutes,1)} min`} />
                <LabeledMetric label="Round-trip estimate" value={`${formatNumber(selected.resourceAssessment.estimatedRoundTripMinutes,1)} min`} />
                <LabeledMetric label="Illustrative oxygen use" value={`${formatNumber(selected.resourceAssessment.estimatedOxygenUsePercent)}%`} />
                <LabeledMetric label="Illustrative battery use" value={`${formatNumber(selected.resourceAssessment.estimatedBatteryUsePercent)}%`} />
                <LabeledMetric label="Return reserve" value={`${selected.resourceAssessment.returnReserveMinutes} min`} />
              </div>
              <p><strong>{selected.resourceAssessment.status}</strong> against the configured EVA budget.</p>
              <p>These are transparent simulation assumptions, not actual spacesuit telemetry or a validated life-support model.</p>
            </section>}

            <div className="action-row">
              <PrimaryButton outline onClick={() => go('map')}>Back to Explorer</PrimaryButton>
              <PrimaryButton disabled={!selected} onClick={() => go('navigate')}>Start navigation</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
