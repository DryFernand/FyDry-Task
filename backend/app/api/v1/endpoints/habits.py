from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.api.v1.endpoints.tasks import _check_category, _check_range, _owned
from app.core.database import get_db
from app.models import Challenge, Habit, HabitLog, TaskItem
from app.schemas.tasks import (
    ChallengeIn,
    ChallengeOut,
    ChallengeResultIn,
    ChallengeUpdate,
    HabitExtendIn,
    HabitIn,
    HabitLogIn,
    HabitOut,
    HabitRestartIn,
    HabitUpdate,
    TaskOut,
)
from app.services import habits as hs
from app.services import schedules as sched

router = APIRouter()


def _with_stats(db: Session, habits: List[Habit], today: date) -> List[HabitOut]:
    if not habits:
        return []
    start = min(h.start_date for h in habits)
    logs = hs.logs_by_date(db, [h.id for h in habits], start, today)
    out = []
    for h in habits:
        o = HabitOut.model_validate(h)
        o.stats = hs.stats(h, logs, today)
        out.append(o)
    return out


# ============ Agenda (Mi día y Semana) ============
@router.get("/agenda", summary="Tareas, hábitos, retos y clases de un rango de días")
def agenda(
    start: date = Query(...),
    end: date = Query(...),
    today: date = Query(..., description="Fecha local del usuario"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_range(start, end)
    hs.evaluate(db, user.id, today)
    tasks = (
        db.query(TaskItem)
        .filter(TaskItem.user_id == user.id, TaskItem.is_deleted.is_(False), TaskItem.date >= start, TaskItem.date <= end)
        .order_by(TaskItem.date, TaskItem.time.is_(None), TaskItem.time, TaskItem.position, TaskItem.created_at)
        .all()
    )
    habits = db.query(Habit).filter(Habit.user_id == user.id, Habit.status != "archived").order_by(Habit.position, Habit.created_at).all()
    entries, used = [], []
    logs = hs.logs_by_date(db, [h.id for h in habits], start, end)
    for h in habits:
        days = hs.scheduled_dates(h, start, end)
        if days:
            used.append(h)
        entries += [{"habit_id": h.id, "date": d.isoformat(), "status": logs.get((h.id, d))} for d in days]
    challenges = (
        db.query(Challenge)
        .filter(Challenge.user_id == user.id, Challenge.date >= start, Challenge.date <= end)
        .order_by(Challenge.date, Challenge.time.is_(None), Challenge.time, Challenge.created_at)
        .all()
    )
    return {
        "tasks": [TaskOut.model_validate(t) for t in tasks],
        "habits": _with_stats(db, used, today),
        "habit_entries": entries,
        "challenges": [ChallengeOut.model_validate(c) for c in challenges],
        "classes": sched.occurrences(db, user.id, start, end),
    }


# ============ Hábitos ============
@router.get("/habits", response_model=List[HabitOut])
def list_habits(
    today: date = Query(...),
    include_archived: bool = Query(False),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    hs.evaluate(db, user.id, today)
    q = db.query(Habit).filter(Habit.user_id == user.id)
    if not include_archived:
        q = q.filter(Habit.status != "archived")
    return _with_stats(db, q.order_by(Habit.position, Habit.created_at).all(), today)


@router.post("/habits", response_model=HabitOut, status_code=201)
def create_habit(payload: HabitIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_category(db, payload.category_id, user.id)
    data = payload.model_dump()
    data["weekdays"] = ",".join(str(d) for d in data["weekdays"])
    data["title"] = data["title"].strip()
    h = Habit(user_id=user.id, **data)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.patch("/habits/{habit_id}", response_model=HabitOut)
def update_habit(habit_id: str, payload: HabitUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    h = _owned(db, Habit, habit_id, user.id)
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        _check_category(db, data["category_id"], user.id)
    if data.get("weekdays") is not None:
        data["weekdays"] = ",".join(str(d) for d in data["weekdays"])
    for k, v in data.items():
        if k in ("title", "weekdays", "target_rate", "status") and v is None:
            continue
        setattr(h, k, v.strip() if k == "title" else v)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/habits/{habit_id}", status_code=204, summary="Borra el hábito y su historial")
def delete_habit(habit_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    h = _owned(db, Habit, habit_id, user.id)
    db.query(HabitLog).filter(HabitLog.habit_id == h.id).delete()
    db.delete(h)
    db.commit()
    return Response(status_code=204)


@router.put("/habits/{habit_id}/log", summary="Marca un día: Hecho, No hecho o desmarcar")
def log_habit(habit_id: str, payload: HabitLogIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    h = _owned(db, Habit, habit_id, user.id)
    if not hs.scheduled_dates(h, payload.date, payload.date):
        raise HTTPException(status_code=422, detail="Ese día no toca este hábito.")
    log = db.query(HabitLog).filter(HabitLog.habit_id == h.id, HabitLog.date == payload.date).first()
    if payload.status is None:
        if log:
            db.delete(log)
    elif log:
        log.status = payload.status
    else:
        db.add(HabitLog(habit_id=h.id, user_id=user.id, date=payload.date, status=payload.status))
    db.commit()
    return {"habit_id": h.id, "date": payload.date.isoformat(), "status": payload.status}


@router.post("/habits/{habit_id}/extend", response_model=HabitOut, summary="Alarga el periodo de adaptación")
def extend_habit(habit_id: str, payload: HabitExtendIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    h = _owned(db, Habit, habit_id, user.id)
    if h.kind != "building":
        raise HTTPException(status_code=422, detail="Solo los hábitos en construcción tienen periodo de adaptación.")
    h.period_days = (h.period_days or 0) + payload.days
    h.status, h.evaluated_on, h.result_notified = "active", None, False
    h.adjustments += 1
    db.commit()
    db.refresh(h)
    return h


@router.post("/habits/{habit_id}/restart", response_model=HabitOut, summary="Empieza de nuevo el periodo de adaptación")
def restart_habit(habit_id: str, payload: HabitRestartIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    h = _owned(db, Habit, habit_id, user.id)
    if h.kind != "building":
        raise HTTPException(status_code=422, detail="Solo los hábitos en construcción tienen periodo de adaptación.")
    h.start_date, h.period_days = payload.start_date, payload.period_days
    h.status, h.evaluated_on, h.result_notified, h.last_rate = "active", None, False, None
    h.adjustments += 1
    db.commit()
    db.refresh(h)
    return h


# ============ Retos ============
@router.get("/challenges", response_model=List[ChallengeOut])
def list_challenges(start: date = Query(...), end: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if end < start or (end - start).days > 366:
        raise HTTPException(status_code=422, detail="Rango inválido (máximo un año).")
    return (
        db.query(Challenge)
        .filter(Challenge.user_id == user.id, Challenge.date >= start, Challenge.date <= end)
        .order_by(Challenge.date.desc(), Challenge.time, Challenge.created_at)
        .all()
    )


@router.post("/challenges", response_model=ChallengeOut, status_code=201)
def create_challenge(payload: ChallengeIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_category(db, payload.category_id, user.id)
    c = Challenge(user_id=user.id, **payload.model_dump())
    c.title = c.title.strip()
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch("/challenges/{cid}", response_model=ChallengeOut)
def update_challenge(cid: str, payload: ChallengeUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _owned(db, Challenge, cid, user.id)
    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        _check_category(db, data["category_id"], user.id)
    for k, v in data.items():
        if k in ("title", "date") and v is None:
            continue
        setattr(c, k, v.strip() if k == "title" else v)
    db.commit()
    db.refresh(c)
    return c


@router.post("/challenges/{cid}/result", response_model=ChallengeOut, summary="Resultado del reto (nota obligatoria)")
def challenge_result(cid: str, payload: ChallengeResultIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _owned(db, Challenge, cid, user.id)
    c.status = payload.status
    c.result_note = None if payload.status == "pending" else payload.note.strip()
    c.status_at = None if payload.status == "pending" else datetime.utcnow()
    db.commit()
    db.refresh(c)
    return c


@router.delete("/challenges/{cid}", status_code=204)
def delete_challenge(cid: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, Challenge, cid, user.id))
    db.commit()
    return Response(status_code=204)
