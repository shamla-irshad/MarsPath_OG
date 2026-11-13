import {useState} from 'react';
import {addObservation} from '../api';
import {useSession} from '../lib/session';
import type {MissionId, Observation, ObservationLocation} from '../types';
import {PrimaryButton, Status} from '../components/ui';

const MAX_LENGTH = 2000;

function locationLabel(location: ObservationLocation | null): string {
  if (!location) return '';
  if (typeof location.row === 'number' && typeof location.col === 'number') {
    return `Grid (${location.row}, ${location.col})`;
  }
  if (typeof location.latNorth === 'number' && typeof location.lonEast === 'number') {
    return `${location.latNorth}° N · ${location.lonEast}° E`;
  }
  return '';
}

export function ObservationList({observations}: {observations: Observation[]}) {
  if (!observations.length) return null;
  return (
    <ol className="observation-list">
      {observations.map((observation) => (
        <li key={observation.id}>
          <span className="observation-time">{new Date(observation.created).toLocaleString()}</span>
          <p>{observation.text}</p>
          {locationLabel(observation.location) && <small>{locationLabel(observation.location)}</small>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Records notes the user types. Nothing here is measured, inferred or scored, and
 * a saved note is never reported as a completed observation of a science target.
 */
export function Observations({missionId, candidateId, location, enabled, onRecorded}: {
  missionId: MissionId;
  candidateId: string | null;
  location?: ObservationLocation;
  enabled: boolean;
  onRecorded?: () => void;
}) {
  const {sessionId, observations, setObservations, loading, error: sessionError} = useSession(missionId, candidateId, enabled);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const value = text.trim();
    if (!value) {
      setError('Write the note before saving it.');
      return;
    }
    if (!sessionId) {
      setError('No session is available yet. Start the backend to record observations.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await addObservation(sessionId, value, location);
      setObservations(result.observations);
      setText('');
      onRecorded?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the observation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel-section observations" aria-label="Recorded observations">
      <h2>Observations</h2>
      <p className="muted">Notes you record yourself at the selected location. They are not measurements and are not analysed.</p>
      {!enabled ? (
        <Status kind="warn">The backend is offline, so observations cannot be saved or loaded.</Status>
      ) : (
        <>
          <label className="field">Your note
            <textarea
              rows={3}
              maxLength={MAX_LENGTH}
              value={text}
              disabled={saving || loading}
              placeholder="What did you notice at this location?"
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="observation-meta"><small>{text.length} / {MAX_LENGTH} characters</small></div>
          <PrimaryButton outline disabled={saving || loading} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save observation'}
          </PrimaryButton>
        </>
      )}
      {sessionError && <Status kind="warn">{sessionError}</Status>}
      {error && <Status kind="error">{error}</Status>}
      {enabled && (loading ? (
        <p className="muted">Loading observations…</p>
      ) : observations.length ? (
        <ObservationList observations={observations}/>
      ) : (
        <p className="muted">No observations recorded for this session yet.</p>
      ))}
      <small>Saved to this project&apos;s local session database. Planned science stops are separate.</small>
    </section>
  );
}
