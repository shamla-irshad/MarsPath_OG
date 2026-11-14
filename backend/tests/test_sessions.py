"""Sessions and observations: create, patch, record, restore, and the error paths.

Each test gets its own SQLite file via MARSPATH_DB-equivalent monkeypatching of
``sessions.DB_PATH``, so the developer's real sessions are never touched.
"""
import pytest
from fastapi.testclient import TestClient

import sessions
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.setattr(sessions, "DB_PATH", tmp_path / "sessions.sqlite3")
    yield


def make_session(mission_id="rover-navigation-jezero", candidate_id="JEZERO_A"):
    response = client.post("/api/sessions", json={"missionId": mission_id, "candidateId": candidate_id})
    assert response.status_code == 201, response.text
    return response.json()["session"]


def test_create_returns_planning_session():
    body = client.post("/api/sessions", json={"missionId": "rover-navigation-jezero"}).json()
    session = body["session"]
    assert session["status"] == "planning"
    assert session["progressPercent"] == 0
    assert session["events"] == []
    assert session["candidateId"] is None
    assert body["observations"] == []
    assert len(session["id"]) == 12
    assert session["missionId"] == "rover-navigation-jezero"


def test_create_requires_a_mission():
    assert client.post("/api/sessions", json={}).status_code == 422


def test_patch_updates_allowed_fields_and_ignores_the_rest():
    session = make_session()
    response = client.patch(
        f"/api/sessions/{session['id']}",
        json={
            "status": "navigating",
            "progressPercent": 42.5,
            "selectedRoute": "lower",
            "events": [{"at": 10, "kind": "started"}],
            "missionId": "water-ice-arcadia",
            "unexpected": "ignored",
        },
    )
    assert response.status_code == 200, response.text
    updated = response.json()["session"]
    assert updated["status"] == "navigating"
    assert updated["progressPercent"] == 42.5
    assert updated["selectedRoute"] == "lower"
    assert updated["events"] == [{"at": 10, "kind": "started"}]
    assert updated["missionId"] == "rover-navigation-jezero"  # immutable
    assert updated["candidateId"] == "JEZERO_A"  # untouched by a partial patch


def test_patch_can_clear_the_candidate():
    session = make_session()
    updated = client.patch(f"/api/sessions/{session['id']}", json={"candidateId": None}).json()["session"]
    assert updated["candidateId"] is None


def test_patch_rejects_invalid_status_and_progress():
    session = make_session()
    bad_status = client.patch(f"/api/sessions/{session['id']}", json={"status": "safe-to-walk"})
    assert bad_status.status_code == 422
    too_much = client.patch(f"/api/sessions/{session['id']}", json={"progressPercent": 140})
    assert too_much.status_code == 422
    negative = client.patch(f"/api/sessions/{session['id']}", json={"progressPercent": -1})
    assert negative.status_code == 422


def test_observation_is_stored_and_returned_with_the_session():
    session = make_session()
    response = client.post(
        f"/api/sessions/{session['id']}/observations",
        json={"text": "  Loose blocky material on the north rim  ", "location": {"row": 210, "col": 215}},
    )
    assert response.status_code == 201, response.text
    created = response.json()["observation"]
    assert created["text"] == "Loose blocky material on the north rim"  # trimmed
    assert created["source"] == "user-recorded"
    assert created["location"] == {"row": 210, "col": 215}
    assert len(created["id"]) == 10
    assert len(response.json()["observations"]) == 1

    restored = client.get(f"/api/sessions/{session['id']}").json()
    assert [o["text"] for o in restored["observations"]] == ["Loose blocky material on the north rim"]


def test_observations_are_ordered_and_survive_reconnect():
    session = make_session()
    for text in ("first note", "second note", "third note"):
        assert client.post(f"/api/sessions/{session['id']}/observations", json={"text": text}).status_code == 201
    fresh = TestClient(app)  # a new client reads the same database
    body = fresh.get(f"/api/sessions/{session['id']}").json()
    assert [o["text"] for o in body["observations"]] == ["first note", "second note", "third note"]


def test_blank_observation_text_is_rejected():
    session = make_session()
    for payload in ({"text": ""}, {"text": "   \n  "}, {"text": "x" * 2001}, {}):
        response = client.post(f"/api/sessions/{session['id']}/observations", json=payload)
        assert response.status_code == 422, payload


def test_unknown_session_returns_404():
    assert client.get("/api/sessions/does-not-exist").status_code == 404
    assert client.patch("/api/sessions/does-not-exist", json={"status": "completed"}).status_code == 404
    assert client.post("/api/sessions/does-not-exist/observations", json={"text": "note"}).status_code == 404


def test_missing_session_reports_a_readable_code():
    detail = client.get("/api/sessions/does-not-exist").json()["detail"]
    assert detail["code"] == "SESSION_NOT_FOUND"


def test_patch_accepts_every_documented_status():
    session = make_session()
    for status in sessions.SESSION_STATUSES:
        response = client.patch(f"/api/sessions/{session['id']}", json={"status": status})
        assert response.status_code == 200, status
        assert response.json()["session"]["status"] == status


def test_patch_preflight_allowed():
    response = client.options('/api/sessions/example', headers={
        'Origin': 'http://127.0.0.1:5173',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'content-type',
    })
    assert response.status_code == 200
    assert 'PATCH' in response.headers['access-control-allow-methods']


def test_selected_route_can_be_cleared():
    session = make_session()
    url = f"/api/sessions/{session['id']}"
    client.patch(url, json={'selectedRoute': 'shortest'})
    assert client.patch(url, json={'selectedRoute': None}).json()['session']['selectedRoute'] is None
