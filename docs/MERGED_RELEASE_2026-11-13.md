# Merged release — 13 November 2026

This release merges the integrated exploration/navigation version with the freebuff SQLite sessions and observations implementation. The original archives are unchanged.

## Included
- Free walking, wrong-direction/off-route warnings, visor controls, playback speed, map-selected local/regional starts, research drafts and discovery report exports retained.
- Shared database observations for terrain, water-ice and past-habitability exploration. Notes refer to the selected location; they are not sensor measurements.
- Sessions saved to backend/data/sessions.sqlite3; MARSPATH_DB overrides this path. New mission/reset starts a fresh session. Existing same-mission sessions are reused in the current browser tab.
- Navigation snapshots are conservatively stored as incomplete until playback reaches completion. Saves are serialized, and failures are shown with a retry action. Browser closure can still lose the latest in-flight update; this is not an operational logging system.
- PATCH CORS support, removal of httpx2, nullable route clearing and database ignore entries.
- Offline LIFE_002/LIFE_003 coordinate warnings preserved in both manifests.
- Local coordinate conversion reads public map_metadata.json. Map-selected starts use the same transform.
- Rover skip-to-summary action and a specific start/destination science-stop conflict message.
- Requested space palette: #0B0D17, #1A1D2E, #E25822, #2B7A78, #4EE4D2, #F5A623, #F0F2F5, #8C92A4. One palette token definition; print rules consolidated; pixel font sizes raised to at least 12px.
- Official NASA sample-return citation, source register and AI disclosure retained. Exact GIS provenance is still pending team confirmation.

## Validation
- Production TypeScript/Vite build passed.
- Six screen render checks, regional controls, walking geometry and map coordinate round trips passed.
- Frontend session checks passed: concurrent creation, reuse, new-session reset and preservation during temporary offline errors.
- Direct backend checks passed: session create/update/restore, observations, invalid status/progress/text, missing ID, route clearing and PATCH preflight configuration.
- Full HTTP pytest execution could not complete: the Windows test event loop stalled creating its local socket pair. Direct checks do not replace the HTTP suite.
- Live browser, responsive, print and keyboard acceptance checks remain unverified.

## Remaining limits
Regional visor is compass guidance without invented terrain; Arcadia remains science-only. No new environmental readings or GIS measurements were fabricated. No NASA logo was generated or altered. No automatic report transmission is implemented. The full legacy CSS dead-rule cleanup and ESLint/Prettier adoption are not included in this merge.

## Run
Extract to a new folder, then run start_all_windows.bat. Keep your old project folder if it contains notes or a session database. Dependencies and local databases are deliberately not included in the ZIP. See README.md for setup and docs/TEST_PLAN.md for manual acceptance checks.
