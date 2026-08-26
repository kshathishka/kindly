from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Request, status

from app.services.storage_service import JSONStorage

"""
Bearer-token authentication.

Signup and login mint a token and store only its SHA-256, so a leaked
sessions.json cannot be replayed. Every /api/v1 route that touches family data
depends on `current_user`, which resolves the token to an account. The
caller's identity comes from that token and never from the request body or a
query parameter, so one caregiver cannot read another family's data by
changing an id.
"""

SESSION_TTL_DAYS = 30
_SCHEME = "bearer"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected = stored_hash.split("$", 1)
    except ValueError:
        return False
    actual = hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(actual, expected)


def issue_token(storage: JSONStorage, user_id: str) -> str:
    """Mints a session token and returns the only copy that is ever readable."""
    token = secrets.token_urlsafe(32)
    now = utcnow()
    storage.purge_expired_sessions(now.isoformat())
    storage.create_session({
        "token_hash": hash_token(token),
        "user_id": user_id,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=SESSION_TTL_DAYS)).isoformat(),
    })
    return token


def revoke_token(storage: JSONStorage, token: str) -> bool:
    return storage.delete_session_by_hash(hash_token(token))


def _bearer_token(request: Request) -> Optional[str]:
    header = request.headers.get("Authorization") or ""
    scheme, _, value = header.partition(" ")
    if scheme.lower() != _SCHEME or not value.strip():
        return None
    return value.strip()


_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Please sign in to continue.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_storage(request: Request) -> JSONStorage:
    """The app's single JSONStorage, attached to app.state at startup."""
    return request.app.state.storage


def current_user(
    request: Request,
    storage: JSONStorage = Depends(get_storage),
) -> Dict[str, Any]:
    """
    Resolves the bearer token to the signed-in account.

    Raises 401 for a missing, unknown or expired token. Every handler that
    reads or writes family data depends on this.
    """
    token = _bearer_token(request)
    if not token:
        raise _UNAUTHORIZED

    session = storage.get_session_by_hash(hash_token(token))
    if session is None:
        raise _UNAUTHORIZED

    if session.get("expires_at", "") <= utcnow().isoformat():
        storage.delete_session_by_hash(session["token_hash"])
        raise _UNAUTHORIZED

    user = storage.get_user(session.get("user_id", ""))
    if user is None:
        # The account went away but the session did not. Clean up rather than
        # leaving a token that resolves to nothing.
        storage.delete_session_by_hash(session["token_hash"])
        raise _UNAUTHORIZED

    return user


def owned_child_or_404(storage: JSONStorage, child_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetches a child profile the caller is allowed to see.

    A profile belonging to someone else returns 404 rather than 403, so the
    endpoint does not confirm that an id exists to a caller who cannot have it.
    """
    child = storage.get_child(child_id)
    if child is None or child.get("caregiver_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Child profile not found")
    return child
