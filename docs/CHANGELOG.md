# Changelog

## 2026-11 — Interface redesign and repository cleanup
- Rebuilt the interface on a consistent design system (tokens, type scale, spacing); removed decorative glyphs, all-caps labels and promotional copy.
- Added a five-stage workflow bar (Mission, Explore, Plan, Navigate, Review) and a first-time tour and Help dialog.
- Split the single 55 KB `App.tsx` into `pages/`, `components/` and `lib/` modules.
- Removed bundled virtual environment, build output, caches, duplicated datasets and seven overlapping status notes.
- Fonts now use the system stack (no external requests).

## 2026-11-05 — Merged release
Local DEM and slope layers, elevation profiles, rover visor simulation, ordered science stops, and regional past-life routing (Butler and manual starts).

## 2026-11-04 — Two Jezero start options
Landing point (200, 200) or manually entered Mars latitude and east longitude; candidate comparison and detail views.
