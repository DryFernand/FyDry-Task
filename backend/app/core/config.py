import json
from typing import Annotated, List, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Igual al de desarrollo de FyDry: en local los tokens de FyDry validan aquí sin configurar nada.
DEV_JWT_SECRET = "fydry_dev_only_jwt_secret_no_usar_en_produccion"


class Settings(BaseSettings):
    PROJECT_NAME: str = "FyDry Task API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    FRONTEND_URL: str = "http://localhost:3001"

    # CORS Configuration
    # NoDecode: acepta "a,b" además de JSON; sin esto un valor con comas tumba el arranque
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    # Regex opcional para previews de Vercel del propio proyecto (ej. ^https://fydry-task-[a-z0-9-]+-dary\.vercel\.app$)
    CORS_ORIGIN_REGEX: Optional[str] = None

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            return json.loads(v) if v.startswith("[") else [i.strip() for i in v.split(",") if i.strip()]
        if isinstance(v, list):
            return v
        raise ValueError(v)

    # Cuentas centralizadas en FyDry: su API emite los tokens y JWT_SECRET_KEY debe ser la MISMA que la de FyDry.
    FYDRY_API_URL: str = "http://localhost:8000/api/v1"
    JWT_SECRET_KEY: str = DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    # Cada cuánto se reconfirma con FyDry que la sesión sigue válida
    AUTH_CACHE_SECONDS: int = 300

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    # Perfil con IA (proveedor compatible con OpenAI, el mismo de FyDry)
    AI_API_KEY: str = ""
    AI_BASE_URL: str = "https://api.openai.com/v1"
    AI_MODEL: str = "gpt-4o-mini"

    # Web Push (generar con: python -m app.scripts.vapid)
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:soporte@fydry.app"
    # Protege /cron/notifications (Vercel Cron envía "Authorization: Bearer <CRON_SECRET>")
    CRON_SECRET: str = ""

    # Base de datos propia de FyDry Task (solo tareas; sin usuarios ni contraseñas)
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres"
    DATABASE_POOLER_URL: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("FYDRY_API_URL")
    @classmethod
    def strip_trailing_slash(cls, v: str) -> str:
        return v.rstrip("/")


settings = Settings()

if settings.is_production and settings.JWT_SECRET_KEY == DEV_JWT_SECRET:
    raise RuntimeError("JWT_SECRET_KEY debe configurarse en producción (la misma de FyDry).")
