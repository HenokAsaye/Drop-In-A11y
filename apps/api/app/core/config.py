from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SAVANNA_", env_file=".env", extra="ignore")

    app_name: str = "Savanna BridgePlayer API"
    environment: Literal["development", "test", "staging", "production"] = "development"
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://savanna:savanna@localhost:5432/savanna"
    database_echo: bool = False

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    media_base_url: str = "http://localhost:8080"
    public_api_url: str = "http://localhost:8000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
