from __future__ import annotations

from time import perf_counter
from typing import Any, Dict, List, Tuple

import google.generativeai as genai

from app.services.life_insight_service import LifeInsightService
from app.services.memory_service import MemoryService
from app.services.schemas import LifeInsight
from app.services.schemas import IntentAnalysis
from app.services.settings import Settings


class ConversationService:
    def __init__(self, settings: Settings, memory_service: MemoryService, insight_service: LifeInsightService) -> None:
        self.settings = settings
        self.memory_service = memory_service
        self.insight_service = insight_service
        self.enabled = bool(settings.gemini_api_key)
        self.model_names = [
            settings.gemini_model,
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
        ]

        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)

    def _generate(self, prompt: str) -> Tuple[str, str]:
        if not self.enabled:
            return (
                "I am here with you. Tell me more about what is happening and what kind of support you need right now.",
                "fallback-offline",
            )

        last_exception: Exception | None = None
        for model_name in self.model_names:
            try:
                model = genai.GenerativeModel(model_name=model_name)
                response = model.generate_content(prompt)
                text = (response.text or "").strip()
                if text:
                    return text, model_name
            except Exception as exception:
                last_exception = exception

        if last_exception is not None:
            return (
                "I am still with you. I had a temporary model issue, but we can continue. Share your biggest concern in one line and I will help directly.",
                "fallback-error",
            )
        return (
            "I am still with you. Share your biggest concern in one line and I will help directly.",
            "fallback-unknown",
        )

    def _extract_memory_lines(self, memory_hits: List[Dict[str, Any]], limit: int = 4) -> List[str]:
        lines: List[str] = []
        for item in memory_hits:
            text = str(item.get("transcript", "")).strip()
            if len(text) < 10:
                continue
            lines.append(text[:180])
            if len(lines) >= limit:
                break
        return lines

    def respond(self, user_id: str, message: str, source: str, demo_mode: bool = False) -> Dict[str, Any]:
        started = perf_counter()
        memory_hits = self.memory_service.search_similar(message, user_id=user_id, limit=5)
        memory_lines = self._extract_memory_lines(memory_hits)

        style_line = (
            "Use richer tone and more expressive confidence for demo impact."
            if (demo_mode or self.settings.demo_mode)
            else "Use calm, premium language with practical clarity."
        )
        prompt = (
            "You are LifeLens conversation mode."
            " Have a natural, human, supportive conversation."
            " Do NOT output intent labels or robotic structures."
            " Keep it concise (60-120 words), practical, and emotionally intelligent."
            " If user is casual, respond casually. If user is distressed, be supportive and actionable."
            " If user uses profanity, de-escalate and stay helpful."
            f" {style_line}"
            f"\nUser message: {message}"
            f"\nRelevant memory context: {' | '.join(memory_lines) if memory_lines else 'none'}"
        )

        reply, model_used = self._generate(prompt)

        intent = IntentAnalysis(
            primary_intent="conversation",
            derived_intents=["dialog_support"],
            urgency="high" if LifeInsightService.is_meaningful_turn(message) else "medium",
            confidence=0.75 if LifeInsightService.is_meaningful_turn(message) else 0.7,
            reasoning="Gemini conversation mode",
        )

        insight = self.insight_service.generate(
            message=message,
            reply=reply,
            memory_lines=memory_lines,
            intent=intent,
            demo_mode=(demo_mode or self.settings.demo_mode),
        )
        insight_payload = insight.model_dump() if isinstance(insight, LifeInsight) else {}
        if insight_payload.get("summary"):
            self.memory_service.store_insight(
                user_id=user_id,
                message=message,
                insight_payload=insight_payload,
                metadata={"source": source, "mode": "chat"},
            )
        recent_insights = [insight_payload] if insight_payload.get("summary") else []

        self.memory_service.store_interaction(
            user_id=user_id,
            transcript=message,
            intent=intent,
            metadata={
                "source": source,
                "mode": "gemini-conversation",
                "reply": reply,
                "model_used": model_used,
                "demo_mode": bool(demo_mode or self.settings.demo_mode),
            },
        )

        return {
            "reply": reply,
            "memory_hits": memory_hits,
            "memory_used": bool(memory_lines),
            "model_used": model_used,
            "processing_ms": round((perf_counter() - started) * 1000, 2),
            "life_insight": insight_payload,
            "recent_insights": recent_insights,
            "recommended_actions": insight_payload.get("recommended_actions", []),
            "demo_mode": bool(demo_mode or self.settings.demo_mode),
        }
