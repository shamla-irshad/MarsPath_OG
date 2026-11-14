# MarsPath gap-focused upgrade — 2026-11-14

## Implemented

- Added a third `balanced` A* objective. It combines the existing 1/5 traversability cost classes with an illustrative slope penalty derived from the supplied 1 m slope raster, sampled at 5 m navigation-cell centers.
- Preserved the existing `shortest` and `lower` objectives.
- Added route metrics for average and maximum sampled slope and distance with unknown slope samples.
- Added independently calculated return paths for each route objective.
- Added round-trip planning estimates for outbound time, return time, science-stop time, EVA time budget, protected return reserve, and illustrative oxygen/battery percentages.
- Added a configurable return reserve to the planning interface and passed EVA/science/reserve assumptions to the route API.
- Added route comparison and mission-summary display for slope, return, and resource information.
- Updated tests and documentation to describe the additional route objective.

## Model assumptions and limitations

- The 22 m/min walking speed remains a demonstration assumption.
- The oxygen model uses 0.70 percentage points per estimated mission minute; the battery model uses 0.45 percentage points per estimated mission minute. These are software demonstration assumptions, not measured spacesuit performance or NASA-approved models.
- Slope penalties increase above 5 degrees using `1 + 0.035 * max(0, slope - 5)^1.45`. This is an illustrative optimization weight, not a human mobility threshold or safety classification.
- Unknown slope samples receive a 1.5 multiplier in balanced routing and are reported as unknown distance. They are not silently treated as measured safe terrain.
- Elevation is loaded and retained as an available raster sample for future vertical-profile modelling, but the current balanced objective does not yet include elevation-change energy cost.
- The application still has no live Mars position, weather, dust, radiation, communication coverage, or spacesuit telemetry feed.
- Arcadia Planitia remains science-only because no aligned local navigation grid is included. Past-life regional routes retain their existing implementation and are not converted to the new slope-aware objective because the supplied data alignment and raster coverage are different.
- The existing source registration/provenance caveats remain. This upgrade does not resolve the documented registration mismatch or independently verify original product provenance.
- MarsPath remains a research/hackathon prototype and must not be used as operational EVA guidance.

## API changes

`POST /api/routes/generate` accepts optional `evaBudgetMinutes` (default 90), `scienceStopMinutes` (destination dwell, default 10), `intermediateScienceStopMinutes` (default 10), and `returnReserveMinutes` (default 15). The route response includes `balanced`, `returnRoute`, `resourceAssessment`, and slope metrics.

## Validation

Run backend tests from `backend/` with `pytest`. Run frontend checks from `frontend/` with `npm ci` followed by `npm run typecheck` and `npm run build`.

## Verification performed for this packaged release

- Backend automated suite: **37 tests passed** (`PYTHONPATH=. pytest -q` from `backend/`).
- Python syntax compilation: passed for `main.py`, `sessions.py`, and `past_life_routes.py`.
- Frontend TypeScript/Vite build: **not verified in this environment** because `npm ci` could not complete dependency installation (registry request timed out; offline cache did not contain all packages). Run `npm ci`, `npm run typecheck`, and `npm run build` on the development machine before submission.
