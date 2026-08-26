from functools import lru_cache
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_title: str = "Kindly"
    app_env: str = "development"
    # NoDecode stops pydantic-settings from JSON-decoding this value before the
    # validator below runs. Without it a plain comma-separated CORS_ORIGINS in
    # .env raises SettingsError at import time and the app never starts.
    cors_origins: Annotated[List[str], NoDecode] = Field(default_factory=lambda: ["*"])
    json_data_dir: str = "./data"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    enable_ai_generation: bool = True
    fallback_to_template: bool = True
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if value in (None, ""):
            return ["*"]
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def has_openai_key(self) -> bool:
        return bool(self.openai_api_key and self.openai_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
