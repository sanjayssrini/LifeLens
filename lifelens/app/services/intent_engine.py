import json
from typing import List

import google.generativeai as genai

from app.services.prompts import INTENT_CASCADE_SYSTEM_PROMPT
from app.services.schemas import ActionResult
from app.services.schemas import IntentAnalysis
from app.services.settings import Settings


class IntentCascadeEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.enabled = bool(settings.gemini_api_key)
        self.fast_mode = bool(getattr(settings, "fast_mode", True))
        self.model_names = [
            settings.gemini_model,
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
        ]
        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(model_name=self.model_names[0])
        else:
            self.model = None

    def _generate_with_model_fallback(self, prompt: str) -> str:
        if self.model is None:
            raise RuntimeError("No configured model")

        last_exception: Exception | None = None
        for model_name in self.model_names:
            try:
                model = genai.GenerativeModel(model_name=model_name)
                response = model.generate_content(prompt)
                text = (response.text or "").strip()
                if text:
                    return text
            except Exception as exception:
                last_exception = exception

        if last_exception is not None:
            raise last_exception
        raise RuntimeError("Model generation failed")

    def _fallback_intents(self, text: str) -> IntentAnalysis:
        lower = text.lower()
        if any(token in lower for token in ["fuck", "shit", "bitch", "asshole", "f*ck"]):
            return IntentAnalysis(
                primary_intent="anger_distress",
                derived_intents=["emotional_support", "deescalation"],
                urgency="medium",
                confidence=0.81,
                reasoning="Detected aggressive language likely indicating frustration or distress.",
            )
        if any(token in lower for token in ["love", "crush", "relationship", "boyfriend", "girlfriend", "heartbroken"]):
            return IntentAnalysis(
                primary_intent="relationship_support",
                derived_intents=["emotional_support", "decision_guidance"],
                urgency="medium",
                confidence=0.8,
                reasoning="Detected relationship or romantic support context.",
            )
        if any(token in lower for token in ["panic", "suicid", "can't breathe", "self harm", "hurt myself"]):
            return IntentAnalysis(
                primary_intent="mental_health_crisis",
                derived_intents=["emotional_support", "urgent_safety_plan"],
                urgency="high",
                confidence=0.85,
                reasoning="Detected severe distress or safety-risk language.",
            )
        if "lost my job" in lower or "laid off" in lower or "unemployed" in lower:
            return IntentAnalysis(
                primary_intent="job_loss",
                derived_intents=["financial_support", "job_search", "food_assistance"],
                urgency="high",
                confidence=0.77,
                reasoning="Detected layoff language and immediate hardship indicators.",
            )
        if any(token in lower for token in ["rent", "evict", "loan", "debt", "bills"]):
            return IntentAnalysis(
                primary_intent="financial_distress",
                derived_intents=["financial_support", "resource_navigation"],
                urgency="high",
                confidence=0.78,
                reasoning="Detected immediate financial pressure indicators.",
            )
        if "sick" in lower or "hospital" in lower or "pain" in lower:
            return IntentAnalysis(
                primary_intent="health_issue",
                derived_intents=["health_emergency", "financial_support"],
                urgency="high",
                confidence=0.79,
                reasoning="Detected healthcare concern with likely downstream cost pressure.",
            )
        if any(token in lower for token in ["anxious", "anxiety", "depressed", "overwhelmed", "stressed", "burnout"]):
            return IntentAnalysis(
                primary_intent="emotional_distress",
                derived_intents=["emotional_support", "resource_navigation"],
                urgency="medium",
                confidence=0.74,
                reasoning="Detected emotional distress language and support need.",
            )
        return IntentAnalysis(
            primary_intent="general_support",
            derived_intents=["resource_navigation"],
            urgency="medium",
            confidence=0.62,
            reasoning="No hard trigger found, defaulting to support intent.",
        )

    @staticmethod
    def _is_memory_recall_query(user_text: str) -> bool:
        lowered = user_text.lower()
        recall_markers = [
            "remember",
            "earlier",
            "before",
            "last time",
            "previous",
            "what were we speaking",
            "what we were speaking",
            "what did we talk",
        ]
        return any(marker in lowered for marker in recall_markers)

    def _filtered_memory_hit(self, user_text: str, memory_hits: List[str]) -> str:
        recall_query = self._is_memory_recall_query(user_text)
        user_tokens = {token for token in user_text.lower().split() if len(token) > 2}
        for item in memory_hits:
            cleaned = (item or "").strip()
            if len(cleaned) < 20:
                continue
            if cleaned.lower() in {"what should i do now?", "help", "i need help"}:
                continue
            if recall_query:
                return cleaned
            candidate_tokens = {token for token in cleaned.lower().split() if len(token) > 2}
            overlap = len(user_tokens & candidate_tokens)
            if user_tokens and overlap == 0:
                continue
            return cleaned
        return ""

    def _priority_steps(self, intent: IntentAnalysis) -> List[str]:
        labels = {intent.primary_intent, *intent.derived_intents}
        steps: List[str] = []

        if "health_issue" in labels or "health_emergency" in labels:
            steps.append("If symptoms are severe, call local emergency services now and keep someone with you.")
            steps.append("Prepare a short symptom timeline and current medications for faster triage.")

        if "financial_distress" in labels or "financial_support" in labels or "job_loss" in labels:
            steps.append("Prioritize essentials for the next 7 days: housing, medication, food, transport.")
            steps.append("Contact one local aid channel today for emergency relief screening.")

        if "job_search" in labels:
            steps.append("Apply to 3 targeted roles today and tailor one resume version to each role type.")

        if "mental_health_crisis" in labels:
            steps.append("You matter. Reach a trusted person now and do not stay alone.")
            steps.append("If you are in immediate danger, call emergency services right now.")

        if "emotional_support" in labels:
            steps.append("Take 60 seconds of slow breathing: inhale 4 seconds, exhale 6 seconds, repeat 6 rounds.")

        if "relationship_support" in labels:
            steps.append("Share what you want from this relationship right now: clarity, commitment, or closure.")
            steps.append("Do one honest message draft: facts, your feeling, and one clear ask.")

        if "anger_distress" in labels:
            steps.append("Pause for 30 seconds before replying to anyone so emotion does not choose for you.")
            steps.append("Tell me what triggered this in one line and I will help you respond without regret.")

        if not steps:
            steps.append("Tell me what outcome you want in the next 24 hours, and I will map exact steps.")

        return steps[:3]

    def _deterministic_support_reply(
        self,
        user_text: str,
        intent: IntentAnalysis,
        memory_hits: List[str],
        action_results: List[ActionResult],
    ) -> str:
        lower = user_text.lower()
        if intent.primary_intent == "relationship_support":
            return (
                "That sounds real, and I am glad you said it out loud. "
                "If you are in love, the next useful move is clarity, not guessing. "
                "Tell me: is this person available, and what do you want from them right now? "
                "I can help you craft the exact message to send."
            )

        if intent.primary_intent == "anger_distress" or any(token in lower for token in ["fuck", "shit"]):
            return (
                "I can hear you are upset, and I am still with you. "
                "Give me one line on what happened, and I will help you respond in a way that protects you, not your anger."
            )

        opening = {
            "high": "I hear how urgent this is, and I am staying with you through it.",
            "medium": "I hear you, and we can work this through step by step.",
            "low": "I am with you, and we can handle this calmly and clearly.",
        }[intent.urgency]

        steps = self._priority_steps(intent)
        memory_hit = self._filtered_memory_hit(user_text, memory_hits)
        action_line = ""
        if action_results:
            names = ", ".join(item.action for item in action_results)
            action_line = f" I have already initiated: {names}."

        memory_line = ""
        if memory_hit:
            memory_line = f" Relevant past context: {memory_hit[:120]}."

        return (
            f"{opening} "
            f"First, {steps[0]} "
            f"Second, {steps[1] if len(steps) > 1 else 'tell me your biggest blocker right now.'} "
            f"Third, {steps[2] if len(steps) > 2 else 'I can generate a tighter next-hour plan once you share your location.'}"
            f"{action_line}{memory_line}"
        )

    def _extract_json(self, text: str) -> dict:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start : end + 1]
        return json.loads(cleaned)

    def analyze(self, text: str) -> IntentAnalysis:
        if not text.strip():
            return IntentAnalysis(
                primary_intent="unknown",
                derived_intents=[],
                urgency="low",
                confidence=0.0,
                reasoning="No transcript text provided.",
            )

        if self.fast_mode:
            return self._fallback_intents(text)

        if self.model is None:
            return self._fallback_intents(text)

        prompt = (
            f"{INTENT_CASCADE_SYSTEM_PROMPT}\n"
            "Only output raw JSON. Do not add markdown.\n"
            f"User statement: {text}"
        )
        try:
            parsed = self._extract_json(self._generate_with_model_fallback(prompt))

            cleaned = {
                "primary_intent": str(parsed.get("primary_intent", "general_support")),
                "derived_intents": [str(item) for item in parsed.get("derived_intents", [])][:8],
                "urgency": parsed.get("urgency", "medium") if parsed.get("urgency") in {"low", "medium", "high"} else "medium",
                "confidence": float(max(0.0, min(1.0, parsed.get("confidence", 0.7)))),
                "reasoning": str(parsed.get("reasoning", "Model inference.")),
            }
            return IntentAnalysis.model_validate(cleaned)
        except Exception:
            return self._fallback_intents(text)

    def build_voice_response(
        self,
        user_text: str,
        intent: IntentAnalysis,
        memory_hits: List[str],
        action_results: List[ActionResult],
    ) -> str:
        if self.fast_mode:
            return self._deterministic_support_reply(user_text, intent, memory_hits, action_results)

        if self.model is None:
            return self._deterministic_support_reply(user_text, intent, memory_hits, action_results)

        filtered_memory = self._filtered_memory_hit(user_text, memory_hits)
        memory_context = filtered_memory[:140] if filtered_memory else "none"
        action_context = ", ".join(f"{item.action}:{item.details}" for item in action_results)
        needs_line = ", ".join(intent.derived_intents) if intent.derived_intents else "practical support"

        prompt = (
            "You are LifeLens, an elite personal support copilot. "
            "Write a concise, human, non-generic response in <=110 words. "
            "Rules: be empathetic, give specific immediate actions, no robotic labels, no 'primary intent detected'. "
            "If past similar context is provided, explicitly reference it in natural language. "
            "Never claim you do not have memory or that you cannot remember when context is available. "
            "Use this structure: one empathetic line, then First/Second/Third steps."
            f"\nUser message: {user_text}"
            f"\nIntent: {intent.primary_intent}"
            f"\nPredicted needs: {needs_line}"
            f"\nUrgency: {intent.urgency}"
            f"\nPast similar context: {memory_context or 'none'}"
            f"\nActions already triggered: {action_context or 'none'}"
        )

        try:
            text = self._generate_with_model_fallback(prompt)
            if len(text) < 20:
                return self._deterministic_support_reply(user_text, intent, memory_hits, action_results)
            lowered = text.lower()
            denied_memory = (
                "don't have a memory" in lowered
                or "do not have a memory" in lowered
                or "i can't remember" in lowered
                or "i cannot remember" in lowered
                or "let's start fresh" in lowered
                or "i don't have access to previous conversations" in lowered
                or "i do not have access to previous conversations" in lowered
                or "i don't have access to previous conversation" in lowered
                or "i do not have access to previous conversation" in lowered
                or "i can't access previous conversations" in lowered
                or "i cannot access previous conversations" in lowered
            )
            if denied_memory:
                return self._deterministic_support_reply(user_text, intent, memory_hits, action_results)
            return text
        except Exception:
            return self._deterministic_support_reply(user_text, intent, memory_hits, action_results)
