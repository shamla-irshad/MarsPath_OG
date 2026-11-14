import {useEffect} from 'react';
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
      <section className="hero" aria-labelledby="hero-title">
        <img className="hero-image" src="/data/landing_area_ortho_preview.png" alt="" fetchPriority="high" />
        <div className="hero-wash" aria-hidden="true" />
        <div className="hero-orbital" aria-hidden="true"><i /><i /><i /></div>
        <div className="hero-content">
          <div className="hero-eyebrow"><span className="hero-eyebrow-dot" /> NASA SPACE APPS · TEAM ORBIT GUARDIANS</div>
          <h1 id="hero-title">Explore Mars <span>with purpose.</span></h1>
          <p className="hero-lead">
            Explore scientific destinations, examine Martian terrain, investigate NASA-derived data and plan future surface exploration missions.
          </p>
          <div className="hero-actions">
            <PrimaryButton size="lg" onClick={() => go('discover')}>Explore Mars <Icon name="arrow" size={19}/></PrimaryButton>
            <a className="text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <div className="hero-trust" aria-label="Project dataset overview">
            <div><strong>03</strong><span>MISSION OBJECTIVES</span></div>
            <div><strong>09</strong><span>GIS CANDIDATES</span></div>
            <div><strong>401 × 401</strong><span>LOCAL ROUTING GRID</span></div>
          </div>
        </div>
        <div className="hero-image-tag" aria-hidden="true"><b>01 / LOCAL TERRAIN</b><span>JEZERO CRATER · ORBITAL PREVIEW</span></div>
        <p className="hero-credit">Original Jezero orbital preview supplied with the project · science imagery, color-treated for this hero only.</p>
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
