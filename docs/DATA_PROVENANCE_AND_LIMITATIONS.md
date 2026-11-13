# MarsPath science data, provenance and limitations

The bundled scientific context is **source-derived from files supplied by Team Orbit Guardians**. This project does not assert that every instrument dataset, transform, source reference or candidate centroid has been independently validated against a NASA archive.

## Coordinate reference systems

- Candidate sites: Martian east-positive longitude, north-positive latitude on a spherical Mars model (radius 3,396,190 m). **Not Earth WGS84**.
- Local Jezero navigation image/grid: Mars 2000 spherical equidistant cylindrical/equirectangular projection, ESRI:103885, meters, center lon 0°, standard parallel 0°.
- Map raster approximately x=4,589,872–4,591,873 m and y=1,092,304–1,094,305 m. Preview dimensions 2001×2001.
- Navigation grid 401×401 with nominal 5m cells. The grid spans 2005 m in each dimension while the preview covers 2001 m. Minor registration mismatch is **not corrected here**; revalidate primary geotransforms before scientific measurement.

## Mission A — Rover Navigation, Jezero

Original CSV: `backend/data/gis/backend_original/jezero_candidates.csv`.
Original full-precision GeoJSON: `backend/data/gis/backend_original/jezero_candidate_zones.geojson`.

Three candidate representative point locations (`JEZERO_A/B/C`) fall within the local cost grid on cells classified 1 (traversable lower model cost). The backend converts provided Mars lon/lat using the documented projection and computes routes to these representative cells.

The CSV supplies candidate mean/max slope, elevation and relief statistics. These are **polygon summaries**, not aligned per-cell slope or elevation maps. The backend does **not** use an independent slope raster in A*.

`1` and `5` are *relative traversal-cost classes*, not raw slope degrees or measured energy use. `255` denotes blocked or unknown grid cells. Do not claim verified obstacle safety from these classes.

## Mission B — Water-Ice Exploration, Arcadia Planitia

Original files: `arcadia_ice_candidates.csv`, `arcadia_ice_zones_mars_latlon.geojson`.

Three areas include SWIM ice-consistency metrics for 0–1m and 1–5m intervals. They are indicators of evidence **consistent** with subsurface ice, not confirmed deposits, probabilities, water volumes, or local EVA conditions. Scores in different depth intervals should be interpreted carefully alongside the published SWIM context and dataset resolution. The team handoff gives an approximate native resolution of ~3 km, unsuitable for precise walking-route decisions.

No Arcadia DEM, navigation-cost grid, or registered orbital basemap is supplied in this project. The frontend shows a **labeled coordinate schematic** instead of a fake local georeferenced map.

## Mission C — Past-Life Exploration, Jezero

Original files: `jezero_past_life_locations.csv`, `jezero_past_life_sites.geojson`.

Wildcat Ridge/Hazeltop, Turquoise Bay/Lefroy Bay, and Cheyava Falls/Sapphire Canyon are **scientific sampling/context targets**, not proof of ancient life. Site `LIFE_001` uses the handoff's primary-referenced position. The handoff states `LIFE_002` and `LIFE_003` coordinates need additional verification with the corresponding primary source; the frontend explicitly marks them as pending.

All three sample-site coordinates are beyond the local 2 km navigation grid. Separate regional routing uses the supplied 20 m cost raster: six precomputed Butler routes plus bounded manual-start calculations. This does not validate the site coordinates or certify safety.

## Demonstration limitations

- **No Mars GPS** or astronaut sensor input. Navigation position is simulated or manually supplied.
- **No live environmental telemetry** (temperature, wind, pressure, dust, radiation) or certified EVA thresholds.
- Supplied 1 m DEM and slope rasters, derived samples and a coarse visor mesh are included for the local Jezero area. Original product provenance remains awaiting GIS-team confirmation. There is no camera-matched terrain localization.
- Routes are **project-model results**, and the 22m/minute travel speed is an illustrative assumption.
- Candidate polygons exported to `frontend/public/data/gis` are simplified for display. Exact candidate properties and original geometry remain in backend files.
- NASA product provenance should be checked against original NASA PDS/HiRISE observations before claiming exact instrument/pixel dates.

## What still needs collection for a more complete challenge demo

At least three verified, *co-registered* local data categories at the same Jezero Marswalk corridor (e.g., optical + DEM/slope + co-located spectral/geologic/thermal observations); instrument/product IDs, timestamps, resolution, uncertainty, registered spatial bounds. The current repo has optical imagery, a derived cost grid and site-level science summaries, but this **does not prove three independent co-located instrument layers**.

See SOURCE_REGISTER.md for the remaining provenance requests.

