import {useCallback, useEffect, useState} from 'react';
import {createSession, getSession} from '../api';
import type {MissionId, Observation, SessionRecord} from '../types';

const KEY = 'marspath_session';
/** One in-flight creation per mission, so React StrictMode cannot create two sessions. */
const inflight = new Map<string, Promise<string>>();

export function storedSessionId(): string | null {
  return sessionStorage.getItem(KEY);
}

/**
 * Return a session id the backend confirms exists for this mission, creating a
 * new session only when there is none (or it belongs to another mission).
 */
export async function ensureSession(missionId: MissionId, candidateId: string | null): Promise<string> {
  const generation = sessionStorage.getItem("marspath_session_generation") || "0";
  const requestKey = `${generation}:${missionId}`;
  const existing = storedSessionId();
  if (existing) {
    try {
      const {session} = await getSession(existing);
      if (session.missionId === missionId) return session.id;
    } catch (error) {
      if ((error as {status?:number}).status !== 404) throw error;
    }
  }
  const running = inflight.get(requestKey);
  if (running) return running;
  const pending = createSession(missionId, candidateId)
    .then(({session}) => {
      if ((sessionStorage.getItem("marspath_session_generation") || "0") === generation) sessionStorage.setItem(KEY, session.id);
      return session.id;
    })
    .finally(() => inflight.delete(requestKey));
  inflight.set(requestKey, pending);
  return pending;
}

export type SessionState = {
  sessionId: string | null;
  session: SessionRecord | null;
  observations: Observation[];
  loading: boolean;
  error: string;
  setObservations: (list: Observation[]) => void;
};

/** Load (or create) the session for a mission and its recorded observations. */
export function useSession(missionId: MissionId, candidateId: string | null, enabled: boolean, refresh = 0): SessionState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError('');
    ensureSession(missionId, candidateId)
      .then(async (id) => {
        if (!live) return null;
        setSessionId(id);
        return getSession(id);
      })
      .then((payload) => {
        if (!live || !payload) return;
        setSession(payload.session);
        setObservations(payload.observations);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setError('The backend is offline, so this session and its observations cannot be loaded.');
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [missionId, candidateId, enabled, refresh]);

  const setObservationsSafe = useCallback((list: Observation[]) => setObservations(list), []);

  return {sessionId, session, observations, loading, error, setObservations: setObservationsSafe};
}

export function resetSession(){sessionStorage.removeItem(KEY);sessionStorage.setItem("marspath_session_generation",String(Date.now())+Math.random());}
