"""MarsPath NASA-derived local grid route API and GIS candidate endpoints.

This is a research/hackathon planning prototype, NOT safety-certified EVA guidance.
Grid costs: 1 (lower model cost), 5 (higher model cost), 255 (blocked).
All grid coordinates reference the LOCAL Jezero raster, never global Mars.
"""
from __future__ import annotations
from sessions import router as sessions_router

import heapq
import json
import math
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from past_life_routes import router as past_life_router
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

DATA_DIR = Path(__file__).resolve().parent / "data"
GRID_PATH = Path(os.getenv("MARSPATH_GRID", str(DATA_DIR / "navigation_grid.json")))
MANIFEST_PATH = DATA_DIR / "gis" / "candidates_manifest.json"
MARS_RADIUS_M = 3396190.0
ROVER_MISSION = "rover-navigation-jezero"
MISSIONS = ("rover-navigation-jezero", "water-ice-arcadia", "past-life-jezero")
ESTIMATED_WALK_M_PER_MIN = 22.0  # modeling assumption, not certified EVA speed

app = FastAPI(title="MarsPath API", version="2.0.0", description="NASA-derived Mars GIS and local A* routing research prototype")
app.include_router(past_life_router)
origins = [s.strip() for s in os.getenv("MARSPATH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if s.strip()]
app.include_router(sessions_router)
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_origin_regex=r"http://(?:localhost|127\.0\.0\.1):(?:517[3-9]|518[0-9]|519[0-9])", allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type"])


@lru_cache(maxsize=1)
def grid_data() -> dict:
    if not GRID_PATH.is_file():
        raise RuntimeError(f"Missing navigation grid at {GRID_PATH}")
    value = json.loads(GRID_PATH.read_text(encoding="utf-8"))
    if value.get("width") != 401 or value.get("height") != 401 or value.get("cell_size_m") != 5:
        raise RuntimeError("Unexpected navigation grid dimensions or spacing")
    costs = value.get("costs")
    if not isinstance(costs, list) or len(costs) != 401 or any(len(row) != 401 for row in costs):
        raise RuntimeError("Malformed grid costs")
    if any(v not in (1, 5, 255) for row in costs for v in row):
        raise RuntimeError("Unsupported grid cost code")
    return value


@lru_cache(maxsize=1)
def manifest_data() -> dict:
    if not MANIFEST_PATH.is_file():
        raise RuntimeError("Missing GIS candidate manifest")
    value = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if len(value.get("candidates", [])) != 9:
        raise RuntimeError("Expected nine supplied GIS candidate records")
    return value


class Point(BaseModel):
    row: int = Field(ge=0, le=400)
    col: int = Field(ge=0, le=400)


class MarsCoordinates(BaseModel):
    """Mars geographic longitude positive-east, latitude north-positive (degrees)."""
    latNorth: float = Field(ge=-90.0, le=90.0, allow_inf_nan=False)
    lonEast: float = Field(ge=0.0, lt=360.0, allow_inf_nan=False)


class RouteRequest(BaseModel):
    destination: Point
    # Optional legacy fixed cell is accepted ONLY when it equals Butler.
    start: Point | None = None
    startMode: Literal["butler", "manual"] = "butler"
    startCoordinates: MarsCoordinates | None = None
    objective: str = "Rover Navigation"
    missionId: str = ROVER_MISSION
    candidateId: str | None = None
    scienceStopIds: list[str] = Field(default_factory=list, max_length=3)


class DeviationRequest(BaseModel):
    position: Point
    route: list[Point] = Field(min_length=2, max_length=200000)
    corridorMeters: float = Field(default=20.0, ge=1, le=1000)
    accuracyMeters: float = Field(default=0.0, ge=0, le=1000)


def is_open(row: int, col: int, costs: list[list[int]]) -> bool:
    return 0 <= row < 401 and 0 <= col < 401 and costs[row][col] in (1, 5)


def validate_cell(point: Point, costs: list[list[int]], label: str) -> None:
    if not is_open(point.row, point.col, costs):
        raise HTTPException(status_code=422, detail={"code": "BLOCKED_CELL", "message": f"{label} cell is blocked or unknown in the provided grid"})


def mars_lonlat_to_grid(lon_east: float, lat_north: float) -> dict:
    """Mars equirectangular CRS with spherical radius 3396190 m (ESRI:103885)."""
    nav = grid_data()
    a, b, c, d, e, f = nav["source_transform"]
    x = math.radians(lon_east) * MARS_RADIUS_M
    y = math.radians(lat_north) * MARS_RADIUS_M
    # Unrotated raster affine is supplied; 5x5 pixel navigation cell centers.
    if abs(b) > 1e-9 or abs(d) > 1e-9 or a == 0 or e == 0:
        raise RuntimeError("Unsupported rotated navigation grid transform")
    # Map a position to the cell CONTAINING it, not the nearest cell center.
    # Note that the source raster has 1 m pixels and the route grid has 5 m cells.
    col = math.floor(((x - c) / a) / 5)
    row = math.floor(((y - f) / e) / 5)
    in_bounds = 0 <= row < nav["height"] and 0 <= col < nav["width"]
    return {"row": row, "col": col, "inBounds": in_bounds, "projectedXMeters": round(x, 2), "projectedYMeters": round(y, 2)}


def resolve_mars_start(coords: MarsCoordinates) -> dict:
    """Resolve a manually-entered Mars position using the *grid's* projection.

    This is horizontal coordinate lookup only: elevation is not required or inferred.
    """
    point = mars_lonlat_to_grid(coords.lonEast, coords.latNorth)
    if not point["inBounds"]:
        raise HTTPException(422, detail={"code": "OUTSIDE_LOCAL_JEZERO_GRID", "message": "Starting coordinates are outside the approximately 2 km Jezero routing grid. This version cannot plan routes over the rest of Mars."})
    cell = Point(row=point["row"], col=point["col"])
    validate_cell(cell, grid_data()["costs"], "Manual start")
    x_y = point_to_mars_xy(cell.row, cell.col)
    dx = x_y["x"] - point["projectedXMeters"]
    dy = x_y["y"] - point["projectedYMeters"]
    return {
        "start": cell.model_dump(), "startMode": "manual",
        "input": coords.model_dump(), "projectedMeters": {"x": point["projectedXMeters"], "y": point["projectedYMeters"]},
        "cellCenterMeters": x_y, "snapDistanceMeters": round(math.hypot(dx, dy), 2),
        "terrainCost": grid_data()["costs"][cell.row][cell.col],
        "crs": "ESRI:103885",
        "note": "Location is assigned to its containing 5 m grid cell; this does not certify rover safety."
    }


def point_to_mars_xy(row: int, col: int) -> dict:
    a, b, c, d, e, f = grid_data()["source_transform"]
    px, py = col * 5 + 2.5, row * 5 + 2.5
    return {"x": round(a * px + b * py + c, 2), "y": round(d * px + e * py + f, 2)}


def enrich_candidate(candidate: dict) -> dict:
    result = dict(candidate)
    if candidate["missionId"] == ROVER_MISSION:
        cell = mars_lonlat_to_grid(float(candidate["lonEast"]), float(candidate["latNorth"]))
        cost = grid_data()["costs"][cell["row"]][cell["col"]] if cell["inBounds"] else 255
        result["localGridPoint"] = {"row": cell["row"], "col": cell["col"]} if cell["inBounds"] else None
        result["localCellCost"] = cost if cell["inBounds"] else None
        result["routingSupported"] = bool(cell["inBounds"] and cost != 255)
        result["routingNote"] = "Representative coordinate inside traversable local grid; full polygon and path still need independent validation" if result["routingSupported"] else "Representative point outside traversable local grid"
    else:
        result["localGridPoint"] = None
        result["routingSupported"] = False
        result["routingNote"] = "No aligned local navigation-cost grid is supplied for this site"
    # Geology handoff explicitly describes LIFE_002 and LIFE_003 as pending verification.
    result["coordinateVerified"] = True if candidate["id"] == "LIFE_001" else (False if candidate["id"] in ("LIFE_002", "LIFE_003") else None)
    return result


@lru_cache(maxsize=1)
def candidate_records() -> tuple[dict, ...]:
    return tuple(enrich_candidate(c) for c in manifest_data()["candidates"])


@app.get("/")
def root():
    return {"name": "MarsPath API", "docs": "/docs", "status": "ready", "warning": "Research prototype; not EVA safety certified"}


@app.get("/api/health")
def health():
    nav = grid_data()
    return {"status": "ok", "gridLoaded": True, "gridSize": [nav["height"], nav["width"]], "candidateCount": len(candidate_records()), "routingRegion": "localized-jezero"}


@app.get("/api/missions")
def missions():
    manifest = manifest_data()["missions"]
    return {"missions": [{"id": m, **manifest[m], "routingAvailable": m in (ROVER_MISSION, "past-life-jezero")} for m in MISSIONS]}


@app.get("/api/missions/{mission_id}/candidates")
def candidates(mission_id: str):
    if mission_id not in MISSIONS:
        raise HTTPException(404, "Unknown MarsPath mission")
    return {"missionId": mission_id, "candidates": [c for c in candidate_records() if c["missionId"] == mission_id], "coordinateSystem": manifest_data()["coordinateSystem"]}


@app.get("/api/candidates/{candidate_id}")
def candidate(candidate_id: str):
    match = next((c for c in candidate_records() if c["id"] == candidate_id), None)
    if match is None:
        raise HTTPException(404, "Unknown candidate ID")
    return match


@app.get("/api/map/metadata")
def map_metadata():
    nav = grid_data()
    landing_center = point_to_mars_xy(int(nav["landing"]["row"]), int(nav["landing"]["col"]))
    return {"region": "localized-jezero", "crs": "ESRI:103885", "widthCells": nav["width"], "heightCells": nav["height"], "cellSizeMeters": nav["cell_size_m"], "blockedCode": nav["blocked_value"], "landing": nav["landing"], "transform": nav["source_transform"], "image": "/data/landing_area_ortho_preview.png", "routeOrigins": [200, 200], "butlerCellCenterMars": {"latNorth": round(math.degrees(landing_center["y"]/MARS_RADIUS_M), 8), "lonEast": round(math.degrees(landing_center["x"]/MARS_RADIUS_M), 8)}, "startModes": ["butler", "manual"], "imageryCoverageNote": "Approximate grid-to-raster alignment; compare original source transforms for precision use"}


@app.post("/api/mars/resolve-start")
def resolve_start(coords: MarsCoordinates):
    """Validate Mars lat/lon and locate a traversable start in the Jezero grid."""
    return resolve_mars_start(coords)


@app.get("/api/cell/{row}/{col}")
def cell(row: int, col: int):
    if not 0 <= row < 401 or not 0 <= col < 401:
        raise HTTPException(400, detail={"code": "OUT_OF_BOUNDS", "message": "Valid grid rows and columns are 0 to 400"})
    value = grid_data()["costs"][row][col]
    return {"row": row, "col": col, "cost": value, "traversable": value != 255, "interpretation": "blocked/unknown" if value == 255 else ("higher model cost" if value == 5 else "lower model cost")}


def astar(costs: list[list[int]], source: tuple[int, int], target: tuple[int, int], objective: Literal["shortest", "lower"]) -> list[tuple[int, int]] | None:
    """Admissible octile heuristic; diagonal moves cannot cut blocked corners."""
    cardinal = 5.0
    diagonal = 5.0 * math.sqrt(2)
    def heuristic(node: tuple[int, int]) -> float:
        dr, dc = abs(node[0] - target[0]), abs(node[1] - target[1])
        return cardinal * (max(dr, dc) - min(dr, dc)) + diagonal * min(dr, dc)
    queue = [(heuristic(source), 0.0, source)]
    previous: dict[tuple[int, int], tuple[int, int]] = {}
    best = {source: 0.0}
    while queue:
        _, current_g, current = heapq.heappop(queue)
        if current_g > best.get(current, float("inf")) + 1e-7:
            continue
        if current == target:
            path = [current]
            while path[-1] != source:
                path.append(previous[path[-1]])
            return path[::-1]
        r, c = current
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if not (dr or dc):
                    continue
                nr, nc = r + dr, c + dc
                if not is_open(nr, nc, costs):
                    continue
                if dr and dc and (not is_open(r + dr, c, costs) or not is_open(r, c + dc, costs)):
                    continue
                length = diagonal if dr and dc else cardinal
                movement_cost = length if objective == "shortest" else length * costs[nr][nc]
                new_cost = current_g + movement_cost
                neighbor = (nr, nc)
                if new_cost + 1e-7 < best.get(neighbor, float("inf")):
                    best[neighbor] = new_cost
                    previous[neighbor] = current
                    heapq.heappush(queue, (new_cost + heuristic(neighbor), new_cost, neighbor))
    return None


def route_stats(path: list[tuple[int, int]], kind: Literal["shortest", "lower"], costs: list[list[int]]) -> dict:
    lengths = [5 * (math.sqrt(2) if a[0] != b[0] and a[1] != b[1] else 1) for a, b in zip(path, path[1:])]
    distance = sum(lengths)
    weighted = sum(length * costs[p[0]][p[1]] for length, p in zip(lengths, path[1:]))
    high_length = sum(length for length, p in zip(lengths, path[1:]) if costs[p[0]][p[1]] == 5)
    # Simple number of changes of heading; not independently measured waypoints.
    changes = sum(((b[0]-a[0], b[1]-a[1]) != (c[0]-b[0], c[1]-b[1])) for a, b, c in zip(path, path[1:], path[2:]))
    return {"id": kind, "label": "Shortest route" if kind == "shortest" else "Lower-terrain-cost route", "geometry": [{"row": r, "col": c} for r, c in path], "metrics": {"distanceMeters": round(distance, 2), "estimatedMinutes": round(distance / ESTIMATED_WALK_M_PER_MIN, 1), "traversalCost": round(weighted, 2), "highCostExposurePercent": round(high_length / distance * 100, 1) if distance else 0.0, "waypoints": changes}, "dataSources": ["NASA-derived local Jezero navigation grid", "MarsPath derived 1/5/255 terrain cost model"], "modelNotice": "Simulated travel, not safety-certified navigation"}


@app.post("/api/routes/generate")
@app.post("/routes/generate")
def generate_routes(request: RouteRequest):
    if request.missionId != ROVER_MISSION:
        raise HTTPException(422, detail={"code": "ROUTING_UNAVAILABLE", "message": "Only the localized Jezero navigation grid supports A* routing"})
    nav = grid_data()
    costs = nav["costs"]
    butler = Point(row=int(nav["landing"]["row"]), col=int(nav["landing"]["col"]))
    if request.startMode == "butler":
        if request.startCoordinates is not None:
            raise HTTPException(422, detail={"code": "START_MODE_MISMATCH", "message": "Butler start cannot include manual coordinates"})
        if request.start is not None and request.start != butler:
            raise HTTPException(422, detail={"code": "START_MODE_MISMATCH", "message": "Use startMode=manual with Mars latitude/longitude to select another start"})
        start = butler
        start_resolution = None
    else:
        if request.startCoordinates is None:
            raise HTTPException(422, detail={"code": "MISSING_MARS_COORDINATES", "message": "Manual start requires Mars latitude and longitude"})
        if request.start is not None:
            raise HTTPException(422, detail={"code": "START_MODE_MISMATCH", "message": "Manual starts are supplied using Mars coordinates, not grid row/column"})
        start_resolution = resolve_mars_start(request.startCoordinates)
        start = Point(**start_resolution["start"])
    validate_cell(start, costs, "Start")
    validate_cell(request.destination, costs, "Destination")
    if request.candidateId:
        candidate = next((x for x in candidate_records() if x["id"] == request.candidateId and x["missionId"] == ROVER_MISSION), None)
        if candidate is None:
            raise HTTPException(422, detail={"code": "INVALID_CANDIDATE", "message": "Unknown rover mission candidate"})
        if candidate["localGridPoint"] != request.destination.model_dump():
            raise HTTPException(422, detail={"code": "CANDIDATE_DESTINATION_MISMATCH", "message": "Candidate ID cannot be assigned to a different grid destination"})
    origin, destination = (start.row, start.col), (request.destination.row, request.destination.col)
    if origin == destination:
        raise HTTPException(422, detail={"code": "SAME_POINT", "message": "Start and destination resolve to the same 5 m grid cell. Choose a different destination."})
    if len(set(request.scienceStopIds)) != len(request.scienceStopIds):
        raise HTTPException(422, detail="Duplicate science stops are not allowed")
    stops = []
    for identifier in request.scienceStopIds:
        record = next((c for c in candidate_records() if c["id"] == identifier and c["missionId"] == ROVER_MISSION), None)
        if not record or not record.get("routingSupported") or not record.get("localGridPoint"):
            raise HTTPException(422, detail="Science stop must be a supported local Jezero candidate")
        point = Point(**record["localGridPoint"])
        validate_cell(point, costs, "Science stop")
        if (point.row, point.col) in (origin, destination):
            raise HTTPException(422, detail="Science stops must differ from start and destination")
        stops.append({"id": identifier, "name": record["name"], "point": point.model_dump()})
    targets = [(s["point"]["row"], s["point"]["col"]) for s in stops] + [destination]
    routes = []
    for kind in ("shortest", "lower"):
        path = [origin]
        legs = []
        for target in targets:
            segment = astar(costs, path[-1], target, kind)
            if segment is None:
                path = None
                break
            legs.append(route_stats(segment, kind, costs)["metrics"])
            path.extend(segment[1:])
        if path is not None:
            result = route_stats(path, kind, costs)
            result["scienceStops"] = stops
            result["legs"] = legs
            routes.append(result)
    if not routes:
        raise HTTPException(404, detail={"code": "UNREACHABLE", "message": "No traversable route connects the supplied cells"})
    return {"status": "success", "source": "api", "region": "localized-jezero", "objective": request.objective, "start": start.model_dump(), "startMode": request.startMode, "startResolution": start_resolution, "destination": request.destination.model_dump(), "candidateId": request.candidateId, "routes": routes, "notices": ["This is a model-based route over a derived grid, not a verified EVA safety corridor", "Travel time uses an illustrative 22 meters/minute assumption", "Routing does not incorporate live radiation or atmospheric data"]}


def distance_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) if dx * dx + dy * dy else 0.0
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


@app.post("/api/navigation/deviation")
def deviation(request: DeviationRequest):
    row, col = request.position.row, request.position.col
    distance_cells = min(distance_to_segment(col, row, a.col, a.row, b.col, b.row) for a, b in zip(request.route, request.route[1:]))
    distance_m = distance_cells * grid_data()["cell_size_m"]
    # Avoid confident off-route detection when error envelopes overlap.
    threshold = request.corridorMeters + request.accuracyMeters
    return {"source": "manual-or-simulation", "distanceFromRouteMeters": round(distance_m, 2), "corridorMeters": request.corridorMeters, "positionAccuracyMeters": request.accuracyMeters, "offRoute": distance_m > threshold, "uncertaintyNote": "Position estimates must come from a declared manual or simulated source; no Mars GPS is connected"}
