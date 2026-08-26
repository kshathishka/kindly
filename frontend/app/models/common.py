from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class CommunicationLevel(str, Enum):
    PRE_VERBAL = "pre-verbal"
    SIMPLE_SENTENCES = "simple-sentences"
    CONVERSATIONAL = "conversational"
    ADVANCED = "advanced"


class PreferredLanguage(str, Enum):
    SIMPLE = "simple"
    MODERATE = "moderate"
    DETAILED = "detailed"


class SensoryLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ChildProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(..., min_length=1, max_length=50)
    age: Optional[int] = Field(default=None, ge=1, le=18)
    communication_level: CommunicationLevel
    special_interests: List[str] = Field(default_factory=list)
    sensory_sensitivities: dict = Field(
        default_factory=lambda: {
            "sound": "low",
            "light": "low",
            "touch": "low",
            "smell": "low",
            "crowds": "low",
            "texture": "low",
        }
    )
    preferred_language: PreferredLanguage = PreferredLanguage.SIMPLE
    known_triggers: List[str] = Field(default_factory=list)
    favorite_activities: List[str] = Field(default_factory=list)
    calming_techniques: List[str] = Field(default_factory=list)
    preferred_pronouns: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    story_count: int = 0

    @field_validator("sensory_sensitivities")
    @classmethod
    def validate_sensory_profile(cls, value: dict) -> dict:
        allowed = {"sound", "light", "touch", "smell", "crowds", "texture"}
        if not isinstance(value, dict):
            raise ValueError("sensory_sensitivities must be a dictionary")
        missing = sorted(allowed - set(value.keys()))
        if missing:
            raise ValueError(f"Missing sensory keys: {', '.join(missing)}")
        for key, level in value.items():
            if key not in allowed:
                raise ValueError(f"Unexpected sensory key: {key}")
            if level not in {item.value for item in SensoryLevel}:
                raise ValueError(f"Invalid sensory level for {key}: {level}")
        return value

    @field_validator("preferred_pronouns")
    @classmethod
    def normalize_pronouns(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip() or None


class StoryRequest(BaseModel):
    child_id: str
    situation: str = Field(..., min_length=5, max_length=2000)
    title: Optional[str] = Field(default=None, max_length=100)
    tone: str = Field(default="calm and supportive")
    length: str = Field(default="short")


class Story(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    child_id: str
    title: str
    story: str
    tone: str
    length: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    source: str = "ai"
    prompt_summary: Optional[str] = None
