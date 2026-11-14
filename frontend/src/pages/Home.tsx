import {useEffect, useState} from 'react';
import type {Page} from '../types';
import {MISSIONS} from '../types';
import {Icon, PrimaryButton} from '../components/ui';

const STEPS = [
  {title: 'Select a mission', text: 'Choose what you want to investigate: rover terrain, subsurface ice evidence or sites linked to ancient environments.'},
  {title: 'Compare candidate locations', text: 'Each mission offers three real candidate locations from the processed GIS data. Compare them side by side.'},
  {title: 'Explore the data and plan a route', text: 'Layer imagery, terrain and science records on one map. Where the data supports it, calculate and compare routes.'},
  {title: 'Simulate a Marswalk or review the science', text: 'Rehearse the walk with guidance and progress tracking, or complete a science-only investigation. Then print a report.'},
];

export function Home({go, onSelectMission}: {go: (p: Page) => void; onSelectMission: (id: (typeof MISSIONS)[number]['id']) => void}) {
  const [featuredMission, setFeaturedMission] = useState<(typeof MISSIONS)[number]['id']>(MISSIONS[0].id);
  const activeMission = MISSIONS.find(item => item.id === featuredMission) ?? MISSIONS[0];
  // Reveal sections only as they come into view. The reduced-motion stylesheet
  // explicitly bypasses these effects for people who disable animation.
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(node => node.classList.add('reveal-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible');
          observer.unobserve(entry.target);
        }
      }
    }, {threshold: 0.12, rootMargin: '0px 0px -30px 0px'});
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className="home-page">
      <section className="hero terminal-hero" aria-labelledby="hero-title">
        <div className="terminal-ambient" aria-hidden="true" />
        <div className="terminal-heading-row" aria-hidden="true">
          <span>MARSPATH / EXPLORATION SYSTEM</span>
          <span>ORBIT GUARDIANS · NASA SPACE APPS</span>
        </div>
        <div className="terminal-hero-layout">
          <div className="terminal-intro">
            <p className="terminal-kicker"><span className="terminal-pulse" /> SCIENCE-DRIVEN EXPLORATION</p>
            <h1 id="hero-title">Mars, <span>mapped for discovery.</span></h1>
            <p className="terminal-description">
              Explore scientific destinations, examine NASA-derived terrain data and plan a simulated Marswalk—all in one mission workspace.
            </p>
            <div className="terminal-actions">
              <PrimaryButton size="lg" onClick={() => go('discover')}>Explore Mars <Icon name="arrow" size={19}/></PrimaryButton>
              <a className="terminal-text-link" href="#how-it-works">How it works <span aria-hidden="true">↓</span></a>
            </div>
            <div className="terminal-objective-picker">
              <p className="terminal-panel-label">PREVIEW A MISSION OBJECTIVE</p>
              <div className="terminal-mission-options" role="group" aria-label="Preview mission objectives">
                {MISSIONS.map((mission, index) => (
                  <button
                    type="button"
                    key={mission.id}
                    className={`terminal-mission-option ${featuredMission === mission.id ? 'is-selected' : ''}`}
                    aria-pressed={featuredMission === mission.id}
                    onClick={() => setFeaturedMission(mission.id)}
                  >
                    <span className="terminal-mission-number">0{index + 1}</span>
                    <span>{mission.label}</span>
                    <span className="terminal-mission-chevron" aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
              <p className="terminal-picker-hint">Select a mission to preview its science focus.</p>
            </div>
          </div>

          <div className="terminal-visual" role="img" aria-label="Illustrative planet-shaped visualization using stylized texture from the supplied local Jezero orbital preview; not a geographic globe map">
            <div className="terminal-starfield" aria-hidden="true" />
            <div className="terminal-orbit terminal-orbit-one" aria-hidden="true" />
            <div className="terminal-orbit terminal-orbit-two" aria-hidden="true" />
            <div className="terminal-orbit terminal-orbit-three" aria-hidden="true" />
            <div className="terminal-planet" aria-hidden="true" />
            <div className="terminal-planet-glow" aria-hidden="true" />
            <div className="terminal-visual-caption" aria-hidden="true">
              <strong>THE RED PLANET</strong>
              <span>Illustrative visualization · local Jezero texture</span>
            </div>
          </div>

          <aside className="terminal-side-panel" aria-label="Mission overview">
            <div className="terminal-status-panel">
              <div className="terminal-panel-heading">
                <span>MISSION PROFILE</span>
                <span className="terminal-live-label">01 / 03</span>
              </div>
              <h2>{activeMission.label}</h2>
              <p className="terminal-region">{activeMission.region}</p>
              <p>{activeMission.description}</p>
              <div className="terminal-data-separator" />
              <div className="terminal-metric-row"><span>DATA FOCUS</span><strong>{activeMission.science}</strong></div>
              <div className="terminal-metric-row"><span>CAPABILITY</span><strong>{activeMission.capability}</strong></div>
            </div>
            <div className="terminal-imagery-panel">
              <div className="terminal-imagery-thumb" aria-hidden="true" />
              <div className="terminal-imagery-copy">
                <span>LOCAL IMAGERY</span>
                <strong>Jezero terrain preview</strong>
                <small>Original project raster · scientific view in Explorer</small>
              </div>
            </div>
            <div className="terminal-facts" aria-label="Project dataset facts">
              <div><strong>03</strong><span>MISSION TYPES</span></div>
              <div><strong>09</strong><span>GIS CANDIDATES</span></div>
              <div><strong>401²</strong><span>LOCAL GRID CELLS</span></div>
            </div>
          </aside>
        </div>
        <div className="terminal-bottom-bar">
          <span>NASA-DERIVED SOURCE DATA</span>
          <span>SIMULATED NAVIGATION · NOT AN OPERATIONAL SYSTEM</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>
      <section className="section" id="how-it-works" data-reveal>
        <h2>How it works</h2>
        <ol className="steps-grid">
          {STEPS.map((step, i) => (
            <li key={step.title} className="step-card">
              <span className="step-number">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section section-alt" aria-labelledby="missions-heading" data-reveal>
        <h2 id="missions-heading">Scientific missions</h2>
        <p className="section-lead">Pick a mission to see its candidate locations.</p>
        <div className="mission-cards">
          {MISSIONS.map((m) => (
            <button type="button" key={m.id} className="mission-card" onClick={() => onSelectMission(m.id)}>
              <span className="mission-card-icon"><Icon name={m.icon} size={26} /></span>
              <h3>{m.label}</h3>
              <span className="mission-card-region">{m.region}</span>
              <p>{m.description}</p>
              <span className="mission-card-link">View candidates <Icon name="arrow" size={16} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="section" id="about" data-reveal>
        <h2>About MarsPath</h2>
        <div className="about-grid">
          <div>
            <p>
              MarsPath is an educational and research project by Team Orbit Guardians for the NASA Space Apps Challenge. It brings together
              NASA-derived orbital imagery, terrain statistics and science records so a person planning a surface excursion can see what is known
              about a location, and what is not, in one place.
            </p>
            <p>Every layer is labelled as an original observation, a processed GIS measurement, a calculated model or a simulation.</p>
          </div>
          <div className="notice notice-warn">
            <strong>Prototype notice.</strong> MarsPath is a mission-planning and simulation prototype. It is not an operational astronaut
            navigation system, it cannot locate anyone on Mars, and its terrain-cost score is not a measure of safety, energy use or radiation.
          </div>
        </div>
      </section>
    </main>
  );
}
