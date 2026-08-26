import os
import tempfile

# Point the app at a throwaway data directory *before* app.config is imported.
# get_settings() is lru_cached and app.main builds its JSONStorage at import
# time, so this has to happen at module scope in conftest, which pytest loads
# first. Without it the suite writes into the committed data/*.json files.
_TMP_DATA_DIR = tempfile.mkdtemp(prefix="kindly-tests-")
os.environ["JSON_DATA_DIR"] = _TMP_DATA_DIR

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from uuid import uuid4  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def anon() -> TestClient:
    """A client with no credentials, for testing the auth boundary itself."""
    return TestClient(app)


def _register(client: TestClient) -> dict:
    email = f"fixture-{uuid4()}@example.com"
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "correct horse battery"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def client() -> TestClient:
    """
    A client signed in as a fresh caregiver.

    Each test gets its own account, so one test's child profiles are invisible
    to the next and ownership checks are exercised for real.
    """
    c = TestClient(app)
    auth = _register(c)
    c.headers.update({"Authorization": f"Bearer {auth['token']}"})
    c.kindly_user = auth  # type: ignore[attr-defined]
    return c


@pytest.fixture
def other_client() -> TestClient:
    """A second, unrelated caregiver — used to prove one cannot see the other."""
    c = TestClient(app)
    auth = _register(c)
    c.headers.update({"Authorization": f"Bearer {auth['token']}"})
    c.kindly_user = auth  # type: ignore[attr-defined]
    return c


@pytest.fixture
def child_payload() -> dict:
    """A valid ChildProfile body. All six sensory keys are required."""
    return {
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
