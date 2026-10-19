from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.core.database import get_db
from app.models import Challenge, Habit, TaskCategory, TaskDayReview, TaskItem
from app.schemas.tasks import (
    CategoryIn,
    CategoryOut,
    CategoryUpdate,
    CopyWeekIn,
    PostponeIn,
    ReviewIn,
    ReviewOut,
    TaskIn,
    TaskOut,
    TaskUpdate,
)

router = APIRouter()
MAX_RANGE_DAYS = 120

DEFAULT_CATEGORIES = [
    ("Trabajo", "#6e2234"),
    ("Salud", "#16a34a"),
    ("Personal", "#2563eb"),
    ("Estudio", "#d97706"),
    ("Hogar", "#7c3aed"),
]


def _owned(db: Session, model, obj_id: str, user_id: str):
    obj = db.query(model).filter(model.id == obj_id, model.user_id == user_id).first()
    if not obj or getattr(obj, "is_deleted", False):
        raise HTTPException(status_code=404, detail="No encontrado.")
    return obj


def _check_category(db: Session, category_id: Optional[str], user_id: str) -> None:
    if category_id:
        _owned(db, TaskCategory, category_id, user_id)


def _check_range(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(status_code=422, detail="La fecha final debe ser posterior a la inicial.")
    if (end - start).days > MAX_RANGE_DAYS:
        raise HTTPException(status_code=422, detail=f"El rango máximo es de {MAX_RANGE_DAYS} días.")


# ============ Categorías ============
@router.get("/categories", response_model=List[CategoryOut])
def list_categories(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(TaskCategory).filter(TaskCategory.user_id == user.id)
    if not q.first():
        for i, (name, color) in enumerate(DEFAULT_CATEGORIES):
            db.add(TaskCategory(user_id=user.id, name=name, color=color, is_default=True, position=i))
        db.commit()
    return q.order_by(TaskCategory.position, TaskCategory.created_at).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(TaskCategory).filter(TaskCategory.user_id == user.id).count()
    cat = TaskCategory(user_id=user.id, name=payload.name.strip(), color=payload.color, position=count)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: str, payload: CategoryUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = _owned(db, TaskCategory, cat_id, user.id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(cat, k, v.strip() if k == "name" else v)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(cat_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    cat = _owned(db, TaskCategory, cat_id, user.id)
    # Las tareas quedan "Sin categoría" (SQLite no aplica ON DELETE SET NULL sin PRAGMA)
    for model in (TaskItem, Habit, Challenge):
        db.query(model).filter(model.user_id == user.id, model.category_id == cat.id).update({"category_id": None})
    db.delete(cat)
    db.commit()
    return Response(status_code=204)


# ============ Tareas ============
@router.get("/tasks", response_model=List[TaskOut])
def list_tasks(
    start: date = Query(...),
    end: date = Query(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_range(start, end)
    return (
        db.query(TaskItem)
        .filter(TaskItem.user_id == user.id, TaskItem.is_deleted.is_(False))
        .filter(TaskItem.date >= start, TaskItem.date <= end)
        .order_by(TaskItem.date, TaskItem.time.is_(None), TaskItem.time, TaskItem.position, TaskItem.created_at)
        .all()
    )


@router.get("/tasks/inbox", response_model=List[TaskOut], summary="Bandeja 'Sin fecha'")
def list_inbox(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(TaskItem)
        .filter(TaskItem.user_id == user.id, TaskItem.is_deleted.is_(False), TaskItem.date.is_(None))
        .filter(TaskItem.status == "pending")
        .order_by(TaskItem.position, TaskItem.created_at)
        .all()
    )


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_category(db, payload.category_id, user.id)
    item = TaskItem(user_id=user.id, **payload.model_dump())
    item.title = item.title.strip()
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    item = _owned(db, TaskItem, task_id, user.id)
    data = payload.model_dump(exclude_unset=True)
    if item.status == "postponed" and data:
        raise HTTPException(status_code=409, detail="Esta tarea ya fue pospuesta; edita la copia en su nuevo día.")
    if "category_id" in data:
        _check_category(db, data["category_id"], user.id)
    for k, v in data.items():
        if k == "title" and v is not None:
            v = v.strip()
        if k in ("title", "priority", "status") and v is None:
            continue
        setattr(item, k, v)
    if "status" in data:
        item.status_at = datetime.utcnow() if data["status"] != "pending" else None
    db.commit()
    db.refresh(item)
    return item


@router.post("/tasks/{task_id}/postpone", response_model=TaskOut, summary="Pospone: marca la original y crea la copia en otro día")
def postpone_task(task_id: str, payload: PostponeIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    item = _owned(db, TaskItem, task_id, user.id)
    if item.status == "postponed":
        raise HTTPException(status_code=409, detail="Esta tarea ya fue pospuesta.")
    if item.date is None:
        raise HTTPException(status_code=422, detail="Las tareas sin fecha se planifican asignándoles un día.")
    if payload.date is not None and payload.date <= item.date:
        raise HTTPException(status_code=422, detail="Elige un día posterior.")
    item.status = "postponed"
    item.status_at = datetime.utcnow()
    copy = TaskItem(
        user_id=user.id, title=item.title, category_id=item.category_id, priority=item.priority,
        date=payload.date, time=item.time, postponed_from_id=item.id,
        postpone_count=item.postpone_count + 1,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    item = _owned(db, TaskItem, task_id, user.id)
    db.query(TaskItem).filter(TaskItem.postponed_from_id == item.id).update({"postponed_from_id": None})
    db.delete(item)
    db.commit()
    return Response(status_code=204)


@router.post("/tasks/copy-week", response_model=List[TaskOut], summary="Copia las tareas sueltas de una semana a otra")
def copy_week(payload: CopyWeekIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.from_start.weekday() != 0 or payload.to_start.weekday() != 0:
        raise HTTPException(status_code=422, detail="Las semanas deben empezar en lunes.")
    offset = payload.to_start - payload.from_start
    source = (
        db.query(TaskItem)
        .filter(TaskItem.user_id == user.id, TaskItem.is_deleted.is_(False), TaskItem.recurrence_id.is_(None))
        .filter(TaskItem.date >= payload.from_start, TaskItem.date <= payload.from_start + timedelta(days=6))
        .filter(TaskItem.status != "postponed")  # su copia ya está en otro día
        .all()
    )
    created = []
    for s in source:
        c = TaskItem(user_id=user.id, title=s.title, category_id=s.category_id, priority=s.priority,
                     date=s.date + offset, time=s.time, position=s.position)
        db.add(c)
        created.append(c)
    db.commit()
    for c in created:
        db.refresh(c)
    return created


# ============ Cierre del día ============
@router.get("/reviews", response_model=List[ReviewOut])
def list_reviews(start: date = Query(...), end: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_range(start, end)
    return (
        db.query(TaskDayReview)
        .filter(TaskDayReview.user_id == user.id, TaskDayReview.date >= start, TaskDayReview.date <= end)
        .order_by(TaskDayReview.date)
        .all()
    )


@router.put("/reviews/{day}", response_model=ReviewOut)
def upsert_review(day: date, payload: ReviewIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rev = db.query(TaskDayReview).filter(TaskDayReview.user_id == user.id, TaskDayReview.date == day).first()
    if not rev:
        rev = TaskDayReview(user_id=user.id, date=day)
        db.add(rev)
    rev.energy = payload.energy
    rev.note = (payload.note or "").strip() or None
    db.commit()
    db.refresh(rev)
    return rev
