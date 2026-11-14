# Integrated release — 13 November 2026

Base: the team's MarsPath_clean.zip, retaining pages/components/lib organization, system fonts, Help and introductory tour.

Merged: local and regional map-start selection, one destination dropdown, advanced coordinate fields, local manual walking, immediate travel-heading warnings, model-terrain checks, shared playback speeds, route-near study stops, exploration notebook and discovery-report export. Notes/reports stay in the browser and are not sent. Regional free walking and Arcadia routing remain unavailable; regional heading tests and route preview remain supported.

Source credits: replaced wiki context references with NASA; removed unused mosaic entries; reconciled regional-route and terrain documentation. Exact GIS-product references remain pending in SOURCE_REGISTER.md. AI disclosure identifies known tools without inventing other team activity.

Local walking: choose Explore manually, then focus Walk & investigate. WASD/arrows or buttons move 1 m or turn 15 degrees. Wrong travel heading (>60 degrees), route deviation (>20 m), higher-cost cells, blocked cells and coverage limits produce model advisories. Camera look direction is independent. Completion uses route preview only.

Extract the ZIP and run start_all_windows.bat. Keep both service windows open. No new scientific observations or mineral detections have been fabricated.

## Validation — 13 November 2026

Production frontend build passed. Static rendering checks passed for six application screens, regional navigation controls, accessible main targets and playback presets. Navigation geometry checks passed for coordinate round trips, one-metre steps, cardinal headings, heading wraparound and diagonal corner checks. All 16 original raster/image/backend Python files matched the supplied clean archive byte for byte. Live interactive browser testing was not completed; these checks do not certify real-world navigation safety.
