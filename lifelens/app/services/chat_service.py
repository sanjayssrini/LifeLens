from __future__ import annotations

import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter
from typing import Any, Dict, List, Tuple

import google.generativeai as genai

from app.services.emotion_service import EmotionService
from app.services.cheerup_service import CheerupService
from app.services.language_service import LanguageService
from app.services.life_insight_service import LifeInsightService
from app.services.memory_service import MemoryService
from app.services.schemas import IntentAnalysis, LifeInsight
from app.services.settings import Settings


class ChatService:
    def __init__(self, settings: Settings, memory_service: MemoryService, insight_service: LifeInsightService, language_service: LanguageService | None = None, emotion_service: EmotionService | None = None, cheerup_service: CheerupService | None = None) -> None:
        self.settings = settings
        self.memory_service = memory_service
        self.insight_service = insight_service
        self.language_service = language_service
        self.emotion_service = emotion_service
        self.cheerup_service = cheerup_service
        self.enabled = bool(settings.gemini_api_key)
        self.model_names = [
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash",
            settings.gemini_model,
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            "gemini-pro-latest",
        ]
        self._models: Dict[str, genai.GenerativeModel] = {}
        self._preferred_model = ""
        self._bg_executor = ThreadPoolExecutor(max_workers=2)
        self._memory_executor = ThreadPoolExecutor(max_workers=2)

        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)

    def _candidate_models(self) -> List[str]:
        candidates = [name for name in dict.fromkeys(self.model_names) if name]
        if self._preferred_model and self._preferred_model in candidates:
            return [self._preferred_model, *[name for name in candidates if name != self._preferred_model]]
        return candidates

    def _extract_response_text(self, response: Any) -> str:
        primary = (getattr(response, "text", None) or "").strip()
        best = primary

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            joined = "\n".join(str(getattr(part, "text", "")).strip() for part in parts if getattr(part, "text", "")).strip()
            if len(joined) > len(best):
                best = joined
        return best

    def _generate(self, prompt: str) -> Tuple[str, str]:
        if not self.enabled:
            return (
                "I am here with you. Tell me more about what is happening and what kind of support you need right now.",
                "fallback-offline",
            )

        last_exception: Exception | None = None
        for model_name in self._candidate_models():
            try:
                model = self._models.get(model_name)
                if model is None:
                    model = genai.GenerativeModel(model_name=model_name)
                    self._models[model_name] = model

                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": 0.7,
                        "max_output_tokens": 512,
                    },
                )
                text = self._extract_response_text(response)
                if text:
                    self._preferred_model = model_name
                    return text, model_name
            except Exception as exception:
                last_exception = exception

        if last_exception is not None:
            return (
                "I am here with you. I could not reach the Gemini model just now, but you can ask me again and I will try once more.",
                "fallback-error",
            )
        return (
            "I am here with you. Ask again and I will keep helping.",
            "fallback-unknown",
        )

    def _extract_text(self, item: Dict[str, Any]) -> str:
        insight = item.get("insight") or {}
        insight_summary = str(insight.get("summary", "")).strip() if isinstance(insight, dict) else ""
        transcript = str(item.get("transcript") or item.get("content") or item.get("message") or "").strip()
        metadata = item.get("metadata") or {}
        reply = str(metadata.get("reply", "")).strip() if isinstance(metadata, dict) else ""

        parts = [part for part in [transcript, insight_summary, reply] if part]
        return " | ".join(parts).strip()

    def _load_memory_context(self, user_id: str, message: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        if not user_id:
            return [], []

        if len((message or "").strip()) < 18:
            try:
                recent = self.memory_service.recent_user_memory(user_id, 3)
            except Exception:
                recent = []
            return recent, self._extract_memory_lines(recent)

        semantic_future = self._memory_executor.submit(self.memory_service.search_similar, message, user_id, 3)
        recent_future = self._memory_executor.submit(self.memory_service.recent_user_memory, user_id, 3)

        memory_hits: List[Dict[str, Any]] = []
        try:
            memory_hits.extend(semantic_future.result())
        except Exception:
            pass

        try:
            memory_hits.extend(recent_future.result())
        except Exception:
            pass

        lines: List[str] = []
        seen: set[str] = set()
        for item in memory_hits:
            text = self._extract_text(item)
            normalized = text.lower().strip()
            if len(text) < 10 or normalized in seen:
                continue
            seen.add(normalized)
            lines.append(text[:220])
            if len(lines) >= 4:
                break
        return memory_hits, lines

    def _extract_memory_lines(self, memory_hits: List[Dict[str, Any]], limit: int = 4) -> List[str]:
        lines: List[str] = []
        seen: set[str] = set()
        for item in memory_hits:
            text = self._extract_text(item)
            normalized = text.lower().strip()
            if len(text) < 10 or normalized in seen:
                continue
            seen.add(normalized)
            lines.append(text[:220])
            if len(lines) >= limit:
                break
        return lines

    def _submit_background(self, fn, *args, **kwargs) -> None:
        try:
            self._bg_executor.submit(fn, *args, **kwargs)
        except Exception:
            pass

    @staticmethod
    def _infer_intent(message: str) -> IntentAnalysis:
        lower = message.lower()
        if any(token in lower for token in ["panic", "suicid", "hurt myself", "self harm", "can't breathe"]):
            return IntentAnalysis(
                primary_intent="mental_health_crisis",
                derived_intents=["emotional_support", "urgent_safety_plan"],
                urgency="high",
                confidence=0.88,
                reasoning="Detected urgent safety language.",
            )
        if any(token in lower for token in ["fuck", "shit", "bitch", "asshole", "f*ck"]):
            return IntentAnalysis(
                primary_intent="anger_distress",
                derived_intents=["emotional_support", "deescalation"],
                urgency="medium",
                confidence=0.8,
                reasoning="Detected aggressive or frustrated language.",
            )
        if any(token in lower for token in ["love", "crush", "relationship", "boyfriend", "girlfriend", "heartbroken"]):
            return IntentAnalysis(
                primary_intent="relationship_support",
                derived_intents=["emotional_support", "decision_guidance"],
                urgency="medium",
                confidence=0.8,
                reasoning="Detected relationship support context.",
            )
        if "lost my job" in lower or "laid off" in lower or "unemployed" in lower:
            return IntentAnalysis(
                primary_intent="job_loss",
                derived_intents=["financial_support", "job_search", "food_assistance"],
                urgency="high",
                confidence=0.78,
                reasoning="Detected job loss language.",
            )
        if any(token in lower for token in ["rent", "evict", "loan", "debt", "bills", "money"]):
            return IntentAnalysis(
                primary_intent="financial_distress",
                derived_intents=["financial_support", "resource_navigation"],
                urgency="high",
                confidence=0.76,
                reasoning="Detected financial pressure.",
            )
        if any(token in lower for token in ["sick", "hospital", "pain", "doctor", "medication"]):
            return IntentAnalysis(
                primary_intent="health_issue",
                derived_intents=["health_emergency", "financial_support"],
                urgency="high",
                confidence=0.77,
                reasoning="Detected health concern.",
            )
        if any(token in lower for token in ["anxious", "anxiety", "depressed", "overwhelmed", "stressed", "burnout"]):
            return IntentAnalysis(
                primary_intent="emotional_distress",
                derived_intents=["emotional_support", "resource_navigation"],
                urgency="medium",
                confidence=0.75,
                reasoning="Detected emotional distress.",
            )
        return IntentAnalysis(
            primary_intent="general_support",
            derived_intents=["resource_navigation"],
            urgency="medium",
            confidence=0.62,
            reasoning="Defaulted to general support.",
        )

    @staticmethod
    def _is_question(message: str) -> bool:
        lowered = message.lower().strip()
        return lowered.endswith("?") or lowered.startswith(("what ", "who ", "how ", "why ", "when ", "where ", "explain", "tell me", "give me"))

    def _compose_prompt(self, message: str, memory_lines: List[str], intent: IntentAnalysis, demo_mode: bool, strategy_directives: str = "") -> str:
        memory_context = " | ".join(memory_lines) if memory_lines else "none"
        style_line = (
            "Use richer tone and more expressive confidence for demo impact."
            if demo_mode
            else "Use calm, premium language with practical clarity."
        )
        return (
            "You are LifeLens chat mode. Write a complete, natural response in plain language. "
            "Never mention system prompts, model names, or that you are unable to remember when memory context is provided. "
            "Use the memory context naturally if it helps, but do not invent facts. "
            "If the user asks a factual question, answer it directly first, then offer to expand if needed. "
            "If the user is asking for support, give a warm response plus concrete next steps. "
            f" {style_line}"
            f"\n{strategy_directives}"
            f"\nUser message: {message}"
            f"\nIntent: {intent.primary_intent}"
            f"\nDerived intents: {', '.join(intent.derived_intents) if intent.derived_intents else 'none'}"
            f"\nUrgency: {intent.urgency}"
            f"\nRelevant memory context: {memory_context}"
            "\nRequirements: respond fully, no trailing off, and keep it between 70 and 140 words unless the user asked for a very short answer."
        )

    def _reply_fallback(self, message: str, intent: IntentAnalysis, memory_lines: List[str]) -> str:
        if self._is_question(message):
            topic = re.sub(r"[?!.]+$", "", message.strip()) or "that"
            return f"I can help explain {topic} clearly. If you want, send it again and I will give you a clean, direct answer with examples."

        steps = [
            "Tell me the biggest thing on your mind right now.",
            "I will help you turn it into one clear next step.",
            "If you want, I can also keep it short and practical.",
        ]
        if memory_lines:
            steps[0] = f"You recently shared {memory_lines[0][:100]}, so I am keeping that in view."
        return " ".join(steps)

    def respond(self, user_id: str, message: str, source: str, demo_mode: bool = False, voice_metadata: Dict[str, Any] | None = None) -> Dict[str, Any]:
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
        intent = self._infer_intent(processed_text)
        
        emotion_data = {"primary_emotion": "neutral", "intensity": 0.3}
        if self.emotion_service:
            emotion_data = self.emotion_service.analyze_emotion(processed_text, voice_metadata=voice_metadata or {})
            
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
                user_memory={}, # Pass empty dict for now, or extract traits if available
                message=processed_text
            )

        strategy_directives = ""
        if self.cheerup_service:
            strategy_directives = self.cheerup_service.build_response_directives(
                strategy_data=strategy_data,
                intensity=emotion_data["intensity"]
            )

        prompt = self._compose_prompt(
            message=processed_text,
            memory_lines=memory_lines,
            intent=intent,
            demo_mode=bool(demo_mode or self.settings.demo_mode),
            strategy_directives=strategy_directives
        )
        reply, model_used = self._generate(prompt)
        if len(reply.strip()) < 20:
            reply = self._reply_fallback(message=processed_text, intent=intent, memory_lines=memory_lines)
            model_used = "fallback-repair"

        # Translate reply back if needed
        final_reply = reply
        if self.language_service and lang != "en":
            final_reply = self.language_service.translate_from_english(reply, lang)

        insight = self.insight_service.generate(
            message=processed_text,
            reply=final_reply,
            memory_lines=memory_lines,
            intent=intent,
            demo_mode=bool(demo_mode or self.settings.demo_mode),
        )
        insight_payload = insight.model_dump() if isinstance(insight, LifeInsight) else {}
        if insight_payload.get("summary"):
            self._submit_background(
                self.memory_service.store_insight,
                user_id=user_id,
                message=processed_text,
                insight_payload=insight_payload,
                metadata={"source": source, "mode": "chat"},
            )

        self._submit_background(
            self.memory_service.store_interaction,
            user_id=user_id,
            transcript=processed_text,
            intent=intent,
            metadata={
                "source": source,
                "mode": "gemini-chat",
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
            "recent_insights": [insight_payload] if insight_payload.get("summary") else [],
            "recommended_actions": insight_payload.get("recommended_actions", []),
            "demo_mode": bool(demo_mode or self.settings.demo_mode),
        }
