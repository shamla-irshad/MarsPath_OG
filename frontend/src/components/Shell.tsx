import {useState} from 'react';
import type {Page} from '../types';
import {PAGE_NAMES} from '../routes';

type GoFn = (page: Page) => void;

/** Workflow stages shown on every page after Home. */
const STAGES: {label: string; pages: Page[]}[] = [
  {label: 'Mission', pages: ['discover']},
  {label: 'Explore', pages: ['map']},
  {label: 'Plan', pages: ['compare']},
  {label: 'Navigate', pages: ['navigate']},
  {label: 'Review', pages: ['summary']},
];

export function TopBar({page, go, back, onData, onHelp}: {page: Page; go: GoFn; back: () => void; onData: () => void; onHelp: () => void}) {
  const [open, setOpen] = useState(false);
  const scrollTo = (id: string) => {
    setOpen(false);
    if (page !== 'home') go('home');
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({behavior: 'smooth'}), 60);
  };
  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={() => go('home')} aria-label="MarsPath home">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">MarsPath</span>
      </button>
      <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main navigation">
        <button type="button" className={page === 'discover' ? 'active' : ''} onClick={() => { setOpen(false); go('discover'); }}>Explore Mars</button>
        <button type="button" onClick={() => scrollTo('how-it-works')}>How it works</button>
        <button type="button" onClick={() => scrollTo('about')}>About</button>
        <button type="button" onClick={() => { setOpen(false); onData(); }}>Science &amp; data</button>
        <button type="button" onClick={() => { setOpen(false); onHelp(); }}>Help</button>
      </nav>
      <div className="nav-actions">
        {page !== 'home' && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={back}>Back</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => go('home')}>Home</button>
          </>
        )}
        <button type="button" className="menu-toggle" aria-expanded={open} aria-label="Toggle menu" onClick={() => setOpen((v) => !v)}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}

export function WorkflowBar({page, context,scienceOnly=false}: {page: Page; context?: string;scienceOnly?:boolean}) {
  if (page === 'home') return null;
  const stages=scienceOnly?STAGES.filter(s=>!['Plan','Navigate'].includes(s.label)):STAGES;
  const current = stages.findIndex((s) => s.pages.includes(page));
  return (
    <div className="workflow-bar">
      <ol className="workflow" aria-label="Progress">
        {stages.map((stage, i) => (
          <li key={stage.label} className={i === current ? 'current' : i < current ? 'done' : ''} aria-current={i === current ? 'step' : undefined}>
            <span className="workflow-index">{i < current ? '✓' : i + 1}</span>
            {stage.label}
          </li>
        ))}
      </ol>
      <span className="workflow-context">{context || PAGE_NAMES[page]}</span>
    </div>
  );
}

export function Footer({onData}: {onData: () => void}) {
  return (
    <footer className="site-footer">
      <div>
        <strong>MarsPath</strong>
        <span>Team Orbit Guardians · NASA Space Apps Challenge</span>
      </div>
      <p>
        Research prototype built on NASA-derived data. Not an operational navigation system and not for safety decisions.{' '}
        <button type="button" className="inline-link" onClick={onData}>Data sources and limits</button>
      </p>
    </footer>
  );
}
