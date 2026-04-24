from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    vapi_public_key: str = Field(default="", alias="VAPI_PUBLIC_KEY")
    vapi_private_key: str = Field(default="", alias="VAPI_PRIVATE_KEY")
    vapi_assistant_id: str = Field(default="", alias="VAPI_ASSISTANT_ID")

    qdrant_api_key: str = Field(default="", alias="QDRANT_API_KEY")
    qdrant_url: str = Field(default="", alias="QDRANT_URL")

    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemma-4-26b-it", alias="GEMINI_MODEL")
    embedding_model: str = Field(default="text-embedding-004", alias="EMBEDDING_MODEL")
    insight_model: str = Field(default="gemini-2.0-flash", alias="INSIGHT_MODEL")
    demo_mode: bool = Field(default=False, alias="DEMO_MODE")
    fast_mode: bool = Field(default=True, alias="FAST_MODE")

    backend_cors_origins: str = Field(default="http://localhost:5173", alias="BACKEND_CORS_ORIGINS")

    @property
    def cors_origins(self) -> List[str]:
        raw = self.backend_cors_origins.strip()
        if not raw:
            return ["*"]
        return [part.strip() for part in raw.split(",") if part.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
