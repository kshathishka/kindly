from __future__ import annotations

from datetime import datetime
import hashlib
import hmac
import secrets
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models.common import (
    AuthResponse,
    CaregiverAction,
    CaregiverResponseRequest,
    ChildProfile,
    HelpRequest,
    HelpRequestCreate,
    HelpRequestNeed,
    HelpRequestStatus,
    LoginRequest,
    SignupRequest,
    SocialSkillOption,
    SocialSkillScenario,
    Story,
    StoryRequest,
)
from app.services.storage_service import JSONStorage
from app.services.story_service import StoryService

settings = get_settings()
storage = JSONStorage(settings.json_data_dir)
story_service = StoryService(storage=storage)

FRONTEND_CONFIG: Dict[str, Any] = {
    "situations": ["Doctor visit", "School morning", "New place", "Bedtime", "Something else"],
    "formats": ["Short story", "Visual schedule", "Practice together"],
    "request_types": [
        {"key": "bathroom", "label": "Bathroom", "detail": "I need the bathroom", "color": "yellow"},
        {"key": "break", "label": "I need a break", "detail": "I need quiet", "color": "blue"},
        {"key": "too_loud", "label": "Too loud", "detail": "It is too loud", "color": "purple"},
        {"key": "uncomfortable", "label": "I feel uncomfortable", "detail": "I need support", "color": "coral"},
        {"key": "need_caregiver", "label": "I need my caregiver", "detail": "Please come help me", "color": "green"},
        {"key": "lost", "label": "I'm lost", "detail": "I cannot find you", "color": "red"},
        {"key": "something_hurts", "label": "Something hurts", "detail": "I need help now", "color": "orange"},
    ],
    "difficulty_levels": ["I know it well", "A little new", "Very new"],
    "default_child_name": "Alex",
}

SOCIAL_SKILLS_SCENARIOS: List[SocialSkillScenario] = [
    SocialSkillScenario(
        id="greeting",
        title="Greeting Someone",
        prompt="You see someone you know at school. What would you like to do?",
        options=[
            SocialSkillOption(id="say_hello", label="Say hello", feedback="You could say: 'Hi, how are you?'"),
            SocialSkillOption(id="wave", label="Wave", feedback="A wave can be a friendly way to greet someone."),
            SocialSkillOption(id="smile", label="Smile or nod", feedback="A smile or nod can show you noticed them."),
            SocialSkillOption(id="no_greet", label="I do not want to greet right now", feedback="That is okay. You can choose to greet later."),
        ],
    ),
    SocialSkillScenario(
        id="joining_game",
        title="Joining a Game",
        prompt="Two children are playing a game you want to join. What could you do?",
        options=[
            SocialSkillOption(id="ask_join", label="Ask if you can join", feedback="You could say: 'Can I play too?'"),
            SocialSkillOption(id="watch_first", label="Watch first", feedback="Watching first can help you understand the game."),
            SocialSkillOption(id="wait_pause", label="Wait for a pause", feedback="Waiting for a pause can make joining easier."),
            SocialSkillOption(id="choose_else", label="Choose something else", feedback="Choosing another activity is also a good option."),
        ],
    ),
    SocialSkillScenario(
        id="turn_taking",
        title="Taking Turns in Conversation",
        prompt="Your friend is telling you about their weekend. What would you like to do?",
        options=[
            SocialSkillOption(id="ask_question", label="Ask a question", feedback="You could ask: 'Did you have fun?'"),
            SocialSkillOption(id="share_weekend", label="Tell them about your weekend", feedback="You can share after they finish their turn."),
            SocialSkillOption(id="keep_listening", label="Keep listening", feedback="Listening is a strong social skill."),
            SocialSkillOption(id="dont_know", label="Say you do not know what to say", feedback="It is okay to ask for help with what to say."),
        ],
    ),
    SocialSkillScenario(
        id="clarification",
        title="Asking for Clarification",
        prompt="You are not sure what someone means. What can you do?",
        options=[
            SocialSkillOption(id="ask_where", label="Ask: 'Where should I put it?'", feedback="Clear questions help people support you."),
            SocialSkillOption(id="ask_show", label="Ask them to show you", feedback="You can say: 'Can you show me where you mean?'"),
            SocialSkillOption(id="guess", label="Guess", feedback="Guessing can be hard. Asking is often clearer."),
            SocialSkillOption(id="ask_later", label="Wait and ask later", feedback="You can ask when you feel ready."),
        ],
    ),
    SocialSkillScenario(
        id="not_ready_to_talk",
        title="When You Do Not Want to Talk",
        prompt="Someone asks a question, but you do not feel ready to talk.",
        options=[
            SocialSkillOption(id="need_minute", label="Say: 'I need a minute'", feedback="That is a clear and respectful boundary."),
            SocialSkillOption(id="card", label="Use a communication card/button", feedback="Communication tools are valid ways to respond."),
            SocialSkillOption(id="ask_caregiver", label="Ask your caregiver for help", feedback="Getting support is always okay."),
            SocialSkillOption(id="answer_later", label="Answer later", feedback="You can choose a better time to respond."),
        ],
    ),
]

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


