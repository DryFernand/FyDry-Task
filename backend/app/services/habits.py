"""Hábitos: qué días tocan, progreso del periodo de adaptación y evaluación final."""
import math
from datetime import date, timedelta
from typing import Dict, Iterable, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app.models import Habit, HabitLog


def weekdays_of(h: Habit) -> Set[int]:
    return {int(x) for x in h.weekdays.split(",") if x != ""}


def end_date(h: Habit) -> Optional[date]:
    """Último día del periodo de adaptación (solo hábitos en construcción)."""
    if h.kind != "building" or not h.period_days:
        return None
    return h.start_date + timedelta(days=h.period_days - 1)


def _days(start: date, end: date) -> Iterable[date]:
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def scheduled_dates(h: Habit, start: date, end: date, history: bool = False) -> List[date]:
    """Días en [start, end] en que toca el hábito.
    En construcción solo dentro del periodo; archivado, ninguno (salvo history=True, para el análisis)."""
    if h.status == "archived" and not history:
        return []
    lo = max(start, h.start_date)
    hi = end
    e = end_date(h)
    if e:
        hi = min(hi, e)
    if lo > hi:
        return []
    days = weekdays_of(h)
    return [d for d in _days(lo, hi) if d.weekday() in days]


def logs_by_date(db: Session, habit_ids: List[str], start: date, end: date) -> Dict[Tuple[str, date], str]:
    if not habit_ids:
        return {}
    rows = (
        db.query(HabitLog.habit_id, HabitLog.date, HabitLog.status)
        .filter(HabitLog.habit_id.in_(habit_ids), HabitLog.date >= start, HabitLog.date <= end)
        .all()
    )
    return {(hid, d): st for hid, d, st in rows}


def stats(h: Habit, logs: Dict[Tuple[str, date], str], today: date) -> Dict:
    """Progreso del hábito. `logs` debe cubrir desde start_date hasta hoy (o el fin del periodo)."""
    done = lambda d: logs.get((h.id, d)) == "done"  # noqa: E731
    marked = lambda d: (h.id, d) in logs  # noqa: E731
    e = end_date(h)

    # Racha: días programados seguidos cumplidos (hoy no la rompe si aún no se marca)
    streak = 0
    past = scheduled_dates(h, h.start_date, today)
    for d in reversed(past):
        if d == today and not marked(d):
            continue
        if not done(d):
            break
        streak += 1

    out = {"streak": streak, "end_date": e.isoformat() if e else None}
    if h.kind == "building" and e:
        period = scheduled_dates(h, h.start_date, e)
        elapsed = [d for d in period if d < today or (d == today and marked(d))]
        done_n = sum(1 for d in period if done(d))
        remaining = len([d for d in period if d > today or (d == today and not marked(d))])
        needed = math.ceil(h.target_rate * len(period)) if period else 0
        out.update({
            "expected_total": len(period),
            "expected_so_far": len(elapsed),
            "done": done_n,
            "rate_so_far": round(done_n / len(elapsed), 3) if elapsed else None,
            "needed": needed,
            "days_left": max((e - today).days, 0),
            "on_track": done_n + remaining >= needed,  # aún es posible llegar a la meta
        })
    else:
        window = scheduled_dates(h, max(h.start_date, today - timedelta(days=29)), today)
        window = [d for d in window if d < today or marked(d)]
        done_n = sum(1 for d in window if done(d))
        out.update({"done_30d": done_n, "expected_30d": len(window), "rate_30d": round(done_n / len(window), 3) if window else None})
    return out


def evaluate(db: Session, user_id: str, today: date) -> List[Habit]:
    """Evalúa los hábitos en construcción cuyo periodo ya terminó.
    Cumplió la meta -> pasa a hábito real ('established'); si no -> 'needs_adjust'.
    Devuelve los evaluados ahora (el cron envía el aviso con result_notified)."""
    pending = [
        h for h in db.query(Habit).filter(Habit.user_id == user_id, Habit.kind == "building", Habit.status == "active").all()
        if end_date(h) and end_date(h) < today
    ]
    if not pending:
        return []
    for h in pending:
        e = end_date(h)
        period = scheduled_dates(h, h.start_date, e)
        logs = logs_by_date(db, [h.id], h.start_date, e)
        done_n = sum(1 for d in period if logs.get((h.id, d)) == "done")
        rate = done_n / len(period) if period else 0.0
        h.last_rate = round(rate, 3)
        h.evaluated_on = today
        h.result_notified = False
        if period and rate >= h.target_rate:
            h.kind = "established"
            h.consolidated_on = today
            h.status = "active"
        else:
            h.status = "needs_adjust"
    db.commit()
    return pending
