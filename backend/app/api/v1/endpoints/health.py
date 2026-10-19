from typing import Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

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
        return {
            "status": "connected",
            "database": "Supabase PostgreSQL",
            "result": result,
        }
    except Exception:
        return {
            "status": "error",
            "database": "Supabase PostgreSQL",
        }
