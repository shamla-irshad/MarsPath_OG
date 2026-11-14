# Changelog

## 2026-11-14 — Surface photography and environmental context
- Added read-only science context: `/api/science/surface-images` and `/api/environment/observations`, plus panels in Explorer and Navigate.
- Added one real NASA surface photograph (PIA23727, Perseverance Mastcam-Z Sol 4) labelled `regional_context`: it is a genuine Jezero landing-site image, not an image of the selected destination.
- Added MEDA and MSL RAD source references and a validation rule that rejects an ionizing-radiation reading unless it comes from MSL RAD on Curiosity, so a Gale dose can never be shown as a Jezero measurement.
- No environmental readings are bundled yet: `environment_observations.json` is intentionally empty and every card renders "Not available" until verified observations with date, site and instrument are supplied.

## 2026-11 — Interface redesign and repository cleanup
- Rebuilt the interface on a consistent design system (tokens, type scale, spacing); removed decorative glyphs, all-caps labels and promotional copy.
- Added a five-stage workflow bar (Mission, Explore, Plan, Navigate, Review) and a first-time tour and Help dialog.
- Split the single 55 KB `App.tsx` into `pages/`, `components/` and `lib/` modules.
- Removed bundled virtual environment, build output, caches, duplicated datasets and seven overlapping status notes.
- Fonts: Barlow Condensed, DM Sans and IBM Plex Mono are loaded from `fonts.googleapis.com`, so the page makes three external font requests; system-font fallbacks apply if they fail.

## 2026-11-05 — Merged release
Local DEM and slope layers, elevation profiles, rover visor simulation, ordered science stops, and regional past-life routing (Butler and manual starts).

## 2026-11-04 — Two Jezero start options
Landing point (200, 200) or manually entered Mars latitude and east longitude; candidate comparison and detail views.
