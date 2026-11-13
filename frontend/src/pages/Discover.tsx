import {useState} from 'react';
import type {Candidate, MissionId, Page} from '../types';
import {MISSIONS} from '../types';
import {Icon, LabeledMetric, PageHeader, PrimaryButton, Status} from '../components/ui';
import {ScienceDetails} from '../components/ScienceDetails';
import {candidateNotice, missionExplanation, missionFacts, positionLabel, propertyText} from '../lib/candidates';

type Props = {
  go: (p: Page) => void;
  missionId: MissionId;
  setMissionId: (m: MissionId) => void;
  candidates: Candidate[];
  source: string;
  candidateId: string | null;
  selectCandidate: (c: Candidate) => void;
  loading: boolean;
};

function CandidateCard({c, selected, comparing, onSelect, onCompare, onDetails}: {
  c: Candidate; selected: boolean; comparing: boolean; onSelect: () => void; onCompare: (on: boolean) => void; onDetails: () => void;
}) {
  const facts = missionFacts(c).slice(0, 3);
  return (
    <article className={`candidate-card ${selected ? 'selected' : ''}`}>
      <header>
        <h3>{c.name}</h3>
        <span className={`pill ${c.routingSupported ? 'pill-good' : 'pill-neutral'}`}>
          {c.routingSupported ? 'Route planning' : c.missionId === 'past-life-jezero' ? 'Regional routing' : 'Science only'}
        </span>
      </header>
      <p className="muted">{positionLabel(c)}</p>
      <dl className="fact-list">
        {facts.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="candidate-note">{candidateNotice(c)}</p>
      <label className="check">
        <input type="checkbox" checked={comparing} onChange={(e) => onCompare(e.target.checked)} />
        Add to comparison
      </label>
      <footer>
        <button type="button" className="btn btn-outline btn-sm" onClick={onDetails}>View details</button>
        <button type="button" className={`btn btn-sm ${selected ? 'btn-selected' : 'btn-primary'}`} onClick={onSelect} aria-pressed={selected}>
          {selected ? 'Selected' : 'Select candidate'}
        </button>
      </footer>
    </article>
  );
}

export function Discover({go, missionId, setMissionId, candidates, source, candidateId, selectCandidate, loading}: Props) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const mission = MISSIONS.find((m) => m.id === missionId)!;
  const compared = candidates.filter((c) => compareIds.includes(c.id));
  const selected = candidates.find((c) => c.id === candidateId) || null;
  const isRover = missionId === 'rover-navigation-jezero';
  const properties = Array.from(new Set(compared.flatMap((c) => Object.keys(c.properties))));

  return (
    <main id="main-content" tabIndex={-1} className="page-main">
      <PageHeader title="Choose your mission">What would you like to investigate on Mars?</PageHeader>

      <section aria-labelledby="mission-step">
        <h2 id="mission-step" className="step-heading"><span>A</span> Select a mission</h2>
        <div className="mission-cards">
          {MISSIONS.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`mission-card ${missionId === m.id ? 'active' : ''}`}
              aria-pressed={missionId === m.id}
              onClick={() => { setMissionId(m.id); setCompareIds([]); setDetailsId(null); }}
            >
              <span className="mission-card-icon"><Icon name={m.icon} size={26} /></span>
              <h3>{m.label}</h3>
              <span className="mission-card-region">{m.region} · {m.capability}</span>
              <p>{m.description}</p>
              <span className="mission-card-data">Data available: {m.science}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="candidate-step">
        <h2 id="candidate-step" className="step-heading"><span>B</span> Choose a candidate location</h2>
        <p className="section-lead">{missionExplanation(missionId)}</p>
        {source === 'local' && <Status kind="warn">The backend is not running, so supplied local records are shown. Start the backend to enable route planning.</Status>}
        {loading ? (
          <div className="empty-state">Loading candidate locations…</div>
        ) : (
          <div className="candidate-grid">
            {candidates.map((c) => (
              <CandidateCard
                key={c.id}
                c={c}
                selected={c.id === candidateId}
                comparing={compareIds.includes(c.id)}
                onSelect={() => selectCandidate(c)}
                onCompare={(on) => setCompareIds((ids) => (on ? [...ids, c.id].slice(-3) : ids.filter((id) => id !== c.id)))}
                onDetails={() => setDetailsId(detailsId === c.id ? null : c.id)}
              />
            ))}
          </div>
        )}
        {detailsId && (
          <div className="detail-panel">
            <div className="detail-panel-head">
              <h3>Candidate details</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailsId(null)}>Close</button>
            </div>
            <ScienceDetails candidate={candidates.find((c) => c.id === detailsId) || null} />
          </div>
        )}
      </section>

      <section aria-labelledby="compare-step">
        <h2 id="compare-step" className="step-heading"><span>C</span> Compare candidates</h2>
        {compared.length < 2 ? (
          <p className="muted">Tick &ldquo;Add to comparison&rdquo; on two or three candidates to compare their {mission.label.toLowerCase()} attributes side by side.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th scope="col">Attribute</th>{compared.map((c) => <th scope="col" key={c.id}>{c.name}</th>)}</tr>
              </thead>
              <tbody>
                {properties.map((key) => (
                  <tr key={key}>
                    <th scope="row">{key.replace(/_/g, ' ')}</th>
                    {compared.map((c) => <td key={c.id}>{propertyText(c, key)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="confirm-step" className="confirm-card">
        <h2 id="confirm-step" className="step-heading"><span>D</span> Confirm and continue</h2>
        {selected ? (
          <dl className="summary-list">
            <div><dt>Mission</dt><dd>{mission.label}</dd></div>
            <div><dt>Candidate</dt><dd>{selected.name}</dd></div>
            <div><dt>Region</dt><dd>{mission.region}</dd></div>
            <div><dt>Objective</dt><dd>{mission.description}</dd></div>
            <div><dt>Route planning</dt><dd>{selected.routingSupported ? 'Available' : missionId === 'past-life-jezero' ? 'Regional model routes available with the backend' : 'Not available. Scientific exploration is still available.'}</dd></div>
          </dl>
        ) : (
          <p className="muted">
            Select a candidate above to continue.{isRover && ' You can also continue without one and choose any point on the local Jezero map.'}
          </p>
        )}
        <div className="action-row">
          <PrimaryButton size="lg" disabled={!selected && !isRover} onClick={() => go('map')}>Continue to Mars Explorer</PrimaryButton>
        </div>
      </section>
      <p className="footnote">Coordinates are Mars east-positive longitude and north latitude (not Earth GPS). Source: GIS team handoff.</p>
    </main>
  );
}
