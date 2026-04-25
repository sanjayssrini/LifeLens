from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, Dict, List

import google.generativeai as genai

from app.services.memory_service import MemoryService
from app.services.settings import Settings


class WellbeingToolsService:
    def __init__(self, settings: Settings, memory_service: MemoryService) -> None:
        self.settings = settings
        self.memory_service = memory_service
        self.enabled = bool(settings.gemini_api_key)
        self.model_names = [
            settings.gemini_model,
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash",
            "gemini-flash-latest",
        ]
        self._models: Dict[str, genai.GenerativeModel] = {}
        self._preferred_model = ""

        self._cache_lock = asyncio.Lock()
        self._cheer_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
        self._question_cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
        self._cache_ttl_sec = 45.0

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

    def _generate_text(self, prompt: str, temperature: float = 0.45, max_tokens: int = 700) -> tuple[str, str]:
        if not self.enabled:
            return "", "offline"

        for model_name in self._candidate_models():
            try:
                model = self._models.get(model_name)
                if model is None:
                    model = genai.GenerativeModel(model_name=model_name)
                    self._models[model_name] = model

                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": temperature,
                        "max_output_tokens": max_tokens,
                    },
                )
                text = self._extract_response_text(response)
                if text:
                    self._preferred_model = model_name
                    return text, model_name
            except Exception:
                continue

        return "", "fallback"

    @staticmethod
    def _extract_text(memory_item: Dict[str, Any]) -> str:
        return str(
            memory_item.get("summary")
            or memory_item.get("transcript")
            or memory_item.get("content")
            or memory_item.get("message")
            or ""
        ).strip()

    @staticmethod
    def _extract_emotional_tags(memory_item: Dict[str, Any]) -> List[str]:
        tags: List[str] = []
        metadata = memory_item.get("metadata") or {}
        for key in ["emotion", "emotion_tag", "emotion_state", "tone"]:
            value = metadata.get(key) if isinstance(metadata, dict) else None
            if isinstance(value, str) and value.strip():
                tags.append(value.strip().lower())
        maybe_tags = metadata.get("tags") if isinstance(metadata, dict) else None
        if isinstance(maybe_tags, list):
            for value in maybe_tags:
                if isinstance(value, str) and value.strip():
                    tags.append(value.strip().lower())
        intent = memory_item.get("intent") or {}
        if isinstance(intent, dict):
            primary = str(intent.get("primary_intent") or "").strip().lower()
            if primary and primary not in {"general_support", "general", "conversation"}:
                tags.append(primary)
        return list(dict.fromkeys(tags))

    def _collect_relevant_memory(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        if not user_id:
            return []

        records: List[Dict[str, Any]] = []
        try:
            records.extend(self.memory_service.recent_user_memory(user_id, limit=limit))
        except Exception:
            pass

        try:
            records.extend(self.memory_service.search_similar("emotions stress clarity mood support", user_id, 4))
        except Exception:
            pass

        deduped: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for item in records:
            if not isinstance(item, dict):
                continue
            if item.get("entry_type") == "feedback":
                continue
            text = self._extract_text(item)
            if len(text) < 6:
                continue
            fingerprint = f"{item.get('timestamp','')}::{text.lower()[:140]}"
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            deduped.append(item)

        deduped.sort(key=lambda item: str(item.get("timestamp") or ""), reverse=True)
        return deduped[: max(5, min(limit, 10))]

    def _memory_status(self, memory_entries: List[Dict[str, Any]]) -> str:
        if not memory_entries:
            return "none"

        emotional_tag_count = 0
        for item in memory_entries:
            emotional_tag_count += len(self._extract_emotional_tags(item))

        if len(memory_entries) >= 5 or emotional_tag_count >= 4:
            return "strong"
        return "weak"

    @staticmethod
    def _extract_json_object(raw_text: str) -> Dict[str, Any]:
        text = (raw_text or "").strip()
        if not text:
            return {}

        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            pass

        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return {}

        snippet = match.group(0)
        try:
            parsed = json.loads(snippet)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    def _cheer_analysis_prompt(self, memory_entries: List[Dict[str, Any]]) -> str:
        context_lines = []
        for item in memory_entries:
            text = self._extract_text(item)
            tags = self._extract_emotional_tags(item)
            context_lines.append(
                f"- text: {text[:180]} | tags: {', '.join(tags) if tags else 'none'}"
            )

        context = "\n".join(context_lines) if context_lines else "- no memory context"
        return (
            "Analyze the user's current emotional signal based on memory context. "
            "Return JSON only with this exact schema:\n"
            "{\"emotion\":\"...\",\"intensity\":0.0,\"signals\":[\"...\"],\"confidence\":0.0}\n"
            "Rules: intensity and confidence must be between 0 and 1. signals must be 2-4 short bullet-like strings.\n"
            f"Memory context:\n{context}"
        )

    def _cheer_response_prompt(self, analysis: Dict[str, Any], memory_entries: List[Dict[str, Any]]) -> str:
        context_lines = []
        for item in memory_entries[:6]:
            text = self._extract_text(item)
            context_lines.append(f"- {text[:160]}")
        context = "\n".join(context_lines) if context_lines else "- no specific memory"

        return (
            "Create warm emotional support with practical clarity. Return JSON only with this exact schema:\n"
            "{\"message\":\"...\",\"support_action\":\"...\",\"tone\":\"...\",\"personal_reference\":\"...\"}\n"
            "Constraints: message should be 2-3 sentences and feel calm and premium. "
            "support_action must be one short actionable step. tone should be a single descriptive phrase. "
            "personal_reference should reflect memory context naturally and safely.\n"
            f"Analysis JSON:\n{json.dumps(analysis, ensure_ascii=True)}\n"
            f"Memory context:\n{context}"
        )

    async def get_cheer_up(self, user_id: str, force_refresh: bool = False) -> Dict[str, Any]:
        cache_key = user_id or "anonymous"
        now = time.monotonic()
        async with self._cache_lock:
            cached = self._cheer_cache.get(cache_key)
            if cached and not force_refresh and (now - cached[0]) <= self._cache_ttl_sec:
                payload = dict(cached[1])
                payload["cached"] = True
                return payload

        memory_entries = self._collect_relevant_memory(user_id=user_id, limit=10)
        memory_status = self._memory_status(memory_entries)

        if memory_status == "none" or not self.enabled:
            analysis = {
                "emotion": "undetermined",
                "intensity": 0.2,
                "signals": ["Limited context available", "Awaiting user input"],
                "confidence": 0.18,
            }
            support = {
                "message": "You can talk about anything here. We can take it one step at a time.",
                "support_action": "Take one slow breath and share one sentence about what feels heaviest right now.",
                "tone": "welcoming and steady",
                "personal_reference": "No prior memory yet.",
            }
            payload = {
                "status": "ok",
                "memory_status": memory_status,
                "analysis": analysis,
                "support": support,
                "memory_count": 0,
                "cached": False,
            }
            async with self._cache_lock:
                self._cheer_cache[cache_key] = (now, payload)
            return payload

        analysis_prompt = self._cheer_analysis_prompt(memory_entries)
        analysis_text, model_used = await asyncio.to_thread(self._generate_text, analysis_prompt, 0.3, 420)
        analysis = self._extract_json_object(analysis_text)
        if not analysis:
            analysis = {
                "emotion": "mixed",
                "intensity": 0.55,
                "signals": ["Recent emotional language", "Repetitive stress cues"],
                "confidence": 0.45,
            }

        support_prompt = self._cheer_response_prompt(analysis, memory_entries)
        support_text, model_support = await asyncio.to_thread(self._generate_text, support_prompt, 0.55, 520)
        support = self._extract_json_object(support_text)
        if not support:
            support = {
                "message": "You have carried a lot lately, and your effort still counts. We can slow this down and focus on one manageable step.",
                "support_action": "Write one tiny next action for the next ten minutes.",
                "tone": "calm and affirming",
                "personal_reference": "Your recent reflections suggest you are trying to stay steady through pressure.",
            }

        payload = {
            "status": "ok",
            "memory_status": memory_status,
            "analysis": {
                "emotion": str(analysis.get("emotion") or "mixed"),
                "intensity": float(analysis.get("intensity") or 0.5),
                "signals": list(analysis.get("signals") or []),
                "confidence": float(analysis.get("confidence") or 0.4),
            },
            "support": {
                "message": str(support.get("message") or "I am with you. We can move one step at a time."),
                "support_action": str(support.get("support_action") or "Take one slow breath and name your next small step."),
                "tone": str(support.get("tone") or "steady"),
                "personal_reference": str(support.get("personal_reference") or ""),
            },
            "memory_count": len(memory_entries),
            "model_used": model_support or model_used,
            "cached": False,
        }

        async with self._cache_lock:
            self._cheer_cache[cache_key] = (time.monotonic(), payload)
        return payload

    async def get_emotional_score_questions(self, user_id: str, force_refresh: bool = False) -> Dict[str, Any]:
        cache_key = user_id or "anonymous"
        now = time.monotonic()
        async with self._cache_lock:
            cached = self._question_cache.get(cache_key)
            if cached and not force_refresh and (now - cached[0]) <= self._cache_ttl_sec:
                payload = dict(cached[1])
                payload["cached"] = True
                return payload

        memory_entries = self._collect_relevant_memory(user_id=user_id, limit=8)
        context_lines = [self._extract_text(item)[:140] for item in memory_entries[:4]]
        context = " | ".join([line for line in context_lines if line])

        if not self.enabled:
            questions = [
                "What emotion has been most present for you in the last 24 hours?",
                "What has drained your energy the most this week?",
                "What is one thing that would make today feel 10% lighter?",
            ]
        else:
            prompt = (
                "Create exactly 3 concise adaptive self-reflection questions. "
                "Return JSON only in this shape: {\"questions\":[\"...\",\"...\",\"...\"]}. "
                "Questions should help estimate stress, clarity, and emotional stability. "
                "No labels, no markdown."
            )
            if context:
                prompt += f"\nContext from recent memory: {context}"

            raw_text, _ = await asyncio.to_thread(self._generate_text, prompt, 0.5, 280)
            parsed = self._extract_json_object(raw_text)
            questions = parsed.get("questions") if isinstance(parsed, dict) else None
            if not isinstance(questions, list) or len(questions) < 2:
                questions = [
                    "What feeling has dominated your day so far?",
                    "Where do you feel the most pressure right now?",
                    "What feels clear and what still feels uncertain?",
                ]

        cleaned_questions = [str(question).strip() for question in questions if str(question).strip()]
        cleaned_questions = cleaned_questions[:3] or [
            "What feeling has dominated your day so far?",
            "Where do you feel the most pressure right now?",
        ]

        payload = {
            "status": "ok",
            "questions": cleaned_questions,
            "cached": False,
        }
        async with self._cache_lock:
            self._question_cache[cache_key] = (time.monotonic(), payload)
        return payload

    async def evaluate_emotional_score(self, user_id: str, responses: List[Dict[str, str]]) -> Dict[str, Any]:
        normalized_responses = []
        for item in responses:
            if not isinstance(item, dict):
                continue
            question = str(item.get("question") or "").strip()
            answer = str(item.get("answer") or "").strip()
            if question and answer:
                normalized_responses.append({"question": question, "answer": answer})

        if not normalized_responses:
            return {
                "status": "error",
                "detail": "No responses provided.",
            }

        if not self.enabled:
            result = {
                "score": 52,
                "state": "transitional",
                "dimensions": {
                    "stress": 0.56,
                    "clarity": 0.42,
                    "stability": 0.5,
                },
                "trend": "steady",
                "insight": "You are carrying some pressure but still staying engaged. A short grounding routine can improve clarity.",
                "confidence": 0.42,
            }
        else:
            prompt = (
                "Evaluate emotional self-reflection responses and output JSON only with this exact schema:\n"
                "{\"score\":0,\"state\":\"...\",\"dimensions\":{\"stress\":0.0,\"clarity\":0.0,\"stability\":0.0},\"trend\":\"...\",\"insight\":\"...\",\"confidence\":0.0}\n"
                "Rules: score is integer 0-100. stress/clarity/stability and confidence are floats between 0 and 1. "
                "insight is 1-2 sentences, supportive and concrete. trend is one short phrase."
                f"\nResponses:\n{json.dumps(normalized_responses, ensure_ascii=True)}"
            )

            raw_text, _ = await asyncio.to_thread(self._generate_text, prompt, 0.35, 420)
            parsed = self._extract_json_object(raw_text)
            if not parsed:
                parsed = {
                    "score": 58,
                    "state": "reflective",
                    "dimensions": {
                        "stress": 0.48,
                        "clarity": 0.55,
                        "stability": 0.57,
                    },
                    "trend": "gradually improving",
                    "insight": "Your answers show awareness and momentum. Keeping one simple structure in your day can improve stability further.",
                    "confidence": 0.46,
                }
            result = parsed

        dimensions = result.get("dimensions") if isinstance(result.get("dimensions"), dict) else {}
        score_payload = {
            "score": int(max(0, min(100, int(float(result.get("score") or 0))))),
            "state": str(result.get("state") or "reflective"),
            "dimensions": {
                "stress": float(max(0.0, min(1.0, float(dimensions.get("stress") or 0.5)))),
                "clarity": float(max(0.0, min(1.0, float(dimensions.get("clarity") or 0.5)))),
                "stability": float(max(0.0, min(1.0, float(dimensions.get("stability") or 0.5)))),
            },
            "trend": str(result.get("trend") or "steady"),
            "insight": str(result.get("insight") or "You are showing effort and self-awareness. Keep taking one small stabilizing step at a time."),
            "confidence": float(max(0.0, min(1.0, float(result.get("confidence") or 0.45)))),
        }

        if user_id:
            try:
                self.memory_service.store_memory_entry(
                    user_id=user_id,
                    content=(
                        "Emotional score reflection: "
                        f"score={score_payload['score']}, state={score_payload['state']}, trend={score_payload['trend']}, "
                        f"insight={score_payload['insight']}"
                    ),
                    intent="emotional_score",
                    metadata={
                        "entry_type": "emotional_score",
                        "dimensions": score_payload["dimensions"],
                        "confidence": score_payload["confidence"],
                        "responses": normalized_responses,
                    },
                )
            except Exception:
                pass

        return {
            "status": "ok",
            **score_payload,
        }