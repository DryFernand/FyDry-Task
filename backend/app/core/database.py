import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool
from app.core.config import settings

logger = logging.getLogger("fy_dry_db")

SQLITE_DEV_URL = "sqlite:///./fydry_task.db"


def _is_placeholder(url: str) -> bool:
    return "TU_DATABASE_PASSWORD" in url or "TU_PASSWORD" in url or "PROJECT_REF" in url


def resolve_database_url() -> str:
    """Pooler de Supabase (IPv4, apto para serverless) si está configurado; si no, DATABASE_URL."""
    if settings.DATABASE_POOLER_URL and not _is_placeholder(settings.DATABASE_POOLER_URL):
        return settings.DATABASE_POOLER_URL
    if not _is_placeholder(settings.DATABASE_URL):
        return settings.DATABASE_URL
    if settings.is_production:
        raise RuntimeError("DATABASE_URL no está configurada en producción.")
    logger.warning("DATABASE_URL tiene placeholder. Usando SQLite local '%s' para desarrollo.", SQLITE_DEV_URL)
    return SQLITE_DEV_URL


db_url = resolve_database_url()

if db_url.startswith("sqlite"):
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
else:
    # NullPool: en serverless cada instancia es efímera; el pooler de Supabase gestiona las conexiones.
    engine = create_engine(db_url, poolclass=NullPool, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Provides transactional database session with auto-close."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Solo en desarrollo con SQLite crea las tablas automáticamente.
    PostgreSQL se gestiona con migraciones: `alembic upgrade head`."""
    if not db_url.startswith("sqlite"):
        return
    from app.models import Base as ModelsBase
    ModelsBase.metadata.create_all(bind=engine)
