import json
import google.generativeai as genai
from app.services.settings import Settings

class CheerupService:
    def __init__(self, settings: Settings) -> None:
        self.enabled = bool(settings.gemini_api_key)
        self.model_name = settings.gemini_model or "gemini-2.0-flash"
        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(model_name=self.model_name)

    def build_user_profile(self, user_memory: dict, memory_lines: list[str] | None = None) -> dict:
        profile = {
            "communication_style": "detailed",
            "emotional_preference": "comfort",
            "engagement": "interactive"
        }
        
        # Simple heuristics
        if user_memory.get("prefers_short", False):
            profile["communication_style"] = "short"
            
        if user_memory.get("likes_motivation", False):
            profile["emotional_preference"] = "motivation"
        elif user_memory.get("tends_to_overthink", False):
            profile["emotional_preference"] = "logic"
            
        return profile

    def generate_strategy(self, emotion: str, intensity: float, user_memory: dict, memory_lines: list[str] | None = None, message: str = "") -> dict:
        fallback = {
            "strategy": "calm",
            "tone": "soft and supportive",
            "style": "simple and human",
            "extra_action": None,
            "profile": self.build_user_profile(user_memory, memory_lines)
        }

        if not self.enabled:
            return fallback

        # Extract behavior patterns from user_memory
        prefers_short = user_memory.get("prefers_short", False)
        likes_motivation = user_memory.get("likes_motivation", False)
        likes_humor = user_memory.get("likes_humor", False)
        tends_to_overthink = user_memory.get("tends_to_overthink", False)
        prefers_visual_support = user_memory.get("prefers_visual_support", False)
        
        # Determine Base Strategy
        base_strategy = None
        if emotion == "sad" and intensity > 0.7:
            base_strategy = "companion"
        elif emotion == "anxious":
            base_strategy = "calm"
        elif emotion == "hopeless":
            base_strategy = "energy"
        elif emotion == "overthinking":
            base_strategy = "rational"
            
        if prefers_visual_support:
            base_strategy = "visual"
            
        if not base_strategy:
            base_strategy = "companion"
            
        # Determine Extra Action based on intensity or emotion
        extra_action = None
        if intensity > 0.75:
            if base_strategy == "calm":
                extra_action = "breathing"
            elif base_strategy == "visual":
                extra_action = "visual_boost"
            elif base_strategy == "companion":
                extra_action = "conversation"
                
        # Override for games logic: if sad or anxious or explicitly talking about games
        message_lower = message.lower()
        mentions_games = any(w in message_lower for w in ["game", "games", "play"])
        if mentions_games or (emotion in ["sad", "anxious", "overwhelmed"] and intensity > 0.6):
             extra_action = "play_game"

        # Construct Memory Traits String
        traits = []
        if prefers_short: traits.append("prefers short responses")
        if likes_motivation: traits.append("likes motivation")
        if likes_humor: traits.append("likes humor")
        if tends_to_overthink: traits.append("tends to overthink")
        if prefers_visual_support: traits.append("prefers visual support")
        memory_traits = ", ".join(traits) if traits else "neutral/no specific traits"
        
        profile = self.build_user_profile(user_memory, memory_lines)

        prompt = (
            f"User emotion: {emotion}, intensity: {intensity}, personality traits: {memory_traits}.\n"
            f"Strategy is already chosen: {base_strategy}\n"
            "Your job:\n"
            "- refine tone\n"
            "- refine style\n"
            "- DO NOT change strategy\n"
            "- DO NOT introduce a different emotional approach\n"
            "Return ONLY a valid JSON object in this exact format:\n"
            "{\n"
            '  "strategy": "...",\n'
            '  "tone": "...",\n'
            '  "style": "..."\n'
            "}"
        )

        try:
            response = self.model.generate_content(prompt)
            raw_text = (getattr(response, "text", None) or "").strip()
            
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(raw_text)
            
            # Merge Rule + Gemini
            # NEVER let Gemini override safety-critical rule choices. So we force base_strategy.
            return {
                "strategy": base_strategy,
                "tone": data.get("tone", fallback["tone"]),
                "style": data.get("style", fallback["style"]),
                "extra_action": extra_action,
                "profile": profile
            }

        except Exception:
            return {
                "strategy": base_strategy,
                "tone": fallback["tone"],
                "style": fallback["style"],
                "extra_action": extra_action,
                "profile": profile
            }

    def build_response_directives(self, strategy_data: dict, intensity: float) -> str:
        strategy = strategy_data.get("strategy", "calm")
        tone = strategy_data.get("tone", "")
        style = strategy_data.get("style", "")
        extra_action = strategy_data.get("extra_action")
        profile = strategy_data.get("profile", {})
        
        directives = [
            "You are NOT a generic assistant.",
            "You MUST strictly follow this emotional response mode:",
            f"Strategy: {strategy}",
            f"Tone: {tone}",
            f"Style: {style}",
            "",
            "Behavior Rules:",
            "* calm -> slow, grounding, soft, reassuring",
            "* energy -> motivating, forward-moving, uplifting",
            "* companion -> warm, human-like, short, emotionally present. Speak like you are sitting with the user, not advising them.",
            "* rational -> structured, logical, calming clarity",
            "* visual -> expressive, slightly vivid, engaging",
            "",
            "Tone Consistency:",
            "* Maintain the SAME emotional tone from start to finish.",
            "* Do NOT shift tone midway.",
            "* Do NOT mix multiple strategies.",
            "* Fully commit to the assigned mode",
            "",
            "Action Rules:"
        ]
        
        if extra_action:
            directives.append("* If suggesting an action, make it optional, phrase gently, never sound like a command, and make it feel like doing it together.")
            if extra_action == "breathing":
                directives.append("* Gently guide user toward a calming action (e.g. 'Maybe we can slow things down together for a moment').")
            elif extra_action == "visual_boost":
                directives.append("* Add slight uplifting or expressive tone.")
            elif extra_action == "conversation":
                directives.append("* Include a soft follow-up question.")
            elif extra_action == "play_game":
                directives.append("* CRITICAL: The user seems sad, anxious, or interested in games. Gently ask them: 'Would you like to play a quick game to take your mind off things?'")
            
        if strategy == "companion" or intensity > 0.7:
            directives.append("")
            directives.append("Follow-up rules:")
            directives.append("* Ask AT MOST one question.")
            directives.append("* Do NOT ask a question in every response.")
            directives.append("* Only ask if it feels natural and supportive.")
            directives.append("* If the user already explained a lot, avoid asking again.")
            
        directives.append("")
        directives.append("User Personality:")
        directives.append(f"* prefers: {profile.get('emotional_preference')}")
        directives.append(f"* style: {profile.get('communication_style')}")
        directives.append(f"* engagement: {profile.get('engagement')}")
        directives.append("* Use personality guidance subtly. Do NOT explicitly mention user traits. Do NOT sound algorithmic or predictable. Adapt naturally.")
        
        style_pref = profile.get("communication_style")
        emo_pref = profile.get("emotional_preference")
        
        if style_pref == "short": directives.append("* Keep response concise.")
        if style_pref == "detailed": directives.append("* Expand explanation.")
        if emo_pref == "comfort": directives.append("* Use softer tone.")
        if emo_pref == "motivation": directives.append("* Use stronger encouragement.")
        if emo_pref == "logic": directives.append("* Use structured reasoning.")
        
        return "\n".join(directives)
