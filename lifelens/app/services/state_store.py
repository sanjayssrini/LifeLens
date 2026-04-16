from threading import Lock
from typing import List, Optional

from app.services.schemas import ActionResult, IntentAnalysis, SystemState


class StateStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._state = SystemState()

    def update(
        self,
        transcript: Optional[str] = None,
        ai_response: Optional[str] = None,
        actions: Optional[List[ActionResult]] = None,
        last_intent: Optional[IntentAnalysis] = None,
    ) -> SystemState:
        with self._lock:
            if transcript is not None:
                self._state.transcript = transcript
            if ai_response is not None:
                self._state.ai_response = ai_response
            if actions is not None:
                self._state.actions = actions
            if last_intent is not None:
                self._state.last_intent = last_intent
            return self._state

    def get(self) -> SystemState:
        with self._lock:
            return SystemState.model_validate(self._state.model_dump())
