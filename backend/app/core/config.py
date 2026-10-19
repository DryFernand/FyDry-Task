from typing import List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "fydry_task_dev_only_jwt_secret_no_usar_en_produccion"


class Settings(BaseSettings):
    PROJECT_NAME: str = "FyDry Task API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:3001"

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    # Regex opcional para previews de Vercel del propio proyecto (ej. ^https://fydry-task-[a-z0-9-]+-dary\.vercel\.app$)
    CORS_ORIGIN_REGEX: Optional[str] = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # JWT & Security
    JWT_SECRET_KEY: str = DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days session
    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    # Database Configuration (Supabase PostgreSQL)
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres"
    DATABASE_POOLER_URL: Optional[str] = None

    # Supabase Client Credentials
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Google SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@fydrytask.io"
    EMAILS_FROM_NAME: str = "FyDry Task Seguridad"
    SMTP_TLS: bool = True

    # OAuth Providers
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()

if settings.is_production and settings.JWT_SECRET_KEY == DEV_JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY debe configurarse en producción.")
