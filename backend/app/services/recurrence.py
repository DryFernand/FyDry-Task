from datetime import date, timedelta
from typing import Iterable, Set

from sqlalchemy.orm import Session

from app.models import TaskItem, TaskRecurrence


def weekdays_of(rec: TaskRecurrence) -> Set[int]:
    return {int(x) for x in rec.weekdays.split(",") if x != ""}


def _days(start: date, end: date) -> Iterable[date]:
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def materialize(db: Session, user_id: str, start: date, end: date) -> None:
    """Crea las instancias de las recurrencias activas que caen en [start, end] y aún no existen.
    La restricción única (recurrence_id, date) evita duplicados; las borradas quedan con is_deleted."""
    recs = (
        db.query(TaskRecurrence)
        .filter(TaskRecurrence.user_id == user_id, TaskRecurrence.is_active.is_(True))
        .filter(TaskRecurrence.start_date <= end)
        .all()
    )
    if not recs:
        return
    existing = {
        (rid, d)
        for rid, d in db.query(TaskItem.recurrence_id, TaskItem.date)
        .filter(TaskItem.user_id == user_id, TaskItem.recurrence_id.in_([r.id for r in recs]))
        .filter(TaskItem.date >= start, TaskItem.date <= end)
        .all()
    }
    created = False
    for rec in recs:
        days = weekdays_of(rec)
        lo = max(start, rec.start_date)
        hi = min(end, rec.end_date) if rec.end_date else end
        for d in _days(lo, hi):
            if d.weekday() in days and (rec.id, d) not in existing:
                db.add(TaskItem(
                    user_id=user_id,
                    title=rec.title,
                    category_id=rec.category_id,
                    priority=rec.priority,
                    date=d,
                    time=rec.time,
                    recurrence_id=rec.id,
                ))
                created = True
    if created:
        db.commit()
