from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables (docker compose) or the repo-root .env when run locally."""

    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")

    jwt_issuer: str = "nambede-auth"
    #: auth-service's public keys: tokens are checked here (RS256), never signed
    jwks_url: str = "http://localhost:8081/.well-known/jwks.json"
    #: How long a "session still open" answer from auth-service is kept (locking takes effect within this time)
    session_check_seconds: float = 10.0

    auth_service_url: str = "http://localhost:8081"
    learning_service_url: str = "http://localhost:8084"

    cors_origins: str = "http://localhost:5173"
    request_timeout_seconds: float = 15.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
