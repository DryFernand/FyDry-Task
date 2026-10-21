from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.core.database import get_db
from app.models import TaskAiProfile
from app.schemas.tasks import ProfileOut
from app.services import ai_profile
from app.services.analytics import compute_all
from app.services import grades

router = APIRouter()

PROFILE_DAYS = 28  # periodo que analiza el perfil
MIN_SPAN_DAYS = 14  # "a partir de 2 semanas de datos"
MIN_ACTIVE_DAYS = 7


@router.get("/analytics", summary="Métricas de tareas, hábitos y retos del periodo")
def analytics(
    start: date = Query(...),
    end: date = Query(...),
    today: date = Query(..., description="Fecha local del usuario"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if end < start or (end - start).days > 366:
        raise HTTPException(status_code=422, detail="Rango inválido (máximo un año).")
    return compute_all(db, user.id, start, end, today)


@router.get("/profile", response_model=Optional[ProfileOut], summary="Último perfil generado")
def latest_profile(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(TaskAiProfile)
        .filter(TaskAiProfile.user_id == user.id)
        .order_by(TaskAiProfile.created_at.desc())
        .first()
    )


@router.post("/profile/generate", response_model=ProfileOut, summary="Genera el perfil con IA (tareas, hábitos y retos de las últimas 4 semanas)")
async def generate_profile(
    today: date = Query(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start = today - timedelta(days=PROFILE_DAYS - 1)
    metrics = compute_all(db, user.id, start, today, today)
    ov = metrics["overview"]
    first = date.fromisoformat(ov["first_day"]) if ov["first_day"] else None
    span = (today - first).days + 1 if first else 0
    if span < MIN_SPAN_DAYS or ov["active_days"] < MIN_ACTIVE_DAYS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Necesitamos al menos 2 semanas de actividad para tu perfil. "
                f"Llevas {span} días desde tu primera actividad y {ov['active_days']} días activos "
                f"(mínimo {MIN_SPAN_DAYS} y {MIN_ACTIVE_DAYS})."
            ),
        )
    metrics["grades"] = grades.compute(db, user.id, today)
    try:
        profile = await run_in_threadpool(ai_profile.generate, metrics)
    except ai_profile.AiUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    row = TaskAiProfile(user_id=user.id, period_start=start, period_end=today, profile=profile, metrics=metrics)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
