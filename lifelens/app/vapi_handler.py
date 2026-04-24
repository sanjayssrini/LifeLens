from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from time import monotonic
from typing import Any, Dict, List

from app.services.action_engine import ActionEngine
from app.services.intent_engine import IntentCascadeEngine
from app.services.life_insight_service import LifeInsightService
from app.services.memory_service import MemoryService
from app.services.schemas import ActionResult, VapiEvent, VapiToolCall
from app.services.state_store import StateStore
from app.services.user_service import UserService


class VapiHandler:
    def __init__(
        self,
        intent_engine: IntentCascadeEngine,
        action_engine: ActionEngine,
        memory_service: MemoryService,
        insight_service: LifeInsightService,
        state_store: StateStore,
        user_service: UserService | None = None,
        fast_mode: bool = True,
    ) -> None:
        self.intent_engine = intent_engine
        self.action_engine = action_engine
        self.memory_service = memory_service
        self.insight_service = insight_service
        self.state_store = state_store
        self.user_service = user_service
        self.fast_mode = bool(fast_mode)
        self._bg_executor = ThreadPoolExecutor(max_workers=2)
        self._last_voice_memory: Dict[str, tuple[str, float]] = {}

    def _submit_background(self, fn, *args, **kwargs) -> None:
        try:
            self._bg_executor.submit(fn, *args, **kwargs)
        except Exception:
            pass

    def _should_store_voice_turn(self, user_id: str, transcript: str) -> bool:
        normalized = transcript.strip().lower()
        if not normalized:
            return False

        last = self._last_voice_memory.get(user_id)
        now = monotonic()
        if last and last[0] == normalized and (now - last[1]) <= 10:
            return False

        self._last_voice_memory[user_id] = (normalized, now)
        return True

    def _append_profile_memory(self, user_id: str, transcript: str, source: str) -> None:
        if self.user_service is None:
            return
        try:
            self.user_service.append_user_memory(
                user_id=user_id,
                memory_item={
                    "content": transcript,
                    "intent": "voice_conversation",
                    "preferences": {},
                    "metadata": {
                        "source": source,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                },
            )
        except Exception:
            # Voice reply should not fail when profile-memory mirroring fails.
            pass

    @staticmethod
    def _extract_metadata(payload: Dict[str, Any]) -> Dict[str, Any]:
        candidates = [
            payload.get("metadata"),
            payload.get("assistantRequest", {}).get("metadata") if isinstance(payload.get("assistantRequest"), dict) else None,
            payload.get("assistant_request", {}).get("metadata") if isinstance(payload.get("assistant_request"), dict) else None,
            payload.get("request", {}).get("metadata") if isinstance(payload.get("request"), dict) else None,
        ]
        merged: Dict[str, Any] = {}
        for item in candidates:
            if isinstance(item, dict):
                merged.update(item)
        return merged

    @staticmethod
    def _extract_transcript(payload: Dict[str, Any]) -> str:
        transcript = payload.get("transcript") or payload.get("message") or ""
        if transcript:
            return str(transcript)

        candidate_paths = [
            payload.get("assistantRequest") or {},
            payload.get("assistant_request") or {},
            payload.get("request") or {},
            payload.get("input") or {},
        ]
        for item in candidate_paths:
            if not isinstance(item, dict):
                continue
            nested = item.get("transcript") or item.get("message") or item.get("text") or ""
            if nested:
                return str(nested)

        messages = payload.get("messages")
        if isinstance(messages, list):
            for entry in reversed(messages):
                if not isinstance(entry, dict):
                    continue
                role = str(entry.get("role") or entry.get("speaker") or "").lower()
                if role not in {"user", "caller"}:
                    continue
                nested = entry.get("transcript") or entry.get("message") or entry.get("text") or ""
                if nested:
                    return str(nested)

        return ""

    @staticmethod
    def _extract_role(payload: Dict[str, Any], metadata: Dict[str, Any]) -> str:
        direct = payload.get("role") or payload.get("speaker") or metadata.get("role")
        if direct:
            return str(direct).lower()

        candidate_paths = [
            payload.get("assistantRequest") or {},
            payload.get("assistant_request") or {},
            payload.get("request") or {},
            payload.get("input") or {},
        ]
        for item in candidate_paths:
            if not isinstance(item, dict):
                continue
            nested = item.get("role") or item.get("speaker")
            if nested:
                return str(nested).lower()
        return ""

    def _execute_tool_calls(self, user_id: str, tool_calls: List[VapiToolCall]) -> List[ActionResult]:
        results: List[ActionResult] = []
        for call in tool_calls:
            args = dict(call.arguments)
            args.setdefault("user_id", user_id)
            results.append(self.action_engine.execute(call.function, args))
        return results

    def process_text_input(self, text: str, user_id: str = "anonymous", metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
        text = (text or "").strip()
        if not text:
            return {
                "reply": "I am here. Please share what is on your mind.",
                "intent": {"primary_intent": "conversation", "derived_intents": [], "urgency": "low", "confidence": 0.5, "reasoning": "empty transcript"},
                "actions": [],
                "memory_hits": [],
            }

        metadata = metadata or {}
        intent = self.intent_engine.analyze(text)
        try:
            if self.fast_mode:
                memory_hits = self.memory_service.recent_user_memory(user_id=user_id, limit=3)
            else:
                memory_hits = self.memory_service.search_similar(text, user_id=user_id)
                if not memory_hits:
                    memory_hits = self.memory_service.recent_user_memory(user_id=user_id, limit=3)
        except Exception:
            memory_hits = []
        action_results = self.action_engine.derive_actions(
            primary_intent=intent.primary_intent,
            derived_intents=intent.derived_intents,
            user_id=user_id,
        )

        response_text = self.intent_engine.build_voice_response(
            user_text=text,
            intent=intent,
            memory_hits=[hit.get("transcript", "") for hit in memory_hits],
            action_results=action_results,
        )

        memory_lines = [str(hit.get("transcript", ""))[:180] for hit in memory_hits if hit.get("transcript")]
        is_demo_mode = bool(metadata.get("demo_mode", False))
        insight = self.insight_service.generate(
            message=text,
            reply=response_text,
            memory_lines=memory_lines,
            intent=intent,
            demo_mode=is_demo_mode,
        )
        insight_payload = insight.model_dump()
        if insight_payload.get("summary"):
            self._submit_background(
                self.memory_service.store_insight,
                user_id=user_id,
                message=text,
                insight_payload=insight_payload,
                metadata={"source": metadata.get("source", "vapi-webhook"), "mode": "voice"},
            )

        self._submit_background(
            self.memory_service.store_interaction,
            user_id=user_id,
            transcript=text,
            intent=intent,
            metadata={**metadata, "actions": [a.model_dump() for a in action_results]},
        )
        self._submit_background(self._append_profile_memory, user_id=user_id, transcript=text, source="vapi-assistant-request")

        self.state_store.update(
            transcript=text,
            ai_response=response_text,
            actions=action_results,
            last_intent=intent,
        )

        return {
            "reply": response_text,
            "intent": intent.model_dump(),
            "actions": [a.model_dump() for a in action_results],
            "memory_hits": memory_hits,
            "life_insight": insight_payload,
            "recommended_actions": insight_payload.get("recommended_actions", []),
            "demo_mode": is_demo_mode,
        }

    def handle_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        raw_tool_calls = payload.get("tool_calls") or payload.get("toolCalls") or []
        metadata = self._extract_metadata(payload)
        transcript = self._extract_transcript(payload)
        event = VapiEvent(
            type=payload.get("type", "assistant-request"),
            user_id=payload.get("user_id") or payload.get("userId") or metadata.get("user_id") or metadata.get("userId") or "anonymous",
            transcript=transcript,
            tool_calls=[
                VapiToolCall(
                    id=item.get("id"),
                    function=item.get("function") or item.get("name", ""),
                    arguments=item.get("arguments") or {},
                )
                for item in raw_tool_calls
            ],
            metadata=metadata,
        )
        event_type = (event.type or "").strip().lower()

        if event_type == "assistant-request":
            result = self.process_text_input(event.transcript, user_id=event.user_id, metadata=event.metadata)
            return {
                "type": "assistant-response",
                "response": {"text": result["reply"]},
                "intent": result["intent"],
                "actions": result["actions"],
            }

        if event_type == "tool-calls":
            tool_results = self._execute_tool_calls(event.user_id, event.tool_calls)
            self.state_store.update(actions=tool_results)
            return {
                "type": "tool-results",
                "results": [item.model_dump() for item in tool_results],
            }

        role = self._extract_role(payload, event.metadata)
        if event.transcript and role in {"user", "caller"} and self._should_store_voice_turn(event.user_id, event.transcript):
            self._submit_background(
                self.memory_service.store_memory_entry,
                user_id=event.user_id,
                content=event.transcript,
                intent="voice_conversation",
                metadata={
                    **event.metadata,
                    "source": "vapi-transcript-event",
                    "event_type": event.type,
                    "role": role,
                },
            )
            self._submit_background(self._append_profile_memory, user_id=event.user_id, transcript=event.transcript, source="vapi-transcript-event")

        return {
            "type": "noop",
            "response": {"text": "Unsupported event type."},
        }
