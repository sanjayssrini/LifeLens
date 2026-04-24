from __future__ import annotations

import json
from typing import Any, Dict, List

import google.generativeai as genai

from app.services.schemas import IntentAnalysis, LifeInsight
from app.services.settings import Settings


class LifeInsightService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.enabled = bool(settings.gemini_api_key)
        self.model_names = [
            settings.insight_model,
            settings.gemini_model,
            "gemini-2.0-flash",
            "gemini-1.5-flash",
        ]
        self._models: Dict[str, genai.GenerativeModel] = {}
        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)

    def _extract_json(self, text: str) -> dict:
        cleaned = (text or "").strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]
        return json.loads(cleaned)

    def _generate(self, prompt: str) -> str:
        if not self.enabled:
            raise RuntimeError("Insight model unavailable")

        last_exception: Exception | None = None
        for model_name in self.model_names:
            try:
                model = self._models.get(model_name)
                if model is None:
                    model = genai.GenerativeModel(model_name=model_name)
                    self._models[model_name] = model
                response = model.generate_content(prompt)
                text = (response.text or "").strip()
                if text:
                    return text
            except Exception as exception:
                last_exception = exception

        if last_exception is not None:
            raise last_exception
        raise RuntimeError("Insight generation failed")

    @staticmethod
    def is_meaningful_turn(message: str, intent: IntentAnalysis | None = None) -> bool:
        text = (message or "").strip()
        if len(text) >= 45:
            return True
        if intent is None:
            return False
        if intent.urgency in {"medium", "high"}:
            return True
        high_signal_labels = {
            "job_loss",
            "financial_distress",
            "health_issue",
            "mental_health_crisis",
            "emotional_distress",
            "relationship_support",
            "anger_distress",
        }
        labels = {intent.primary_intent, *intent.derived_intents}
        return bool(labels & high_signal_labels)

    def _fallback(
        self,
        message: str,
        memory_lines: List[str],
        intent: IntentAnalysis | None,
    ) -> LifeInsight:
        lowered = (message or "").lower()
        insights: List[str] = []
        actions: List[str] = []

        if any(token in lowered for token in ["job", "laid off", "unemployed"]):
            insights.append("You seem to be dealing with job uncertainty or recent work stress.")
            actions.append("Identify 3 nearby or remote roles and apply today.")
        if any(token in lowered for token in ["rent", "money", "debt", "bills", "financial"]):
            insights.append("Money pressure appears to be a current source of stress.")
            actions.append("Check local financial aid and emergency assistance programs.")
        if any(token in lowered for token in ["hospital", "pain", "sick", "health"]):
            insights.append("Health concerns may be affecting your sense of stability.")
            actions.append("Prioritize medical support and ask about low-cost care options.")

        if not insights and memory_lines:
            insights.append("You are navigating multiple ongoing challenges and trying to stay proactive.")
            actions.append("Pick one concrete action for the next 24 hours and execute it.")

        if not insights:
            insights.append("You are asking for practical support and clear next steps.")
            actions.append("Choose one immediate action and one follow-up for tomorrow.")

        summary = insights[0]
        if len(insights) > 1:
            summary = f"{insights[0]} {insights[1]}"

        return LifeInsight(
            summary=summary,
            insights=insights[:3],
            recommended_actions=actions[:3],
            confidence=0.68,
            importance=(intent.urgency if intent else "medium") if (intent and intent.urgency in {"low", "medium", "high"}) else "medium",
        )

    def generate(
        self,
        message: str,
        reply: str,
        memory_lines: List[str],
        intent: IntentAnalysis | None = None,
        demo_mode: bool = False,
    ) -> LifeInsight:
        if not self.is_meaningful_turn(message, intent):
            return LifeInsight()

        # Fast mode by default: avoid a second model round trip on every user turn.
        # Full LLM insight generation is reserved for Demo Mode where visual drama matters.
        if (not self.enabled) or (not demo_mode):
            return self._fallback(message=message, memory_lines=memory_lines, intent=intent)

        style = (
            "Use expressive yet grounded language with stronger clarity and confidence. "
            if demo_mode
            else "Use calm, premium, emotionally intelligent language. "
        )
        prompt = (
            "You are a life-pattern analyst for a wellbeing assistant named LifeLens. "
            "Infer likely user situation from the current user message, assistant reply, and memory context. "
            "Output only JSON with keys: summary, insights, recommended_actions, confidence, importance. "
            "Rules: insights and recommended_actions must each be arrays with 1-3 concise items. "
            "summary must be one sentence in second person perspective. "
            "Never use clinical diagnosis language. "
            + style
            + f"\nUser message: {message}"
            + f"\nAssistant reply: {reply}"
            + f"\nMemory context: {' | '.join(memory_lines) if memory_lines else 'none'}"
        )

        try:
            raw = self._generate(prompt)
            parsed = self._extract_json(raw)
            summary = str(parsed.get("summary", "")).strip()
            insights = [str(item).strip() for item in parsed.get("insights", []) if str(item).strip()][:3]
            actions = [str(item).strip() for item in parsed.get("recommended_actions", []) if str(item).strip()][:3]
            confidence = float(parsed.get("confidence", 0.72))
            confidence = max(0.0, min(1.0, confidence))
            importance = str(parsed.get("importance", "medium")).lower()
            if importance not in {"low", "medium", "high"}:
                importance = "medium"

            if not summary and insights:
                summary = insights[0]
            if not insights:
                insights = [summary] if summary else []
            if not actions:
                actions = ["Pick one practical next step and complete it today."]

            return LifeInsight(
                summary=summary,
                insights=insights,
                recommended_actions=actions,
                confidence=confidence,
                importance=importance,
            )
        except Exception:
            return self._fallback(message=message, memory_lines=memory_lines, intent=intent)

    def payload(self, insight: LifeInsight) -> Dict[str, Any]:
        return insight.model_dump()
