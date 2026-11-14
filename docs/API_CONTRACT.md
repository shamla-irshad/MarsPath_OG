# MarsPath API contract v2

Base URL when running locally: `http://127.0.0.1:8000`.

Interactive documentation: `/docs` or OpenAPI JSON: `/openapi.json`.

## GET endpoints

- `GET /` — API identity.
- `GET /api/health` — confirms 401×401 grid loaded and nine candidates available.
- `GET /api/missions` — mission metadata and supported routing status.
- `GET /api/missions/{mission_id}/candidates` — three candidates for selected mission, original source scientific properties and coordinate information.
- `GET /api/candidates/{candidate_id}` — one full candidate record.
- `GET /api/map/metadata` — local projected CRS, grid size, raster transform, Butler reference origin, and two available start modes.
- `GET /api/cell/{row}/{col}` — model cell cost and traversability.

Mission IDs:

- `rover-navigation-jezero`
- `water-ice-arcadia`
- `past-life-jezero`

## POST /api/routes/generate

Also available at `/routes/generate` for compatibility.

Request:
```json
{
  "missionId": "rover-navigation-jezero",
  "objective": "Rover Navigation",
  "startMode": "butler",
  "destination": { "row": 56, "col": 370 },
  "candidateId": "JEZERO_A"
}
```

`candidateId` is optional for manual destinations and must match the exact candidate representative grid cell when present.

Successful response shape:
```json
{
  "status": "success",
  "source": "api",
  "region": "localized-jezero",
  "routes": [
    {
      "id": "shortest",
      "label": "Shortest route",
      "geometry": [{ "row": 200, "col": 200 }, { "row": 201, "col": 200 }],
      "metrics": {
        "distanceMeters": 100,
        "estimatedMinutes": 4.5,
        "traversalCost": 170,
        "highCostExposurePercent": 12,
        "waypoints": 10
      },
      "dataSources": ["NASA-derived local Jezero navigation grid"],
      "modelNotice": "Simulated travel, not safety-certified navigation"
    }
  ],
  "notices": ["Model limitations..."]
}
```

**The numbers and two-point geometry in the response example above are illustrative schema examples, not actual server outputs.** Actual server response contains complete A* paths for both `shortest` and `lower` when reachable.

Algorithm: 8-connected grid, diagonal distance is `5√2 m`, orthogonal distance `5 m`, no diagonal corner cutting through blocked cells. Shortest optimizes geometric distance; lower cost optimizes distance × destination-cell cost (1 or 5). Both use an admissible octile heuristic. Weighted traversal cost has *model distance-cost units*, not physical energy or a safety probability.

Errors: 422 for blocked/unknown cells, unsupported missions, invalid/missing manual Mars coordinates, out-of-grid starts, start-mode mismatch, candidate/destination mismatch and same start/end. 404 if no route is reachable. Pydantic returns 422 for coordinates outside 0–400.

## New: manually entered Mars starting coordinates

Only in `rover-navigation-jezero`: the frontend displays exactly **two** route-start choices (`butler` or `manual`).

Check coordinates with `POST /api/mars/resolve-start`:

```json
{"latNorth":18.44383094,"lonEast":77.45082964}
```

`latNorth` uses north-positive degrees (`-90` to `90`); `lonEast` uses east-positive degrees (`0` to less than `360`). The endpoint returns the *containing* valid navigable 5 m grid cell; blocked or outside positions return HTTP 422. Mars spherical `ESRI:103885`, **not Earth WGS84**. Input elevation is not required.

Route from manual coordinates:

```json
{"missionId":"rover-navigation-jezero", "startMode":"manual", "startCoordinates":{"latNorth":18.44383094,"lonEast":77.45082964},"destination":{"row":210,"col":215}}
```

The response identifies the start cell, start mode, and coordinate-resolution metadata. A `butler` start remains the default if `startMode` is omitted for older clients. Water-Ice is science-only. Past-habitability uses a separate regional routing API and 20 m cost raster.

## POST /api/navigation/deviation

Request:
```json
{"position":{"row":215,"col":240},"route":[{"row":200,"col":200},{"row":230,"col":250}],"corridorMeters":20,"accuracyMeters":0}
```

Response includes distance from closest route segment in meters and `offRoute` flag. This only works with **externally supplied manual or simulated position**; there is no live Mars location service.

## GET /api/science/surface-images

Documented NASA surface photography metadata. Never a live camera feed.

