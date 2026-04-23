from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(tags=["system"])


class DemoRequest(BaseModel):
    message: str
    user_id: str = "demo_user"
    demo_mode: bool = True


class ChatRequest(BaseModel):
    message: str
    user_id: str = ""
    session_token: str = ""
    source: str = "chat-ui"
    demo_mode: bool = False


class SignupRequest(BaseModel):
    name: str
    phone_or_email: str


class LoginRequest(BaseModel):
    identifier: str


class MemoryStoreRequest(BaseModel):
    user_id: str
    content: str
    intent: str = "general"
    preferences: dict = {}
    metadata: dict = {}


class MemoryRetrieveRequest(BaseModel):
    user_id: str
    query: str
    limit: int = 5


class MemoryClearRequest(BaseModel):
    user_id: str = ""
    session_token: str = ""


class UserProfileRequest(BaseModel):
    user_id: str = ""
    session_token: str = ""


class ContinuityRequest(BaseModel):
    user_id: str = ""
    session_token: str = ""


class FeedbackRequest(BaseModel):
    user_id: str = ""
    session_token: str = ""
    response_id: str
    feedback: str
    metadata: dict = {}


def _resolve_user_id(payload: ContinuityRequest | FeedbackRequest, request: Request) -> str:
    resolved_user = payload.user_id.strip()
    if not resolved_user and payload.session_token:
        session_service = request.app.state.session_service
        resolved_user = session_service.resolve(payload.session_token) or ""
    return resolved_user


def _memory_text(item: dict) -> str:
    return str(item.get("summary") or item.get("transcript") or item.get("content") or item.get("message") or "").strip()


def _memory_intent(item: dict) -> str:
    raw_intent = item.get("intent") or {}
    if isinstance(raw_intent, dict):
        return str(raw_intent.get("primary_intent") or raw_intent.get("intent") or "").strip()
    return str(raw_intent).strip()


def _infer_topic(memory_items: list[dict]) -> str:
    text = " ".join(_memory_text(item) for item in memory_items).lower()
    topics = [
        ("job search", ["job", "career", "interview", "resume", "work", "opportunities", "hiring"]),
        ("stress", ["stress", "stressed", "anxiety", "anxious", "panic", "overwhelmed"]),
        ("health", ["health", "sleep", "exercise", "doctor", "pain", "medication", "breathing"]),
        ("relationships", ["relationship", "partner", "friend", "family", "lonely"]),
        ("routine", ["routine", "habit", "schedule", "plan", "daily"]),
    ]
    for label, keywords in topics:
        if any(keyword in text for keyword in keywords):
            return label

    for item in memory_items:
        intent = _memory_intent(item).replace("_", " ")
        if intent and intent not in {"general", "conversation", "voice conversation"}:
            return intent
    return "your last conversation"


def _relative_timestamp(value: str) -> str:
    if not value:
        return "recent"
    return "recent"


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "lifelens"}


@router.get("/state")
def get_state(request: Request) -> dict:
    state = request.app.state.state_store.get()
    return state.model_dump()


@router.get("/config")
def get_config(request: Request) -> dict:
    settings = request.app.state.settings
    return {
        "vapi_public_key": settings.vapi_public_key,
        "vapi_assistant_id": settings.vapi_assistant_id,
        "has_gemini": bool(settings.gemini_api_key),
        "has_qdrant": bool(settings.qdrant_url),
        "demo_mode": bool(settings.demo_mode),
    }


@router.post("/demo-run")
def demo_run(payload: DemoRequest, request: Request) -> dict:
    handler = request.app.state.vapi_handler
    return handler.process_text_input(
        payload.message,
        user_id=payload.user_id,
        metadata={"source": "frontend-demo", "demo_mode": bool(payload.demo_mode)},
    )


@router.post("/chat")
def chat(payload: ChatRequest, request: Request) -> dict:
    resolved_user = payload.user_id.strip()
    if not resolved_user and payload.session_token:
        session_service = request.app.state.session_service
        resolved_user = session_service.resolve(payload.session_token) or "chat_user"
    if not resolved_user:
        resolved_user = "chat_user"

    service = request.app.state.chat_service
    return service.respond(
        user_id=resolved_user,
        message=payload.message,
        source=payload.source,
        demo_mode=payload.demo_mode,
    )


@router.post("/signup")
def signup(payload: SignupRequest, request: Request) -> dict:
    user_service = request.app.state.user_service
    session_service = request.app.state.session_service
    user = user_service.create_user(name=payload.name, phone_or_email=payload.phone_or_email)
    token = session_service.create(user_id=user["user_id"])
    return {
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "phone_or_email": user["phone_or_email"],
        },
        "session_token": token,
    }


