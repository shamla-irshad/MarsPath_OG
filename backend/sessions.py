"""MarsPath planning sessions and user-recorded observations.

SQLite via the standard library: no extra dependency, one file on disk
(``backend/data/sessions.sqlite3``, override with ``MARSPATH_DB``).

A session records what the user chose and how far the simulated walk got. An
observation is text the user typed while exploring; it is always stored with
``source: "user-recorded"`` and is never treated as a measurement, a completed
science activity or an environmental reading.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

DATA_DIR = Path(__file__).resolve().parent / "data"
DB_PATH = Path(os.getenv("MARSPATH_DB", str(DATA_DIR / "sessions.sqlite3")))

router = APIRouter(prefix="/api/sessions", tags=["Sessions and observations"])

SESSION_STATUSES = ("planning", "navigating", "completed", "incomplete", "science-only")
LOCK = threading.Lock()


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute(
        "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created TEXT NOT NULL, updated TEXT NOT NULL, data TEXT NOT NULL)"
    )
    connection.execute(
        "CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, created TEXT NOT NULL, data TEXT NOT NULL)"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS observations_by_session ON observations(session_id, created)"
    )
    return connection


@contextmanager
def _session_db():
    """One connection per operation, serialised by a single module lock."""
    with LOCK:
        connection = _connect()
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def _new_id(length: int) -> str:
    return uuid.uuid4().hex[:length]


def _payload_data(record: dict) -> dict:
    """The mutable part of a session, stored as JSON in the data column."""
    return {k: v for k, v in record.items() if k not in ("id", "created", "updated")}


def _load_session(connection: sqlite3.Connection, session_id: str) -> dict | None:
    row = connection.execute(
        "SELECT id, created, updated, data FROM sessions WHERE id = ?", (session_id,)
    ).fetchone()
    if row is None:
        return None
    return {"id": row["id"], "created": row["created"], "updated": row["updated"], **json.loads(row["data"])}


def _load_observations(connection: sqlite3.Connection, session_id: str) -> list[dict]:
    rows = connection.execute(
        "SELECT id, created, data FROM observations WHERE session_id = ? ORDER BY created, rowid",
        (session_id,),
    ).fetchall()
    return [{"id": row["id"], "created": row["created"], **json.loads(row["data"])} for row in rows]


def _payload(connection: sqlite3.Connection, record: dict) -> dict:
    return {"session": record, "observations": _load_observations(connection, record["id"])}


def _missing(session_id: str) -> HTTPException:
    return HTTPException(404, detail={"code": "SESSION_NOT_FOUND", "message": f"No MarsPath session with id {session_id}"})


class NewSession(BaseModel):
    missionId: str = Field(min_length=1, max_length=80)
    candidateId: str | None = Field(default=None, max_length=80)


class ObservationLocation(BaseModel):
    """Optional position the note was recorded at. Never inferred by the server."""

    lonEast: float | None = Field(default=None, ge=0.0, lt=360.0, allow_inf_nan=False)
    latNorth: float | None = Field(default=None, ge=-90.0, le=90.0, allow_inf_nan=False)
    row: int | None = Field(default=None, ge=0, le=400)
    col: int | None = Field(default=None, ge=0, le=400)


class ObservationInput(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    location: ObservationLocation | None = None

    @field_validator("text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Observation text cannot be blank")
        return text


class SessionPatch(BaseModel):
    """Only the fields below are accepted; anything else is ignored.

    ``candidateId`` accepts an explicit null (clearing the candidate). The other
    fields ignore null, so a client can send a partial patch safely.
    """

    candidateId: str | None = Field(default=None, max_length=80)
    status: Literal["planning", "navigating", "completed", "incomplete", "science-only"] | None = None
    progressPercent: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    selectedRoute: str | None = Field(default=None, max_length=40)
    events: list[dict[str, Any]] | None = Field(default=None, max_length=200)


@router.post("", status_code=201)
def create_session(body: NewSession):
    now = _now()
    record = {
        "id": _new_id(12),
        "created": now,
        "updated": now,
        "missionId": body.missionId,
        "candidateId": body.candidateId,
        "status": "planning",
        "progressPercent": 0,
        "selectedRoute": None,
        "events": [],
    }
    with _session_db() as connection:
        connection.execute(
            "INSERT INTO sessions (id, created, updated, data) VALUES (?, ?, ?, ?)",
            (record["id"], now, now, json.dumps(_payload_data(record))),
        )
        return _payload(connection, record)


@router.get("/{session_id}")
def read_session(session_id: str):
    with _session_db() as connection:
        record = _load_session(connection, session_id)
        if record is None:
            raise _missing(session_id)
        return _payload(connection, record)


@router.patch("/{session_id}")
def update_session(session_id: str, body: SessionPatch):
    changes = body.model_dump(exclude_unset=True)
    with _session_db() as connection:
        record = _load_session(connection, session_id)
        if record is None:
            raise _missing(session_id)
        for key, value in changes.items():
            if key in ("candidateId", "selectedRoute"):
                record[key] = value
            elif value is not None:
                if key == "progressPercent":
                    value = round(float(value), 1)
                record[key] = value
        if "events" in record and not isinstance(record["events"], list):
            record["events"] = []
        now = _now()
        connection.execute(
            "UPDATE sessions SET updated = ?, data = ? WHERE id = ?",
            (now, json.dumps(_payload_data(record)), session_id),
        )
        record["updated"] = now
        return _payload(connection, record)


@router.post("/{session_id}/observations", status_code=201)
def add_observation(session_id: str, body: ObservationInput):
    location = body.location.model_dump(exclude_none=True) if body.location else {}
    now = _now()
    observation = {
        "id": _new_id(10),
        "created": now,
        "sessionId": session_id,
        "source": "user-recorded",
        "text": body.text,
        "location": location or None,
    }
    with _session_db() as connection:
        record = _load_session(connection, session_id)
        if record is None:
            raise _missing(session_id)
        connection.execute(
            "INSERT INTO observations (id, session_id, created, data) VALUES (?, ?, ?, ?)",
            (
                observation["id"],
                session_id,
                now,
                json.dumps({k: v for k, v in observation.items() if k not in ("id", "created")}),
            ),
        )
        connection.execute("UPDATE sessions SET updated = ? WHERE id = ?", (now, session_id))
        record["updated"] = now
        return {"observation": observation, **_payload(connection, record)}
