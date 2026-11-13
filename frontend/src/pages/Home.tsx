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
  return (
    <main id="main-content" tabIndex={-1} className="home-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Explore Mars with purpose.</h1>
          <p className="hero-lead">
            Explore scientific destinations, examine Martian terrain, investigate NASA-derived data and plan future surface exploration missions.
          </p>
          <div className="hero-actions">
            <PrimaryButton size="lg" onClick={() => go('discover')}>Explore Mars</PrimaryButton>
            <a className="text-link" href="#how-it-works">How MarsPath works</a>
          </div>
        </div>
        <img className="hero-image" src="/data/landing_area_ortho_preview.png" alt="Orbital view of the Jezero Crater landing area" />
        <p className="hero-credit">Image: local Jezero orbital preview supplied with the project.</p>
      </section>

      <section className="section" id="how-it-works">
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

      <section className="section section-alt" aria-labelledby="missions-heading">
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

      <section className="section" id="about">
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
