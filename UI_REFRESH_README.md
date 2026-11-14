# MarsPath — Sapphire Aurora UI Refresh

This is a **frontend visual refresh only** based on the user's uploaded `MarsPath_OG.zip` (November 14, 2026). All FastAPI backend code, original GIS candidate files, navigation grids, terrain DEM/slope rasters, georeferencing, and API endpoints are unchanged.

## What's different

- Full-bleed homepage Jezero image blends naturally into the headline; no bordered square image. **Uses the original supplied** `/data/landing_area_ortho_preview.png`, not a stock download.
- Deep sapphire, ice-teal, periwinkle/lavender palette replaces generic orange-black styling, with accessible text contrast and calm glass surfaces.
- Ambient orbital motion, gently drifting hero art, page fade, hover elevation, scroll-reveal homepage sections; reduced-motion support.
- Route elevation and slope switchable area chart, with source-aware gaps, grid, units, interactive keyboard-accessible position scrubber and summary metrics. Sampled numbers remain from original `samples.json` derived from the supplied terrain rasters; no invented chart points.
- Route comparison adds true relative-length and model-cost bars computed from actual response metrics.
- Keeps all six pages, existing map transforms, layer toggles, route endpoints, mission workflow and simulated navigation.

## Installation — patch ZIP (recommended for an existing GitHub repository)

1. Extract the `MarsPath_UI_Refresh_Patch.zip` archive.
2. Copy its `frontend/src` files into the matching `frontend/src` directory in your **existing** MarsPath_OG checkout (replace changed files).
3. Keep your backend and scientific datasets untouched.
4. In `frontend`, run `npm ci`, `npm run typecheck`, and `npm run build`.
5. Start locally: `npm run dev`. Inspect the homepage at desktop and mobile widths, compare two real routes, and inspect the terrain profile. Test keyboard navigation and reduced motion.
6. Commit and push the frontend changes to GitHub. Your Vercel frontend will rebuild if auto-deployment is enabled. No Render backend redeployment is required for this UI-only update.

## Installation — complete project ZIP

Extract `MarsPath_OG_Sapphire_Aurora_Full.zip` into a **new folder**, then use the normal `frontend` and `backend` startup commands from the original project's README. This package excludes `.git` metadata; it is a clean distributable copy of the original project plus frontend changes.

## Files changed / added

- `frontend/src/pages/Home.tsx` — integrated cinematic hero, brief metrics, viewport section reveal.
- `frontend/src/pages/Compare.tsx` — actual-data route comparison bars.
- `frontend/src/Terrain.tsx` — elevation/slope area chart and scrubber, unchanged sampling source.
- `frontend/src/main.tsx` — import the visual CSS last.
- `frontend/src/visual-refresh.css` — design tokens, layout blending, motion, chart styles, responsive and reduced-motion rules.

## Scientific and safety notes

The orbital image is color-treated only as **decorative homepage artwork**; the actual GIS map and science raster assets are not recolored. Visualization of a cost score must not be interpreted as physical energy use, radiation exposure, or astronaut safety.

## Verification summary

- JavaScript/TypeScript **syntax transpilation**: passed for the edited TSX files.
- **TypeScript type-check**: passed using the compatible React/TypeScript type dependencies available in an earlier export; the exact lockfile dependency installation was not verified.
- CSS **parser validation**: passed.
- Source GIS/backend files: preserved byte-for-byte in the full archive.
- Full `npm ci` / production Vite build: **not completed in this environment**. npm dependency downloads were unavailable; the Vite bundle from an earlier export lacked its Linux native binding.
- Interactive browser test: **not completed**; local browser access to files and test server was blocked.

If the TypeScript build reports an issue, share the exact first error and file/line; do not deploy until it is fixed.
