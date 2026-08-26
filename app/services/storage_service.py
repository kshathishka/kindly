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
        self._ensure_files()

    def _ensure_files(self) -> None:
        for file_path in (self.children_file, self.stories_file):
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
