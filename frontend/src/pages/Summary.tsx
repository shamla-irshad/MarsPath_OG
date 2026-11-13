import {formatNumber} from '../api';
import {TerrainProfile} from '../Terrain';
import {MissionTimeline} from '../MissionPlanning';
import {MISSIONS} from '../types';
import type {Candidate, MissionId, Page, Point, Route} from '../types';
import {missionExplanation} from '../lib/candidates';
import {LabeledMetric, PageHeader, PrimaryButton, Status} from '../components/ui';
import {ScienceDetails} from '../components/ScienceDetails';

type Props = {
  go: (p: Page) => void;
  onNewMission: () => void;
  missionId: MissionId;
  candidate: Candidate | null;
  destination: Point;
  route: Route | null;
  progress: number;
  completed: boolean;
  source: string;
  budgetMinutes: number;
  scienceMinutes: number;
};

export function Summary({go, onNewMission, missionId, candidate, destination, route, progress, completed, source, budgetMinutes, scienceMinutes}: Props) {
  const mission = MISSIONS.find((m) => m.id === missionId)!;
  const today = new Date().toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
  const intro = route
    ? completed ? 'The simulated route reached its destination.' : 'A route was planned, but the simulation was not completed.'
    : 'Science exploration review. Route planning was not used for this mission.';

  return (
    <main id="main-content" tabIndex={-1} className="page-main summary-page">
      <PageHeader title="Mission summary">{intro}</PageHeader>

      <div className="report-layout">
        <div className="report-main">
          <section className="report-section">
            <h2>Overview</h2>
            <div className="report-metrics">
              <LabeledMetric label="Mission" value={mission.label} />
              <LabeledMetric label="Region" value={mission.region} />
              <LabeledMetric label="Destination" value={candidate?.name || (route ? `Custom grid (${destination.row}, ${destination.col})` : 'None selected')} />
              <LabeledMetric label="Mission type" value={route ? 'Routed simulation' : 'Science only'} />
              <LabeledMetric label="Session date" value={today} />
              <LabeledMetric label="Coordinates" value="Mars east-positive longitude, north latitude" />
            </div>
            <p className="muted">{mission.description}</p>
          </section>

          <section className="report-section">
            <h2>Scientific summary</h2>
            {candidate ? <ScienceDetails candidate={candidate} /> : route ? <Status kind="info">Custom map point: grid row {destination.row}, column {destination.col}. It is not a named science candidate.</Status> : <ScienceDetails candidate={null} />}
          </section>

          {route && (
            <section className="report-section">
              <h2>Route and navigation</h2>
              <p className="muted">{route.label}</p>
              <div className="report-metrics">
                <LabeledMetric label="Distance" value={`${formatNumber(route.metrics.distanceMeters, 0)} m`} />
                <LabeledMetric label="Estimated time" value={`${formatNumber(route.metrics.estimatedMinutes, 1)} min`} />
                <LabeledMetric label="Terrain-cost score" value={formatNumber(route.metrics.traversalCost, 0)} />
                <LabeledMetric label="Simulation progress" value={`${formatNumber(progress, 0)}%`} />
                <LabeledMetric label="Mission time budget" value={`${budgetMinutes} min`} />
                <LabeledMetric label="Science time allowance" value={`${scienceMinutes} min`} />
              </div>
              <TerrainProfile route={route} />
              <MissionTimeline route={route} scienceMinutes={scienceMinutes} budgetMinutes={budgetMinutes} />
              <Status kind={completed ? 'success' : 'warn'}>
                {completed ? 'The simulated route reached its destination.' : 'The simulation was not completed. It must not be reported as a successful Marswalk.'}
              </Status>
            </section>
          )}
        </div>

        <aside className="report-side">
          <section className="report-section">
            <h2>Data and limits</h2>
            <p>{missionExplanation(missionId)}</p>
            <h3>What MarsPath does not claim</h3>
            <p>It has no live Mars positioning, weather or radiation data, is not certified for EVA safety, and does not show proof of past life or confirmed subsurface ice.</p>
            <h3>Data notes</h3>
            <p>Navigation costs are project-derived: 1 (lower), 5 (higher) and 255 (blocked). The local raster is about 2 km wide. The 22 m/min speed is illustrative. Records came from {source === 'api' ? 'the backend API and team handoff' : 'the supplied local GIS file'}.</p>
          </section>
          <section className="report-section report-actions noprint">
            <PrimaryButton onClick={() => window.print()}>Print or save as PDF</PrimaryButton>
            <PrimaryButton outline onClick={() => go('map')}>Back to Mars Explorer</PrimaryButton>
            <PrimaryButton outline onClick={onNewMission}>Plan another mission</PrimaryButton>
            <PrimaryButton outline onClick={() => go('home')}>Return home</PrimaryButton>
          </section>
        </aside>
      </div>
    </main>
  );
}
