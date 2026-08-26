from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models.common import ChildProfile, Story, StoryRequest
from app.services.storage_service import JSONStorage
from app.services.story_service import StoryService

settings = get_settings()
storage = JSONStorage(settings.json_data_dir)
story_service = StoryService(storage=storage)

FRONTEND_CONFIG: Dict[str, Any] = {
    "situations": ["Doctor visit", "School morning", "New place", "Bedtime", "Something else"],
    "formats": ["Short story", "Visual schedule", "Practice together"],
    "request_types": [
        {"label": "Bathroom", "detail": "I need to go", "color": "yellow"},
        {"label": "Drink", "detail": "I am thirsty", "color": "blue"},
        {"label": "Break", "detail": "I need quiet", "color": "purple"},
        {"label": "Help", "detail": "Something is tricky", "color": "coral"},
    ],
    "difficulty_levels": ["I know it well", "A little new", "Very new"],
    "default_child_name": "Alex",
}

app = FastAPI(
    title=settings.app_title,
    version="0.1.0",
    description="StoryBridge AI backend for generating personalized social stories.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_child_or_404(child_id: str) -> Dict[str, Any]:
    child = storage.get_child(child_id)
    if child is None:
        raise HTTPException(status_code=404, detail="Child profile not found")
    return child


@app.get("/")
def root() -> Dict[str, str]:
    return {
        "service": settings.app_title,
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "ai_configured": settings.has_openai_key,
    }


@app.get("/api/v1/frontend-config")
def frontend_config() -> Dict[str, Any]:
    return FRONTEND_CONFIG


@app.get("/api/v1/children", response_model=List[ChildProfile])
def list_children() -> List[Dict[str, Any]]:
    return storage.list_children()


@app.post("/api/v1/children", response_model=ChildProfile)
def create_child(profile: ChildProfile) -> Dict[str, Any]:
    return storage.create_child(profile.model_dump())


@app.get("/api/v1/children/{child_id}", response_model=ChildProfile)
def get_child(child_id: str) -> Dict[str, Any]:
    return get_child_or_404(child_id)


@app.put("/api/v1/children/{child_id}", response_model=ChildProfile)
def update_child(child_id: str, profile: ChildProfile) -> Dict[str, Any]:
    get_child_or_404(child_id)

    profile.id = child_id
    profile.updated_at = datetime.utcnow()
    updated = storage.update_child(child_id, profile.model_dump())
    if updated is None:
        raise HTTPException(status_code=404, detail="Child profile not found")
    return updated


@app.delete("/api/v1/children/{child_id}")
def delete_child(child_id: str) -> Dict[str, str]:
    if not storage.delete_child(child_id):
        raise HTTPException(status_code=404, detail="Child profile not found")
    return {"status": "deleted", "id": child_id}


@app.post("/api/v1/stories/generate", response_model=Story)
def generate_story(request: StoryRequest) -> Dict[str, Any]:
    try:
        return story_service.generate_story(request)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/v1/stories/history", response_model=List[Story])
def story_history(child_id: Optional[str] = Query(default=None)) -> List[Dict[str, Any]]:
    return story_service.list_stories(child_id=child_id)


@app.get("/api/v1/stories/{story_id}", response_model=Story)
def get_story(story_id: str) -> Dict[str, Any]:
    story = story_service.get_story(story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return story
