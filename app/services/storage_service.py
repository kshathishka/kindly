import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import get_settings


class JSONStorage:
    def __init__(self, base_dir: Optional[str] = None):
        settings = get_settings()
        self.base_dir = Path(base_dir or settings.json_data_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.children_file = self.base_dir / "children.json"
        self.stories_file = self.base_dir / "stories.json"
        self.users_file = self.base_dir / "users.json"
        self.help_requests_file = self.base_dir / "help_requests.json"
        self.sessions_file = self.base_dir / "sessions.json"
        self._ensure_files()

    def _ensure_files(self) -> None:
        for file_path in (
            self.children_file,
            self.stories_file,
            self.users_file,
            self.help_requests_file,
            self.sessions_file,
        ):
            if not file_path.exists():
                file_path.write_text("[]", encoding="utf-8")

    def _read_json(self, file_path: Path) -> List[Dict[str, Any]]:
        try:
            with file_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                return []
            return data
        except (FileNotFoundError, json.JSONDecodeError):
            file_path.write_text("[]", encoding="utf-8")
            return []

    def _write_json(self, file_path: Path, data: List[Dict[str, Any]]) -> None:
        with file_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def list_children(self) -> List[Dict[str, Any]]:
        return self._read_json(self.children_file)

    def get_child(self, child_id: str) -> Optional[Dict[str, Any]]:
        for child in self.list_children():
            if child["id"] == child_id:
                return child
        return None

    def create_child(self, child: Dict[str, Any]) -> Dict[str, Any]:
        children = self.list_children()
        children.append(child)
        self._write_json(self.children_file, children)
        return child

    def update_child(self, child_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        children = self.list_children()
        for index, child in enumerate(children):
            if child["id"] == child_id:
                child.update(updates)
                children[index] = child
                self._write_json(self.children_file, children)
                return child
        return None

    def delete_child(self, child_id: str) -> bool:
        children = self.list_children()
        filtered = [child for child in children if child["id"] != child_id]
        if len(filtered) == len(children):
            return False
        self._write_json(self.children_file, filtered)
        return True

    def list_stories(self) -> List[Dict[str, Any]]:
        return self._read_json(self.stories_file)

    def create_story(self, story: Dict[str, Any]) -> Dict[str, Any]:
        stories = self.list_stories()
        stories.append(story)
        self._write_json(self.stories_file, stories)
        return story

    def get_story(self, story_id: str) -> Optional[Dict[str, Any]]:
        for story in self.list_stories():
            if story["id"] == story_id:
                return story
        return None

    def get_child_stories(self, child_id: str) -> List[Dict[str, Any]]:
        return [story for story in self.list_stories() if story.get("child_id") == child_id]

    def list_users(self) -> List[Dict[str, Any]]:
        return self._read_json(self.users_file)

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        normalized_email = email.strip().lower()
        return next((user for user in self.list_users() if user.get("email") == normalized_email), None)

    def create_user(self, user: Dict[str, Any]) -> Dict[str, Any]:
        users = self.list_users()
        users.append(user)
        self._write_json(self.users_file, users)
        return user

    def list_help_requests(self) -> List[Dict[str, Any]]:
        return self._read_json(self.help_requests_file)

    def get_help_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        for request in self.list_help_requests():
            if request.get("id") == request_id:
                return request
        return None

    def create_help_request(self, help_request: Dict[str, Any]) -> Dict[str, Any]:
        requests = self.list_help_requests()
        requests.append(help_request)
        self._write_json(self.help_requests_file, requests)
        return help_request

    def update_help_request(self, request_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        requests = self.list_help_requests()
        for index, request in enumerate(requests):
            if request.get("id") == request_id:
                request.update(updates)
                requests[index] = request
                self._write_json(self.help_requests_file, requests)
                return request
        return None

    # -- sessions ------------------------------------------------------------
    # Only the SHA-256 of a token is stored. A leaked sessions.json therefore
    # cannot be replayed to sign in as anybody.

    def list_sessions(self) -> List[Dict[str, Any]]:
        return self._read_json(self.sessions_file)

    def create_session(self, session: Dict[str, Any]) -> Dict[str, Any]:
        sessions = self.list_sessions()
        sessions.append(session)
        self._write_json(self.sessions_file, sessions)
        return session

    def get_session_by_hash(self, token_hash: str) -> Optional[Dict[str, Any]]:
        return next(
            (s for s in self.list_sessions() if s.get("token_hash") == token_hash),
            None,
        )

    def delete_session_by_hash(self, token_hash: str) -> bool:
        sessions = self.list_sessions()
        remaining = [s for s in sessions if s.get("token_hash") != token_hash]
        if len(remaining) == len(sessions):
            return False
        self._write_json(self.sessions_file, remaining)
        return True

    def purge_expired_sessions(self, now_iso: str) -> int:
        """Drops sessions whose expiry has passed. Returns how many went."""
        sessions = self.list_sessions()
        live = [s for s in sessions if s.get("expires_at", "") > now_iso]
        if len(live) == len(sessions):
            return 0
        self._write_json(self.sessions_file, live)
        return len(sessions) - len(live)

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return next((u for u in self.list_users() if u.get("id") == user_id), None)
