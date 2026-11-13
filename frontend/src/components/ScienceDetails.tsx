import type {Candidate} from '../types';
import {getString, missionFacts, positionLabel, candidateNotice} from '../lib/candidates';
import {LabeledMetric} from './ui';

export function ScienceDetails({candidate}: {candidate: Candidate | null}) {
  if (!candidate) return <div className="empty-state">Choose a candidate to inspect its scientific data.</div>;
  const links = (candidate.sources || []).filter((s) => s.startsWith('https://')).slice(0, 3);
  return (
    <div className="science-details">
      <div className="science-id">
        <h3>{candidate.name}</h3>
        <p className="muted">{positionLabel(candidate)}</p>
        <p>{candidateNotice(candidate)}</p>
      </div>
      <div className="detail-metrics">
        {missionFacts(candidate).map((f) => (
          <LabeledMetric key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
      {candidate.missionId === 'past-life-jezero' && (
        <dl className="science-context">
          <dt>Geological context</dt>
          <dd>{getString(candidate.properties.geology_type)}</dd>
          <dt>Scientific interest</dt>
          <dd>{getString(candidate.properties.science_interest)}</dd>
          <dt>Evidence level</dt>
          <dd>{getString(candidate.properties.evidence_level)}</dd>
        </dl>
      )}
      {links.length > 0 && (
        <p className="science-sources">
          References:{' '}
          {links.map((s, i) => (
            <a key={s} href={s} target="_blank" rel="noopener noreferrer">Source {i + 1}</a>
          ))}
        </p>
      )}
    </div>
  );
}
