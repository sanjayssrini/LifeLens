from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes.system import router as system_router
from app.routes.vapi import router as vapi_router
from app.services.action_engine import ActionEngine
from app.services.conversation_service import ConversationService
from app.services.intent_engine import IntentCascadeEngine
from app.services.life_insight_service import LifeInsightService
from app.services.memory_service import MemoryService
from app.services.session_service import SessionService
from app.services.settings import get_settings
from app.services.state_store import StateStore
from app.services.user_service import UserService
from app.vapi_handler import VapiHandler


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="LifeLens API", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    memory_service = MemoryService(settings)
    memory_service.ensure_collection()
    user_service = UserService(memory_service)
    user_service.ensure_collection()
    session_service = SessionService()
    insight_service = LifeInsightService(settings)

    state_store = StateStore()
    vapi_handler = VapiHandler(
        intent_engine=IntentCascadeEngine(settings),
        action_engine=ActionEngine(),
        memory_service=memory_service,
        insight_service=insight_service,
        state_store=state_store,
        user_service=user_service,
    )
    conversation_service = ConversationService(
        settings=settings,
        memory_service=memory_service,
        insight_service=insight_service,
    )

    app.state.state_store = state_store
    app.state.vapi_handler = vapi_handler
    app.state.conversation_service = conversation_service
    app.state.user_service = user_service
    app.state.session_service = session_service
    app.state.memory_service = memory_service
    app.state.settings = settings

    app.include_router(system_router, prefix="/api")
    app.include_router(vapi_router, prefix="/api")

    frontend_dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if frontend_dist.exists():
        app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

    return app


app = create_app()
