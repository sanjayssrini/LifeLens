from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(tags=["system"])


class DemoRequest(BaseModel):
    message: str
    user_id: str = "demo_user"


class ChatRequest(BaseModel):
    message: str
    user_id: str = ""
    session_token: str = ""
    source: str = "chat-ui"


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
        "has_qdrant": bool(settings.qdrant_url and settings.qdrant_api_key),
    }


@router.post("/demo-run")
def demo_run(payload: DemoRequest, request: Request) -> dict:
    handler = request.app.state.vapi_handler
    return handler.process_text_input(payload.message, user_id=payload.user_id, metadata={"source": "frontend-demo"})


@router.post("/chat")
def chat(payload: ChatRequest, request: Request) -> dict:
    resolved_user = payload.user_id.strip()
    if not resolved_user and payload.session_token:
        session_service = request.app.state.session_service
        resolved_user = session_service.resolve(payload.session_token) or "chat_user"
    if not resolved_user:
        resolved_user = "chat_user"

    service = request.app.state.conversation_service
    return service.respond(
        user_id=resolved_user,
        message=payload.message,
        source=payload.source,
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
