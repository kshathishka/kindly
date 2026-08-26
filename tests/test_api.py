from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "StoryBridge AI",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


def test_create_and_fetch_child_profile():
    payload = {
        "name": "Ava",
        "age": 7,
        "communication_level": "simple-sentences",
        "special_interests": ["dinosaurs", "music"],
        "sensory_sensitivities": {
            "sound": "medium",
            "light": "low",
            "touch": "high",
            "smell": "low",
            "crowds": "medium",
            "texture": "high",
        },
        "preferred_language": "simple",
        "known_triggers": ["loud sirens"],
        "favorite_activities": ["story time"],
        "calming_techniques": ["deep breaths"],
        "preferred_pronouns": "she/her",
    }

    create_response = client.post("/api/v1/children", json=payload)
    assert create_response.status_code == 200, create_response.text
    child = create_response.json()
    assert child["name"] == "Ava"
    assert child["story_count"] == 0

    fetch_response = client.get(f"/api/v1/children/{child['id']}")
    assert fetch_response.status_code == 200
    assert fetch_response.json()["id"] == child["id"]


def test_generate_story_fallback():
    child_payload = {
        "name": "Leo",
        "age": 6,
        "communication_level": "simple-sentences",
        "special_interests": ["trains"],
        "sensory_sensitivities": {
            "sound": "medium",
            "light": "low",
            "touch": "medium",
            "smell": "low",
            "crowds": "high",
            "texture": "low",
        },
        "preferred_language": "simple",
        "known_triggers": ["waiting in line"],
        "favorite_activities": ["looking at trains"],
        "calming_techniques": ["counting to five"],
    }

    child = client.post("/api/v1/children", json=child_payload).json()
    response = client.post(
        "/api/v1/stories/generate",
        json={
            "child_id": child["id"],
            "situation": "Leo is waiting in line at the grocery store and feels upset because people are talking loudly.",
            "title": "Waiting in line",
            "tone": "calm and supportive",
            "length": "short",
        },
    )

    assert response.status_code == 200, response.text
    story = response.json()
    assert story["child_id"] == child["id"]
    assert "story" in story
    assert len(story["story"]) > 50


def test_frontend_config_endpoint():
    response = client.get("/api/v1/frontend-config")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "situations" in payload
    assert "formats" in payload
    assert "request_types" in payload
    assert "Doctor visit" in payload["situations"]
    assert "Short story" in payload["formats"]
