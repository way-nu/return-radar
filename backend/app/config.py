from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./dev.db"
    sarvam_api_key: str = ""  # empty -> fake Sarvam (canned answers)
    sarvam_stt_model: str = "saaras:v4"
    sarvam_tts_model: str = "bulbul:v3"  # check docs.sarvam.ai/api/getting-started/models on the day
    sarvam_llm_model: str = "sarvam-105b"  # sarvam-m is deprecated (Nov 2026)
    flagsmith_server_key: str = ""  # empty -> defaults below
    flagsmith_api_url: str = ""  # empty -> Flagsmith Cloud; self-hosted: http://localhost:8100/api/v1/
    flagsmith_events_url: str = ""  # empty -> SDK default (Flagsmith Cloud events); set for a self-hosted events API
    allowed_origins: str = "http://localhost:3000"
    tenant_id: str = "utsav"


@lru_cache
def get_settings() -> Settings:
    return Settings()
