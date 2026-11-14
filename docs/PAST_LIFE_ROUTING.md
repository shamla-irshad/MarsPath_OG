# MarsPath Jezero Past-Life regional routing handoff

Source: user-generated `jezero_past_life_astar_routes.gpkg` (unaltered and included).

## Files
- `jezero_past_life_astar_routes.gpkg`: original QGIS GeoPackage; six LineString features. Layer SRS = `Jezero_Crater_Projection`, Mars spherical Equirectangular with standard parallel 18.4663 degrees. Native units metres.
- `jezero_past_life_astar_routes_mars_latlon.geojson`: converted **all original line vertices** into Mars longitude E/latitude N degrees; no simplification or resampling. Keep the original GPKG as authoritative.
- `jezero_past_life_route_summary.csv`: distances, costs, grid cell indices and start/end coordinates.

## What is verified
- Three destination IDs, two routes per ID = six features.
- Valid geometry, same starting model cell (row 2505, col 1274), distinct destination cells.
- Geometry length matches each recorded `distance_m` within rounding precision.
- Route shorter / lower-cost distinction is consistent with recorded weighted costs.

## What remains to verify
- Route traversability and optimality cannot be independently established using the GPKG alone. Validate every route vertex/segment against the original `jezero_regional_navigation_cost.tif` and the routing script; confirm transitions do not cut blocked cell corners. Ensure cost 255 and NoData are prohibited and that the starting coordinates and destination points use the same Mars CRS.
- Candidate geolocation and primary NASA/PDS source verification still needed for LIFE_002 and LIFE_003.
- These are regional 20m-resolution terrain-model paths, NOT Perseverance historical drives or certified safe routes.
- These precomputed routes start at the **Butler model location only**. User-entered start points require backend A* recalculation on the full regional grid.
- Do not enable Arcadia routing from these Jezero results.

## Website integration
- Display route lines on your georeferenced Jezero CTX background in the SAME Mars projection; avoid placing Mars lon/lat into a standard Earth EPSG:4326 tile map.
- GeoJSON coordinates are Mars longitude east / planetocentric latitude north despite standard GeoJSON's terrestrial coordinate conventions; carry explicit metadata and a planetary map configuration.
- The `method` field is either `shortest` or `terrain_aware`. Map site IDs via LIFE_001=Hazeltop, LIFE_002=Lefroy Bay, LIFE_003=Sapphire Canyon.

## Windows original folders
- `D:\videos\Orbit Guardians\MarsPath\03_processed_Data\Past_Life_Routing\jezero_past_life_astar_routes.gpkg`
- `D:\videos\Orbit Guardians\MarsPath\03_processed_Data\Past_Life_Routing\jezero_regional_navigation_cost.tif`
- `D:\videos\Orbit Guardians\MarsPath\03_processed_Data\Past_Life_Web_Map\jezero_ctx_web.png`