@app.get("/api/v1/social-skills/scenarios", response_model=List[SocialSkillScenario])
def list_social_skills_scenarios() -> List[SocialSkillScenario]:
    return SOCIAL_SKILLS_SCENARIOS


@app.post("/api/v1/auth/signup", response_model=AuthResponse, status_code=201)
def signup(request: SignupRequest) -> Dict[str, Any]:
    email = request.email.strip().lower()
    if storage.get_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if request.role not in {"caregiver", "child"}:
        raise HTTPException(status_code=422, detail="Role must be caregiver or child")
    user = storage.create_user({
        "id": str(secrets.token_hex(16)),
        "email": email,
        "password_hash": hash_password(request.password),
        "role": request.role,
    })
    return {"id": user["id"], "email": user["email"], "role": user["role"], "token": secrets.token_urlsafe(32)}


@app.post("/api/v1/auth/login", response_model=AuthResponse)
def login(request: LoginRequest) -> Dict[str, Any]:
    user = storage.get_user_by_email(request.email)
    if user is None or not verify_password(request.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"id": user["id"], "email": user["email"], "role": user["role"], "token": secrets.token_urlsafe(32)}


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


@app.post("/api/v1/help-requests", response_model=HelpRequest, status_code=201)
def create_help_request(request: HelpRequestCreate) -> Dict[str, Any]:
    get_child_or_404(request.child_id)

    is_urgent = request.need in {HelpRequestNeed.LOST, HelpRequestNeed.SOMETHING_HURTS}
    help_request = HelpRequest(
        id=str(uuid4()),
        child_id=request.child_id,
        caregiver_id=request.caregiver_id,
        need=request.need,
        note=request.note,
        is_urgent=is_urgent,
        status=HelpRequestStatus.CAREGIVER_COMING if is_urgent else HelpRequestStatus.SENT,
        caregiver_action=CaregiverAction.COMING if is_urgent else None,
        caregiver_message="Stay where you are - I'm coming." if is_urgent else None,
    )
    return storage.create_help_request(help_request.model_dump())


@app.get("/api/v1/help-requests", response_model=List[HelpRequest])
def list_help_requests(child_id: Optional[str] = Query(default=None)) -> List[Dict[str, Any]]:
    requests = storage.list_help_requests()
    if child_id:
        return [request for request in requests if request.get("child_id") == child_id]
    return requests


@app.get("/api/v1/help-requests/{request_id}", response_model=HelpRequest)
def get_help_request(request_id: str) -> Dict[str, Any]:
    request = storage.get_help_request(request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Help request not found")
    return request


@app.post("/api/v1/help-requests/{request_id}/respond", response_model=HelpRequest)
def respond_help_request(request_id: str, response: CaregiverResponseRequest) -> Dict[str, Any]:
    request = storage.get_help_request(request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Help request not found")

    status_map = {
        CaregiverAction.SEEN: HelpRequestStatus.CAREGIVER_SEEN,
        CaregiverAction.COMING: HelpRequestStatus.CAREGIVER_COMING,
        CaregiverAction.CANNOT_COME: HelpRequestStatus.CAREGIVER_UNAVAILABLE,
    }
    updates: Dict[str, Any] = {
        "caregiver_action": response.action,
        "status": status_map[response.action],
        "caregiver_message": response.caregiver_message,
        "updated_at": datetime.utcnow(),
    }
    if response.action == CaregiverAction.CANNOT_COME:
        updates["alternative_helper_name"] = response.alternative_helper_name

    updated = storage.update_help_request(request_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Help request not found")
    return updated
