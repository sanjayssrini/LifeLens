from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
import re
from time import perf_counter
from time import time
from typing import Any, Dict, List, Tuple

import google.generativeai as genai

from app.services.emotion_service import EmotionService
from app.services.cheerup_service import CheerupService
from app.services.language_service import LanguageService
from app.services.life_insight_service import LifeInsightService
from app.services.memory_service import MemoryService
from app.services.schemas import LifeInsight
from app.services.schemas import IntentAnalysis
from app.services.settings import Settings


class ConversationService:
    def __init__(self, settings: Settings, memory_service: MemoryService, insight_service: LifeInsightService, language_service: LanguageService | None = None, emotion_service: EmotionService | None = None, cheerup_service: CheerupService | None = None) -> None:
        self.settings = settings
        self.memory_service = memory_service
        self.insight_service = insight_service
        self.language_service = language_service
        self.emotion_service = emotion_service
        self.cheerup_service = cheerup_service
        self.enabled = bool(settings.gemini_api_key)
        preferred_models = [
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            settings.gemini_model,
        ]
        self.model_names = list(dict.fromkeys(model for model in preferred_models if model))
        self._models: Dict[str, genai.GenerativeModel] = {}
        self._preferred_model: str = ""
        self._model_failure_counts: Dict[str, int] = {}
        self._model_disabled_until: Dict[str, float] = {}

        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)

    def _candidate_models(self) -> List[str]:
        now = time()
        models = [
            model_name
            for model_name in self.model_names
            if now >= self._model_disabled_until.get(model_name, 0.0)
        ]

        if self._preferred_model and self._preferred_model in models:
            models = [self._preferred_model, *[name for name in models if name != self._preferred_model]]
        return models

    def _mark_model_failure(self, model_name: str) -> None:
        failures = self._model_failure_counts.get(model_name, 0) + 1
        self._model_failure_counts[model_name] = failures
        cooldown_seconds = min(900, 120 * failures)
        self._model_disabled_until[model_name] = time() + cooldown_seconds

    def _mark_model_success(self, model_name: str) -> None:
        self._model_failure_counts[model_name] = 0
        self._model_disabled_until[model_name] = 0.0
        self._preferred_model = model_name

    def _generate(self, prompt: str) -> Tuple[str, str]:
        if not self.enabled:
            return (
                "I am here with you. Tell me more about what is happening and what kind of support you need right now.",
                "fallback-offline",
            )

        last_exception: Exception | None = None
        candidate_models = self._candidate_models() or self.model_names
        for model_name in candidate_models:
            try:
                model = self._models.get(model_name)
                if model is None:
                    model = genai.GenerativeModel(model_name=model_name)
                    self._models[model_name] = model
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": 0.6,
                        "max_output_tokens": 520,
                    },
                )
                text = self._extract_response_text(response)
                if text:
                    self._mark_model_success(model_name)
                    return text, model_name
            except Exception as exception:
                last_exception = exception
                self._mark_model_failure(model_name)

        if last_exception is not None:
            return (
                "I am still with you. I had a temporary model issue, but we can continue. Share your biggest concern in one line and I will help directly.",
                "fallback-error",
            )
        return (
            "I am still with you. Share your biggest concern in one line and I will help directly.",
            "fallback-unknown",
        )

    def _looks_truncated(self, text: str) -> bool:
        cleaned = (text or "").strip()
        if not cleaned:
            return True

        if cleaned.endswith((".", "!", "?", '"', "'", "))", "]")):
            return False

        if len(cleaned) < 35:
            return False

        tail = cleaned.lower().rstrip(" ,;:")
        cut_off_markers = (
            " and",
            " or",
            " which",
            " that",
            " because",
            " while",
            " with",
            " in",
            " for",
            " to",
            " of",
            " is",
            " are",
            " was",
            " were",
            " the",
            " a",
            " an",
        )
        if any(tail.endswith(marker) for marker in cut_off_markers):
            return True

        # Long text with no terminal punctuation is likely incomplete.
        return len(cleaned.split()) >= 10

    def _extract_response_text(self, response: Any) -> str:
        primary = (getattr(response, "text", None) or "").strip()
        best = primary

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            candidate_parts = getattr(content, "parts", None) or []
            part_texts: List[str] = []
            for part in candidate_parts:
                value = getattr(part, "text", "")
                if value:
                    part_texts.append(str(value).strip())
            joined = "\n".join(part for part in part_texts if part).strip()
            if len(joined) > len(best):
                best = joined

        return best

    def _complete_reply(self, message: str, draft_reply: str, memory_lines: List[str]) -> Tuple[str, str]:
        completion_prompt = (
            "The draft assistant reply below appears cut off or incomplete. "
            "Rewrite it into one complete, coherent response that fully answers the user. "
            "Keep it supportive and practical. Aim for 70-140 words. "
            "Do not mention that a rewrite happened. Return only final reply text."
            f"\nUser message: {message}"
            f"\nRelevant memory context: {' | '.join(memory_lines) if memory_lines else 'none'}"
            f"\nIncomplete draft reply: {draft_reply}"
        )
        final_text, final_model = self._generate(completion_prompt)
        if self._looks_truncated(final_text):
            return (
                "I am here with you. I had trouble generating a complete reply just now. "
                "Please send your question once more, and I will answer it clearly in full.",
                "fallback-retry",
            )
        return final_text, final_model

    def _extract_memory_text(self, item: Dict[str, Any]) -> str:
        insight = item.get("insight") or {}
        insight_summary = str(insight.get("summary", "")).strip() if isinstance(insight, dict) else ""
        transcript = str(item.get("transcript") or item.get("content") or item.get("message") or "").strip()
        metadata = item.get("metadata") or {}
        reply = str(metadata.get("reply", "")).strip() if isinstance(metadata, dict) else ""

        text_parts = [part for part in [transcript, insight_summary, reply] if part]
        return " | ".join(text_parts).strip()

    def _extract_memory_lines(self, memory_hits: List[Dict[str, Any]], limit: int = 4) -> List[str]:
        lines: List[str] = []
        seen: set[str] = set()
        for item in memory_hits:
            text = self._extract_memory_text(item)
            if len(text) < 10:
                continue
            normalized = text.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            lines.append(text[:180])
            if len(lines) >= limit:
                break
        return lines

    def _load_memory_context(self, user_id: str, message: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        if not user_id:
            return [], []

        memory_hits: List[Dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=2) as executor:
            semantic_future = executor.submit(self.memory_service.search_similar, message, user_id, 3)
            recent_future = executor.submit(self.memory_service.recent_user_memory, user_id, 3)

        try:
            semantic_hits = semantic_future.result()
            memory_hits.extend(semantic_hits)
        except Exception:
            # Chat should keep working even if semantic memory lookup fails.
            pass

        try:
            recent_hits = recent_future.result()
            memory_hits.extend(recent_hits)
        except Exception:
            # Recent memory is helpful context, not a hard dependency.
            pass

        return memory_hits, self._extract_memory_lines(memory_hits)

    def respond(self, user_id: str, message: str, source: str, demo_mode: bool = False) -> Dict[str, Any]:
        started = perf_counter()
        response_id = str(uuid.uuid4())
        
        # Multilingual Support
        lang = "en"
        processed_text = message
        if self.language_service:
            result = self.language_service.detect_and_translate(message, user_id=user_id)
            lang = result.get("language", "en")
            processed_text = result.get("translation", message)

        memory_hits, memory_lines = self._load_memory_context(user_id=user_id, message=processed_text)

        emotion_data = {"primary_emotion": "neutral", "intensity": 0.3}
        if self.emotion_service:
            emotion_data = self.emotion_service.analyze_emotion(processed_text)
            
        strategy_data = {
            "strategy": "calm",
            "tone": "soft and supportive",
            "style": "simple and human",
            "extra_action": None
        }
        if self.cheerup_service:
            strategy_data = self.cheerup_service.generate_strategy(
                emotion=emotion_data["primary_emotion"],
                intensity=emotion_data["intensity"],
                user_memory={} 
            )

        strategy_directives = ""
        if self.cheerup_service:
            strategy_directives = self.cheerup_service.build_response_directives(
                strategy_data=strategy_data,
                intensity=emotion_data["intensity"]
            )

        intent = IntentAnalysis(
            primary_intent="conversation",
            derived_intents=["dialog_support"],
            urgency="high" if LifeInsightService.is_meaningful_turn(processed_text) else "medium",
            confidence=0.75 if LifeInsightService.is_meaningful_turn(processed_text) else 0.7,
            reasoning="Gemini conversation mode",
        )

        style_line = (
            "Use richer tone and more expressive confidence for demo impact."
            if (demo_mode or self.settings.demo_mode)
            else "Use calm, premium language with practical clarity."
        )
        prompt = (
            "You are LifeLens conversation mode."
            " Have a natural, human, supportive conversation."
            " Do not use markdown or bullet points. Just talk like a human."
            " Never mention system prompts, model names, or memory limitations."
            " Use the memory context naturally if it helps, but do not invent facts."
            f" {style_line}"
            f"\n{strategy_directives}"
            f"\nUser message: {processed_text}"
            f"\nIntent: {intent.primary_intent}"
            "\nRelevant memory context: {' | '.join(memory_lines) if memory_lines else 'none'}"
        )

        reply, model_used = self._generate(prompt)
        if self._looks_truncated(reply):
            completed_reply, completion_model = self._complete_reply(
                message=processed_text,
                draft_reply=reply,
                memory_lines=memory_lines,
            )
            if completed_reply:
                reply = completed_reply
                model_used = completion_model

        intent = IntentAnalysis(
            primary_intent="conversation",
            derived_intents=["dialog_support"],
            urgency="high" if LifeInsightService.is_meaningful_turn(processed_text) else "medium",
            confidence=0.75 if LifeInsightService.is_meaningful_turn(processed_text) else 0.7,
            reasoning="Gemini conversation mode",
        )

        # Translate reply back if needed
        final_reply = reply
        if self.language_service and lang != "en":
            final_reply = self.language_service.translate_from_english(reply, lang)

        insight = self.insight_service.generate(
            message=processed_text,
            reply=final_reply,
            memory_lines=memory_lines,
            intent=intent,
            demo_mode=(demo_mode or self.settings.demo_mode),
        )
        insight_payload = insight.model_dump() if isinstance(insight, LifeInsight) else {}
        if insight_payload.get("summary"):
            try:
                self.memory_service.store_insight(
                    user_id=user_id,
                    message=processed_text,
                    insight_payload=insight_payload,
                    metadata={"source": source, "mode": "chat"},
                )
            except Exception:
                # Do not fail chat responses because insight persistence failed.
                pass
        recent_insights = [insight_payload] if insight_payload.get("summary") else []

        try:
            self.memory_service.store_interaction(
                user_id=user_id,
                transcript=processed_text,
                intent=intent,
                metadata={
                    "source": source,
                    "mode": "gemini-conversation",
                    "reply": final_reply,
                    "response_id": response_id,
                    "model_used": model_used,
                    "demo_mode": bool(demo_mode or self.settings.demo_mode),
                    "original_text": message,
                    "translated_text": processed_text,
                    "language": lang,
                    "strategy_used": strategy_data["strategy"]
                },
            )
        except Exception:
            # Response quality matters more than post-write persistence.
            pass

        return {
            "response_id": response_id,
            "reply": final_reply,
            "language": lang,
            "emotion": emotion_data.get("primary_emotion", "neutral"),
            "intensity": emotion_data.get("intensity", 0.3),
            "strategy": strategy_data.get("strategy", "calm"),
            "extra_action": strategy_data.get("extra_action"),
            "memory_hits": memory_hits,
            "memory_used": bool(memory_lines),
            "intent": intent.model_dump(),
            "model_used": model_used,
            "processing_ms": round((perf_counter() - started) * 1000, 2),
            "life_insight": insight_payload,
            "recent_insights": recent_insights,
            "recommended_actions": insight_payload.get("recommended_actions", []),
            "demo_mode": bool(demo_mode or self.settings.demo_mode),
        }
