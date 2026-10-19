from typing import Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from app.core.database import get_db
from app.models import Base

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK, summary="Health Check")
def health_check() -> Dict[str, str]:
    return {
        "status": "healthy",
        "service": "FyDry Task Backend API",
    }


@router.get("/health/db", status_code=status.HTTP_200_OK, summary="Database Connection Health Check")
def db_health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        # Executes simple select 1 to test Supabase PostgreSQL connection
        result = db.execute(text("SELECT 1")).scalar()
        # Si faltan tablas, falta correr `alembic upgrade head` en esta base
        existing = set(inspect(db.get_bind()).get_table_names())
        missing = sorted(set(Base.metadata.tables) - existing)
        return {
            "status": "connected",
            "database": "Supabase PostgreSQL",
            "result": result,
            "migrations": "ok" if not missing else "pendientes",
            "missing_tables": missing,
        }
    except Exception:
        return {
            "status": "error",
            "database": "Supabase PostgreSQL",
        }