```json
{
  "images": [
    {
      "id": "PIA23727",
      "missionId": "rover-navigation-jezero",
      "title": "Perseverance's first high-resolution Mastcam-Z panorama",
      "mission": "Mars 2020 Perseverance",
      "instrument": "Mastcam-Z right-eye zoom camera, 110 mm mosaic",
      "sol": 4,
      "observationDate": "2021-02-22",
      "productId": "PIA23727",
      "location": "Octavia E. Butler landing site, Jezero Crater",
      "imageUrl": "https://…",
      "sourceUrl": "https://science.nasa.gov/photojournal/…",
      "credit": "NASA/JPL-Caltech/ASU/MSSS",
      "matchLevel": "regional_context",
      "matchedCandidateIds": [],
      "note": "…"
    }
  ],
  "matchingPolicy": "regional_context is NOT an image of the selected destination. Site matches require separately verified GIS evidence."
}
```

`missionId` is `rover-navigation-jezero` or `past-life-jezero`. `matchLevel` is `regional_context`, `nearby_verified` or `site_verified`. Validation refuses a `site_verified` record with no `matchedCandidateIds`, and refuses a `regional_context` record that claims one, so the API cannot serve a photograph implying an unverified site match.

## GET /api/environment/observations

Historical environmental readings as context. No live EVA assessment and no radiation forecast exist.

```json
{
  "observations": [],
  "status": "no_observations_uploaded",
  "isLive": false,
  "warning": "No live EVA conditions, radiation dose prediction, or site-specific safety clearance is available.",
  "references": [
    {"instrument": "Mars 2020 MEDA", "site": "Jezero rover locations", "url": "…", "note": "…"},
    {"instrument": "MSL RAD", "site": "Gale Crater", "url": "…", "note": "Ionizing radiation historical context measured at Gale, NOT Jezero."}
  ]
}
```

`status` is `historical_context_only` when readings exist and `no_observations_uploaded` when the bundled file is empty; `isLive` is always `false`. Allowed `metric` values: `air_temperature`, `ground_temperature`, `pressure`, `wind_speed`, `ionizing_radiation_dose_rate`. Every reading must carry `mission`, `instrument`, `location`, `unit`, `observationDate`, `productId` and `sourceUrl`, and `contextualOnly` is fixed `true`. An `ionizing_radiation_dose_rate` record is rejected unless `instrument` names RAD and `mission` names MSL or Curiosity, which prevents a Gale dose being relabelled as a Jezero one. Values must be finite.

Both endpoints are read-only and served from `backend/data/science/`. The frontend reads the API first and falls back to the identical static snapshot at `frontend/public/data/science/` when the API is offline, labelling the panel accordingly; no reading or image is generated when neither source is available.

## API availability and frontend behavior

`frontend/.env.example` points to `http://127.0.0.1:8000`. When the API is offline, the frontend loads the bundled candidates manifest for discovery only and **disables routing**. No fake route is returned on backend failure.

The legacy metrics.waypoints field counts heading changes, not visited waypoints.

## Sessions and observations

Saved locally in SQLite at `backend/data/sessions.sqlite3` (override with `MARSPATH_DB`). Standard library only; no new dependency. After changing the database location, restart the backend.

| Method | Endpoint | Behaviour |
|---|---|---|
| POST | `/api/sessions` | Body `missionId` (required), `candidateId` (optional). Creates a session with `status: "planning"`, `progressPercent: 0`, `events: []`. Returns 201. |
| GET | `/api/sessions/{id}` | Returns the session plus its observations ordered by time. 404 if unknown. |
| PATCH | `/api/sessions/{id}` | Allowed fields: `candidateId`, `status`, `progressPercent` (0–100), `selectedRoute`, `events`. `status` must be one of `planning`, `navigating`, `completed`, `incomplete`, `science-only`. Unknown fields are ignored. 404 if unknown. |
| POST | `/api/sessions/{id}/observations` | Body `text` (1–2000 characters, not blank) and optional `location` (`lonEast`, `latNorth`, `row`, `col`). Stored with `source: "user-recorded"`. 404 if the session is unknown; 422 if the text is blank. |

Every session response has the shape `{"session": {...}, "observations": [...]}`; the observation endpoint adds the created `observation`. `progressPercent` above 100 or below 0 is a 422, and `status` outside the list above is a 422. `PATCH` is included in the CORS allowed methods.

A session records what the user chose and how far the *simulation* reached. A stopped or abandoned walk is patched to `incomplete`, never `completed`. Observations are notes the user typed; they are not measurements, not completed science activities, and nothing is inferred from them.

```json
{"missionId":"rover-navigation-jezero","candidateId":"JEZERO_A"}
```
```json
{"status":"incomplete","progressPercent":42,"selectedRoute":"lower"}
```
```json
{"text":"Loose blocky material on the north rim","location":{"row":210,"col":215}}
```
