import json
import google.generativeai as genai
from app.services.settings import Settings

class LanguageService:
    def __init__(self, settings: Settings) -> None:
        self.enabled = bool(settings.gemini_api_key)
        self.model_name = settings.gemini_model or "gemini-2.0-flash"
        self._cache = {}
        self._user_languages = {}
        if self.enabled:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(model_name=self.model_name)
    
    def detect_and_translate(self, text: str, user_id: str) -> dict:
        if not self.enabled or not text.strip():
            return {"language": "en", "translation": text}
            
        cache_key = f"detect_trans:{text}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        locked_lang = self._user_languages.get(user_id)
        
        try:
            if locked_lang and locked_lang != "en":
                prompt = f"Translate the following text from {locked_lang} to English. Respond ONLY with the translated text, no quotes or extra formatting. Text: '{text}'"
                response = self.model.generate_content(prompt)
                translated = (getattr(response, "text", None) or "").strip()
                if not translated:
                    translated = text
                result = {"language": locked_lang, "translation": translated}
                self._cache[cache_key] = result
                return result
            elif locked_lang == "en":
                return {"language": "en", "translation": text}
            
            prompt = "Detect the language of the following text and translate it to English. Return ONLY valid JSON in this exact format: {\"language\": \"<ISO 639-1 code>\", \"translation\": \"<english translation>\"}. Text: '" + text + "'"
            response = self.model.generate_content(prompt)
            raw_text = (getattr(response, "text", None) or "").strip()
            
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(raw_text)
            lang = data.get("language", "en").lower()
            translation = data.get("translation", text).strip()
            
            if not lang or len(lang) > 5:
                lang = "en"
            
            if lang != "en":
                self._user_languages[user_id] = lang
            else:
                # Cache English lock to prevent future detection calls
                self._user_languages[user_id] = "en"
                
            result = {"language": lang, "translation": translation}
            self._cache[cache_key] = result
            return result
        except Exception:
            return {"language": "en", "translation": text}

    def translate_from_english(self, text: str, target_lang: str) -> str:
        if not self.enabled or target_lang == "en" or not text.strip():
            return text
            
        cache_key = f"from_en:{target_lang}:{text}"
        if cache_key in self._cache:
            return self._cache[cache_key]
            
        try:
            prompt = f"Translate the following text to the language code '{target_lang}'. Respond ONLY with the translated text, no quotes or extra formatting. Keep the tone identical. Text: '{text}'"
            response = self.model.generate_content(prompt)
            translated = (getattr(response, "text", None) or "").strip()
            if not translated:
                translated = text
            self._cache[cache_key] = translated
            return translated
        except Exception:
            return text
