from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT / ".env", ROOT / "backend" / ".env"),
        extra="ignore",
    )

    hf_token: str = ""
    hf_base_url: str = "https://router.huggingface.co/v1"
    hf_model: str = "openai/gpt-oss-120b:fastest"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


settings = Settings()
