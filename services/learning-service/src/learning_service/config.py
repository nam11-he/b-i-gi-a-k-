from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (docker compose) or the repo-root .env when run locally."""

    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+psycopg://nambede:nambede@localhost:5432/learning_db"
    jwt_issuer: str = "nambede-auth"
    #: auth-service's public keys: tokens are checked here (RS256), never signed
    jwks_url: str = "http://localhost:8081/.well-known/jwks.json"
    auth_service_url: str = "http://localhost:8081"
    #: Days (streak) and weeks (ranking) follow this time zone
    app_timezone: str = "Asia/Ho_Chi_Minh"


@lru_cache
def get_settings() -> Settings:
    return Settings()
