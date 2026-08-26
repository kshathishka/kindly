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


class HelpRequestNeed(str, Enum):
    BATHROOM = "bathroom"
    BREAK = "break"
    TOO_LOUD = "too_loud"
    UNCOMFORTABLE = "uncomfortable"
    NEED_CAREGIVER = "need_caregiver"
    LOST = "lost"
    SOMETHING_HURTS = "something_hurts"


class HelpRequestStatus(str, Enum):
    SENT = "sent"
    CAREGIVER_SEEN = "caregiver_seen"
    CAREGIVER_RESPONDED = "caregiver_responded"
    CAREGIVER_COMING = "caregiver_coming"
    CAREGIVER_UNAVAILABLE = "caregiver_unavailable"


class CaregiverAction(str, Enum):
    COMING = "coming"
    SEEN = "seen"
    CANNOT_COME = "cannot_come"


class ChildProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    # The caregiver account this profile belongs to. Optional so profiles
    # created before this field existed still load, but everything created
    # through the app now carries one and GET /children filters on it.
    caregiver_id: Optional[str] = None
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


class SignupRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = "caregiver"


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


class AuthResponse(BaseModel):
    id: str
    email: str
    role: str
    token: str


class HelpRequestCreate(BaseModel):
    child_id: str
    need: HelpRequestNeed
    caregiver_id: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=250)


class CaregiverResponseRequest(BaseModel):
    action: CaregiverAction
    caregiver_message: Optional[str] = Field(default=None, max_length=250)
    alternative_helper_name: Optional[str] = Field(default=None, max_length=100)


class HelpRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    child_id: str
    caregiver_id: Optional[str] = None
    need: HelpRequestNeed
    note: Optional[str] = None
    is_urgent: bool = False
    status: HelpRequestStatus = HelpRequestStatus.SENT
    caregiver_action: Optional[CaregiverAction] = None
    caregiver_message: Optional[str] = None
    alternative_helper_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SocialSkillOption(BaseModel):
    id: str
    label: str
    feedback: str


class SocialSkillScenario(BaseModel):
    id: str
    title: str
    prompt: str
    options: List[SocialSkillOption]
