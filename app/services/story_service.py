from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.models.common import Story, StoryRequest
from app.services.ai_service import AIService
from app.services.storage_service import JSONStorage


class StoryService:
    def __init__(self, storage: Optional[JSONStorage] = None, ai_service: Optional[AIService] = None):
        self.storage = storage or JSONStorage()
        self.ai_service = ai_service or AIService()

    def generate_story(self, request: StoryRequest) -> Dict[str, Any]:
        child = self.storage.get_child(request.child_id)
        if child is None:
            raise ValueError("Child profile not found")

        generated = self.ai_service.generate_story(
            child=child,
            situation=request.situation,
            title=request.title or "A New Social Story",
            tone=request.tone,
            length=request.length,
        )

        story = Story(
            child_id=request.child_id,
            title=request.title or "A New Social Story",
            story=generated["story"],
            tone=request.tone,
            length=request.length,
            source=generated.get("source", "ai"),
            prompt_summary=generated.get("prompt_summary"),
        )

        stored = self.storage.create_story(story.model_dump())
        child_data = self.storage.get_child(request.child_id)
        if child_data is not None:
            child_data["story_count"] = len(self.storage.get_child_stories(request.child_id))
            child_data["updated_at"] = datetime.utcnow().isoformat()
            self.storage.update_child(request.child_id, child_data)
        return stored

    def list_stories(self, child_id: Optional[str] = None) -> List[Dict[str, Any]]:
        stories = self.storage.list_stories()
        if child_id:
            return [story for story in stories if story.get("child_id") == child_id]
        return stories

    def get_story(self, story_id: str) -> Optional[Dict[str, Any]]:
        return self.storage.get_story(story_id)
