import json
import google.generativeai as genai
from app.services.settings import Settings

class EmotionService:
    def __init__(self, settings: Settings) -> None:
        self.enabled = bool(settings.gemini_api_key)
        self.model_name = settings.gemini_model or "gemini-2.0-flash"
        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(model_name=self.model_name)

    def _get_rule_hints(self, text: str) -> dict:
        """
        Returns:
        {
        "emotion_hint": str | None,
        "intensity_boost": float,
        "category_hint": str | None
        }
        """
        lower_text = text.lower()
        if any(token in lower_text for token in ["angry", "anger", "mad", "furious", "pissed", "hate", "damn", "shit", "fuck", "bitch", "asshole", "rage", "frustrated", "irritated", "outraged", "resentful"]):
            return {"emotion_hint": "angry", "intensity_boost": 0.35, "category_hint": "distress"}
        if "alone" in lower_text or "lonely" in lower_text:
            return {"emotion_hint": "lonely", "intensity_boost": 0.2, "category_hint": "distress"}
        elif "exhausted" in lower_text or "tired" in lower_text:
            return {"emotion_hint": "tired", "intensity_boost": 0.15, "category_hint": "low_energy"}
        elif "overwhelmed" in lower_text:
            return {"emotion_hint": "overwhelmed", "intensity_boost": 0.25, "category_hint": "distress"}
        elif "panic" in lower_text or "freaking out" in lower_text:
            return {"emotion_hint": "anxious", "intensity_boost": 0.3, "category_hint": "high_energy"}
        elif "lost" in lower_text or "nothing working" in lower_text:
            return {"emotion_hint": "hopeless", "intensity_boost": 0.25, "category_hint": "distress"}
            
        return {
            "emotion_hint": None,
            "intensity_boost": 0.0,
            "category_hint": None
        }

    def analyze_emotion(self, text: str, previous_emotion: dict | None = None, voice_metadata: dict | None = None) -> dict:
        fallback = {
            "primary_emotion": "neutral",
            "secondary_emotion": None,
            "intensity": 0.3,
            "category": "stable"
        }
        if not self.enabled or not text.strip():
            return fallback

        voice_metadata = voice_metadata or {}
        rule_hint = self._get_rule_hints(text)
        
        # Boost intensity from voice indicators
        if voice_metadata.get("crack_detected", False):
            rule_hint["intensity_boost"] = min(1.0, rule_hint["intensity_boost"] + 0.15)
        if voice_metadata.get("anger", False):
            rule_hint["emotion_hint"] = "angry"
            rule_hint["intensity_boost"] = max(rule_hint["intensity_boost"], 0.35)
            rule_hint["category_hint"] = "distress"
        if voice_metadata.get("speed") == "fast":
            rule_hint["intensity_boost"] = min(1.0, rule_hint["intensity_boost"] + 0.1)
        if voice_metadata.get("speed") == "slow":
            rule_hint["emotion_hint"] = rule_hint["emotion_hint"] or "contemplative"
            rule_hint["intensity_boost"] = min(1.0, rule_hint["intensity_boost"] + 0.1)
        
        hint_line = ""
        if rule_hint["emotion_hint"]:
            hint_line = f"\nPossible emotional hint: {rule_hint['emotion_hint']} (may or may not be correct, use only if relevant)"

        prompt = (
            "Analyze the emotional state of this message. Return ONLY a valid JSON object with the following keys:\n"
            "* primary_emotion (single word: sad, happy, anxious, angry, neutral, lonely, overwhelmed)\n"
            "* secondary_emotion (optional string or null)\n"
            "* intensity (float between 0 and 1)\n"
            "* category (one of: low_energy, high_energy, distress, positive, neutral)\n"
            f"Message: '{text}'"
            f"{hint_line}"
        )
        
        result = fallback.copy()
        try:
            response = self.model.generate_content(prompt)
            raw_text = (getattr(response, "text", None) or "").strip()
            
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(raw_text)
            
            gemini_emotion = str(data.get("primary_emotion", fallback["primary_emotion"])).lower()
            
            try:
                gemini_intensity = float(data.get("intensity", fallback["intensity"]))
            except (ValueError, TypeError):
                gemini_intensity = fallback["intensity"]
                
            final_emotion = gemini_emotion
            
            # Smart Emotion Correction
            if gemini_emotion == "neutral" and rule_hint["emotion_hint"] and rule_hint["intensity_boost"] >= 0.25:
                final_emotion = rule_hint["emotion_hint"]
                
            result["primary_emotion"] = final_emotion
            result["secondary_emotion"] = data.get("secondary_emotion")
            
            # Post-Process Boost
            final_intensity = min(1.0, gemini_intensity + rule_hint["intensity_boost"])
            result["intensity"] = final_intensity
            
            # Optional category override if we corrected the emotion strongly
            if gemini_emotion == "neutral" and rule_hint["category_hint"] and rule_hint["intensity_boost"] >= 0.25:
                result["category"] = rule_hint["category_hint"]
            else:
                result["category"] = str(data.get("category", fallback["category"])).lower()
            
            # Context Hook (Smoothing)
            if previous_emotion and isinstance(previous_emotion, dict):
                prev_intensity = previous_emotion.get("intensity")
                if isinstance(prev_intensity, (int, float)):
                    result["intensity"] = (0.7 * result["intensity"]) + (0.3 * prev_intensity)
                    
            # Normalization
            try:
                intensity = float(result["intensity"])
            except (ValueError, TypeError):
                intensity = 0.3
                
            # Clamp between 0.1 and 1.0
            result["intensity"] = max(0.1, min(1.0, intensity))

        except Exception:
            return fallback

        return result
