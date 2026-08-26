from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "Kindly",
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


def test_signup_and_login():
    email = f"auth-test-{uuid4()}@example.com"
    signup_response = client.post("/api/v1/auth/signup", json={"email": email, "password": "correct horse"})
    assert signup_response.status_code == 201, signup_response.text
    auth = signup_response.json()
    assert auth["email"] == email
    assert auth["role"] == "caregiver"
    assert auth["token"]

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": "correct horse"})
    assert login_response.status_code == 200, login_response.text
    assert login_response.json()["id"] == auth["id"]


def test_auth_rejects_duplicate_and_invalid_password():
    email = f"duplicate-test-{uuid4()}@example.com"
    client.post("/api/v1/auth/signup", json={"email": email, "password": "correct horse"})
    duplicate_response = client.post("/api/v1/auth/signup", json={"email": email, "password": "correct horse"})
    assert duplicate_response.status_code == 409

    invalid_response = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong password"})
    assert invalid_response.status_code == 401


def test_social_skills_scenarios_available():
    response = client.get("/api/v1/social-skills/scenarios")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload) >= 5
    assert any(item["id"] == "greeting" for item in payload)


def test_help_request_flow_and_caregiver_response():
    child_payload = {
        "name": "Mia",
        "age": 8,
        "communication_level": "conversational",
        "special_interests": ["art"],
        "sensory_sensitivities": {
            "sound": "medium",
            "light": "low",
            "touch": "low",
            "smell": "low",
            "crowds": "medium",
            "texture": "low",
        },
        "preferred_language": "simple",
        "known_triggers": ["surprise noises"],
        "favorite_activities": ["drawing"],
        "calming_techniques": ["counting breaths"],
    }
    child = client.post("/api/v1/children", json=child_payload).json()

    request_response = client.post(
        "/api/v1/help-requests",
        json={
            "child_id": child["id"],
            "need": "bathroom",
            "note": "Please come with me",
        },
    )
    assert request_response.status_code == 201, request_response.text
    request_payload = request_response.json()
    assert request_payload["status"] == "sent"
    assert request_payload["is_urgent"] is False

    caregiver_response = client.post(
        f"/api/v1/help-requests/{request_payload['id']}/respond",
        json={"action": "coming", "caregiver_message": "I am coming now"},
    )
    assert caregiver_response.status_code == 200, caregiver_response.text
    updated_payload = caregiver_response.json()
    assert updated_payload["status"] == "caregiver_coming"
    assert updated_payload["caregiver_action"] == "coming"


def test_help_request_urgent_flow_auto_acknowledged():
    child_payload = {
        "name": "Noah",
        "age": 9,
        "communication_level": "simple-sentences",
        "special_interests": ["maps"],
        "sensory_sensitivities": {
            "sound": "low",
            "light": "low",
            "touch": "low",
            "smell": "low",
            "crowds": "medium",
            "texture": "low",
        },
        "preferred_language": "simple",
        "known_triggers": [],
        "favorite_activities": ["puzzles"],
        "calming_techniques": ["deep breaths"],
    }
    child = client.post("/api/v1/children", json=child_payload).json()

    request_response = client.post(
        "/api/v1/help-requests",
        json={
            "child_id": child["id"],
            "need": "lost",
        },
    )
    assert request_response.status_code == 201, request_response.text
    request_payload = request_response.json()
    assert request_payload["is_urgent"] is True
    assert request_payload["status"] == "caregiver_coming"
    assert request_payload["caregiver_action"] == "coming"
