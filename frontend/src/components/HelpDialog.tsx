export function HelpContent({onTour}: {onTour: () => void}) {
  return (
    <section className="help-content">
      <h2>Help</h2>
      <h3>The workflow</h3>
      <p>Mission, Explore, Plan, Navigate, Review. Your selections are kept as you move between pages, and every page has Back and Home buttons.</p>
      <h3>Using the map</h3>
      <p>Scroll or pinch to zoom, drag to pan, double-click to zoom in. Use the Layers button to show or hide data. Zooming only changes the map; it never rescales the page.</p>
      <h3>Why can&apos;t I plan a route?</h3>
      <p>Routing is available inside the local Jezero grid (about 2 km) and for the supplied regional Jezero model. Water-ice candidates are science-only; you can still explore them and print a report.</p>
      <h3>Is the position real?</h3>
      <p>No. Positions are simulated or typed in by you. MarsPath has no Mars positioning hardware and never uses Earth GPS.</p>
      <button type="button" className="btn btn-outline" onClick={onTour}>Take the quick tour</button>
    </section>
  );
}
