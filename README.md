# MarsPath

Team Orbit Guardians · NASA Space Apps Challenge

MarsPath is a research prototype for planning a Mars surface excursion. It layers NASA-derived orbital imagery, terrain statistics and science records, lets you compare candidate destinations, calculates routes where the data allows, and simulates a Marswalk. It is **not** an operational navigation system and cannot locate anyone on Mars.

## Missions

| Mission | Region | Capability |
|---|---|---|
| Rover Navigation | Jezero Crater | Compare terrain; shortest and lower-terrain-cost routes on a 401 × 401 (5 m) grid |
| Water-Ice Exploration | Arcadia Planitia | Compare SWIM ice-consistency evidence (science only) |
| Past-Life Exploration | Jezero Crater | Documented sample sites; regional (20 m) route model |

## Run it

Requires Python 3.10+ and Node.js 20.19+ (or 22.12+). Internet is needed once to install dependencies.

**Windows:** double-click `start_all_windows.bat`, then open http://127.0.0.1:5173.

**macOS / Linux:**
```bash
# terminal 1 - API (http://127.0.0.1:8000/docs)
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000

# terminal 2 - web app
cd frontend && cp .env.example .env.local && npm install && npm run dev
```
Without the API the app still shows the supplied candidate records but offers no routes.

## Structure
```
backend/    FastAPI service, A* routing, tests, GIS data (data/)
frontend/   React + TypeScript + Vite
  src/pages/       Home, Discover, Explorer, Compare, Navigate, Summary
  src/components/  Shell, shared UI, tour and help
  src/lib/         candidate helpers
docs/       API contract, data provenance, test plan, changelog
scripts/    terrain preparation (development only)
```

## Real, derived and simulated
- **Supplied data:** candidate records, Mars coordinates, polygons, orbital preview, 1 m DEM and slope rasters, CTX preview.
- **Calculated:** terrain-cost classes (1, 5, 255), A* routes and their scores, route metrics.
- **Simulated:** Marswalk progress, guidance, manual position and the deviation demo; the 22 m/min speed is an assumption.
- **Unavailable:** live positioning, weather or radiation data, and a verified route model outside the supplied areas.

See `docs/DATA_PROVENANCE_AND_LIMITATIONS.md` before extending any science claim. Tests: `cd backend && pytest` (see `docs/TEST_PLAN.md`).

## Latest integration
See docs/INTEGRATED_RELEASE.md, docs/SOURCE_REGISTER.md and docs/AI_DISCLOSURE.md.

## Merged sessions and palette release

See [merged release notes](docs/MERGED_RELEASE_2026-11-13.md). Recorded observations use the backend SQLite database at `backend/data/sessions.sqlite3` (override with `MARSPATH_DB`). Research drafts and exported discovery reports remain browser-local. Notes are not automatically sent to anyone. Back up your database separately; it is excluded from the ZIP.
