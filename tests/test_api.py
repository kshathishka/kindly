from uuid import uuid4

from fastapi.testclient import TestClient


def test_root_endpoint(anon: TestClient):
    response = anon.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "Kindly",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


def test_create_and_fetch_child_profile(client: TestClient, child_payload: dict):
    create_response = client.post("/api/v1/children", json=child_payload)
    assert create_response.status_code == 200, create_response.text
    child = create_response.json()
    assert child["name"] == "Ava"
    assert child["story_count"] == 0
    # Ownership comes from the token, not the request body.
    assert child["caregiver_id"] == client.kindly_user["id"]

    fetch_response = client.get(f"/api/v1/children/{child['id']}")
    assert fetch_response.status_code == 200
    assert fetch_response.json()["id"] == child["id"]


def test_generate_story_fallback(client: TestClient, child_payload: dict):
    child_payload["name"] = "Leo"
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


def test_frontend_config_endpoint(anon: TestClient):
    response = anon.get("/api/v1/frontend-config")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "situations" in payload
    assert "formats" in payload
    assert "request_types" in payload
    assert "Doctor visit" in payload["situations"]
    assert "Short story" in payload["formats"]


def test_signup_and_login(anon: TestClient):
    email = f"auth-test-{uuid4()}@example.com"
    signup_response = anon.post("/api/v1/auth/signup", json={"email": email, "password": "correct horse"})
    assert signup_response.status_code == 201, signup_response.text
    auth = signup_response.json()
    assert auth["email"] == email
    assert auth["role"] == "caregiver"
    assert auth["token"]

    login_response = anon.post("/api/v1/auth/login", json={"email": email, "password": "correct horse"})
    assert login_response.status_code == 200, login_response.text
    assert login_response.json()["id"] == auth["id"]
    # A second sign-in mints a new token rather than reissuing the first.
    assert login_response.json()["token"] != auth["token"]


def test_auth_rejects_duplicate_and_invalid_password(anon: TestClient):
    email = f"duplicate-test-{uuid4()}@example.com"
    anon.post("/api/v1/auth/signup", json={"email": email, "password": "correct horse"})
    duplicate_response = anon.post("/api/v1/auth/signup", json={"email": email, "password": "correct horse"})
    assert duplicate_response.status_code == 409

    invalid_response = anon.post("/api/v1/auth/login", json={"email": email, "password": "wrong password"})
    assert invalid_response.status_code == 401


def test_social_skills_scenarios_available(anon: TestClient):
    response = anon.get("/api/v1/social-skills/scenarios")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert len(payload) >= 5
    assert any(item["id"] == "greeting" for item in payload)


def test_help_request_flow_and_caregiver_response(client: TestClient, child_payload: dict):
    child_payload["name"] = "Mia"
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


def test_help_request_urgent_flow_auto_acknowledged(client: TestClient, child_payload: dict):
    child_payload["name"] = "Noah"
    child = client.post("/api/v1/children", json=child_payload).json()

    request_response = client.post(
        "/api/v1/help-requests",
        json={"child_id": child["id"], "need": "lost"},
    )
    assert request_response.status_code == 201, request_response.text
    request_payload = request_response.json()
    assert request_payload["is_urgent"] is True
    assert request_payload["status"] == "caregiver_coming"
    assert request_payload["caregiver_action"] == "coming"


# ---------------------------------------------------------------------------
# Authentication and ownership
# ---------------------------------------------------------------------------


def test_data_routes_reject_anonymous_callers(anon: TestClient, child_payload: dict):
    """Every route that touches family data must refuse an unauthenticated call."""
    assert anon.get("/api/v1/children").status_code == 401
    assert anon.post("/api/v1/children", json=child_payload).status_code == 401
    assert anon.get("/api/v1/children/anything").status_code == 401
    assert anon.delete("/api/v1/children/anything").status_code == 401
    assert anon.get("/api/v1/stories/history").status_code == 401
    assert anon.get("/api/v1/help-requests").status_code == 401
    assert anon.post(
        "/api/v1/help-requests",
        json={"child_id": "anything", "need": "bathroom"},
    ).status_code == 401
    assert anon.get("/api/v1/auth/me").status_code == 401


def test_garbage_and_malformed_tokens_are_rejected(anon: TestClient):
    assert anon.get("/api/v1/children", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    # A header with no scheme, and one with an empty token.
    assert anon.get("/api/v1/children", headers={"Authorization": "nonsense"}).status_code == 401
    assert anon.get("/api/v1/children", headers={"Authorization": "Bearer "}).status_code == 401


def test_caregiver_cannot_see_another_familys_child(
    client: TestClient, other_client: TestClient, child_payload: dict
):
    """The core isolation guarantee: one family's data is invisible to another."""
    mine = client.post("/api/v1/children", json=child_payload).json()

    listed = other_client.get("/api/v1/children").json()
    assert all(c["id"] != mine["id"] for c in listed)

    # Fetching by id is a 404, not a 403 — the endpoint does not confirm that
    # an id exists to a caller who may not have it.
    assert other_client.get(f"/api/v1/children/{mine['id']}").status_code == 404
    assert other_client.delete(f"/api/v1/children/{mine['id']}").status_code == 404
    assert other_client.put(f"/api/v1/children/{mine['id']}", json=child_payload).status_code == 404


def test_caregiver_cannot_reach_another_familys_requests_or_stories(
    client: TestClient, other_client: TestClient, child_payload: dict
):
    child = client.post("/api/v1/children", json=child_payload).json()
    request_id = client.post(
        "/api/v1/help-requests",
        json={"child_id": child["id"], "need": "break"},
    ).json()["id"]
    story_id = client.post(
        "/api/v1/stories/generate",
        json={"child_id": child["id"], "situation": "A busy supermarket after school."},
    ).json()["id"]

    assert other_client.get(f"/api/v1/help-requests/{request_id}").status_code == 404
    assert other_client.post(
        f"/api/v1/help-requests/{request_id}/respond",
        json={"action": "coming"},
    ).status_code == 404
    assert other_client.get(f"/api/v1/stories/{story_id}").status_code == 404

    # Nor can they raise a request against a child that is not theirs.
    assert other_client.post(
        "/api/v1/help-requests",
        json={"child_id": child["id"], "need": "bathroom"},
    ).status_code == 404

    # Unfiltered listings only ever cover the caller's own children.
    assert other_client.get("/api/v1/help-requests").json() == []
    assert other_client.get("/api/v1/stories/history").json() == []


def test_ownership_cannot_be_reassigned_through_the_body(
    client: TestClient, other_client: TestClient, child_payload: dict
):
    """A client cannot hand its child to another account, or claim one."""
    other_id = other_client.kindly_user["id"]

    created = client.post(
        "/api/v1/children",
        json={**child_payload, "caregiver_id": other_id},
    ).json()
    assert created["caregiver_id"] == client.kindly_user["id"]

    updated = client.put(
        f"/api/v1/children/{created['id']}",
        json={**child_payload, "caregiver_id": other_id},
    ).json()
    assert updated["caregiver_id"] == client.kindly_user["id"]


def test_logout_revokes_the_token(anon: TestClient):
    email = f"logout-test-{uuid4()}@example.com"
    auth = anon.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "correct horse"},
    ).json()
    headers = {"Authorization": f"Bearer {auth['token']}"}

    assert anon.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert anon.post("/api/v1/auth/logout", headers=headers).status_code == 204

    # The same token is now worthless.
    assert anon.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert anon.get("/api/v1/children", headers=headers).status_code == 401
