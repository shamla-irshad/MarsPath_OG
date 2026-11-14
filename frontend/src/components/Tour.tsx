import {useEffect, useRef, useState} from 'react';

const STEPS = [
  {title: 'Welcome to MarsPath', text: 'In about a minute you will choose a science mission, pick a candidate location, inspect the data, compare routes and rehearse a Marswalk.'},
  {title: '1. Choose a mission', text: 'Each mission has three real candidate locations from the processed GIS data. Compare them side by side before you commit.'},
  {title: '2. Explore the map', text: 'Use the Layers button to show or hide imagery, terrain and science records. Every layer says whether it is observed, processed, calculated or simulated.'},
  {title: '3. Compare routes', text: 'Where the data supports it, MarsPath calculates a shortest-distance route and a lower terrain-cost route so you can see the trade-off.'},
  {title: '4. Navigate and review', text: 'Run a simulated Marswalk with guidance, then open a printable report of what you selected, planned and simulated.'},
];

export function Tour({open, onClose}: {open: boolean; onClose: () => void}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setStep(0); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);
  const last = step === STEPS.length - 1;
  return (
    <dialog ref={ref} className="tour-dialog" aria-labelledby="tour-title" onClose={onClose}>
      <p className="tour-count">Step {step + 1} of {STEPS.length}</p>
      <h2 id="tour-title">{STEPS[step].title}</h2>
      <p>{STEPS[step].text}</p>
      <div className="action-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Skip tour</button>
        {step > 0 && <button type="button" className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>}
        <button type="button" className="btn btn-primary" onClick={() => (last ? onClose() : setStep(step + 1))}>{last ? 'Done' : 'Next'}</button>
      </div>
    </dialog>
  );
}