@router.post("/login")
def login(payload: LoginRequest, request: Request) -> dict:
    user_service = request.app.state.user_service
    session_service = request.app.state.session_service
    user = user_service.login(payload.identifier)
    token = session_service.create(user_id=user["user_id"])
    return {
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "phone_or_email": user["phone_or_email"],
            "memory": user.get("memory", []),
        },
        "session_token": token,
    }


@router.post("/memory/store")
def memory_store(payload: MemoryStoreRequest, request: Request) -> dict:
    memory_service = request.app.state.memory_service
    user_service = request.app.state.user_service

    stored = memory_service.store_memory_entry(
        user_id=payload.user_id,
        content=payload.content,
        intent=payload.intent,
        preferences=payload.preferences,
        metadata=payload.metadata,
    )
    user_service.append_user_memory(
        user_id=payload.user_id,
        memory_item={
            "content": payload.content,
            "intent": payload.intent,
            "preferences": payload.preferences,
            "metadata": payload.metadata,
        },
    )
    return {"status": "ok", "memory": stored}


@router.post("/memory/retrieve")
def memory_retrieve(payload: MemoryRetrieveRequest, request: Request) -> dict:
    memory_service = request.app.state.memory_service
    memories = memory_service.retrieve_user_memory(
        user_id=payload.user_id,
        query=payload.query,
        limit=max(1, min(payload.limit, 20)),
    )
    return {"status": "ok", "memories": memories}


@router.post("/memory/clear")
def memory_clear(payload: MemoryClearRequest, request: Request) -> dict:
    session_service = request.app.state.session_service
    user_service = request.app.state.user_service
    memory_service = request.app.state.memory_service

    resolved_user = payload.user_id.strip()
    if not resolved_user and payload.session_token:
        resolved_user = session_service.resolve(payload.session_token) or ""
    if not resolved_user:
        return {"status": "error", "detail": "Missing user identity."}

    user_service.clear_user_memory(resolved_user)
    memory_service.clear_user_memory(resolved_user)
    return {"status": "ok", "user_id": resolved_user}


@router.post("/user/profile")
def user_profile(payload: UserProfileRequest, request: Request) -> dict:
    session_service = request.app.state.session_service
    user_service = request.app.state.user_service

    resolved_user = payload.user_id.strip()
    if not resolved_user and payload.session_token:
        resolved_user = session_service.resolve(payload.session_token) or ""
    if not resolved_user:
        return {"status": "error", "detail": "Missing user identity."}

    user = user_service.find_by_user_id(resolved_user)
    if not user:
        return {"status": "error", "detail": "User not found."}

    return {
        "status": "ok",
        "user": {
            "user_id": user.get("user_id", ""),
            "name": user.get("name", ""),
            "phone_or_email": user.get("phone_or_email", ""),
            "memory": user.get("memory", []),
        },
    }


@router.post("/conversation/continuity")
def conversation_continuity(payload: ContinuityRequest, request: Request) -> dict:
    resolved_user = _resolve_user_id(payload, request)
    if not resolved_user:
        return {"status": "ok", "memory": None}

    memory_service = request.app.state.memory_service
    try:
        recent_memory = memory_service.recent_user_memory(resolved_user, limit=12)
    except Exception:
        recent_memory = []

    usable_memory = [
        item for item in recent_memory
        if isinstance(item, dict) and item.get("entry_type") != "feedback" and _memory_text(item)
    ]
    if not usable_memory:
        return {"status": "ok", "memory": None}

    usable_memory.sort(key=lambda item: str(item.get("timestamp") or ""), reverse=True)
    latest = usable_memory[0]
    last_topic = _infer_topic(usable_memory[:5])
    latest_text = _memory_text(latest)
    summary = latest_text[:140].rstrip()
    if len(latest_text) > 140:
        summary = f"{summary}..."
    if not summary:
        summary = f"You were focusing on {last_topic}."

    continuity = {
        "last_topic": last_topic,
        "summary": summary,
        "timestamp": _relative_timestamp(str(latest.get("timestamp") or "")),
        "last_intent": _memory_intent(latest) or "conversation",
    }

    return {"status": "ok", "memory": continuity, **continuity}


@router.post("/feedback")
def feedback(payload: FeedbackRequest, request: Request) -> dict:
    resolved_user = _resolve_user_id(payload, request)
    if not resolved_user:
        return {"status": "error", "detail": "Missing user identity."}

    normalized_feedback = payload.feedback.strip().lower()
    if normalized_feedback not in {"positive", "negative"}:
        return {"status": "error", "detail": "Feedback must be positive or negative."}

    memory_service = request.app.state.memory_service
    stored = memory_service.store_feedback(
        user_id=resolved_user,
        response_id=payload.response_id.strip(),
        feedback=normalized_feedback,
        metadata=payload.metadata,
    )
    return {"status": "ok", "feedback": stored}
