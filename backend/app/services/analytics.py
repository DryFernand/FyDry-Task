"""Métricas de actividad. Hecho = 1, A medias = 0.5, No hecho y Pospuesta = 0."""
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import TaskCategory, TaskDayReview, TaskItem

WEIGHTS = {"done": 1.0, "partial": 0.5, "not_done": 0.0, "postponed": 0.0}
WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
GOOD_DAY = 0.7  # un día "cumplido" para la racha


def _rate(items: List[TaskItem]) -> Optional[float]:
    scored = [i for i in items if i.status in WEIGHTS]
    if not scored:
        return None
    return round(sum(WEIGHTS[i.status] for i in scored) / len(scored), 3)


def _pct(r: Optional[float]) -> str:
    return f"{round((r or 0) * 100)}%"


def _slot(t: Optional[str]) -> str:
    if not t:
        return "sin_hora"
    h = int(t[:2])
    return "manana" if h < 12 else "tarde" if h < 18 else "noche"


def compute(db: Session, user_id: str, start: date, end: date, today: date) -> Dict:
    end_eval = min(end, today)
    items = (
        db.query(TaskItem)
        .filter(TaskItem.user_id == user_id, TaskItem.is_deleted.is_(False))
        .filter(TaskItem.date >= start, TaskItem.date <= end_eval)
        .all()
    )
    evaluated = [i for i in items if i.status in WEIGHTS]
    unreviewed = [i for i in items if i.status == "pending" and i.date < today]
    counts = Counter(i.status for i in evaluated)

    by_day: Dict[date, List[TaskItem]] = defaultdict(list)
    for i in evaluated:
        by_day[i.date].append(i)

    # Por día de la semana
    wd: Dict[int, List[TaskItem]] = defaultdict(list)
    for i in evaluated:
        wd[i.date.weekday()].append(i)
    by_weekday = [{"weekday": d, "name": WEEKDAYS[d], "count": len(wd[d]), "rate": _rate(wd[d])} for d in range(7)]

    # Por categoría
    cats = {c.id: c for c in db.query(TaskCategory).filter(TaskCategory.user_id == user_id).all()}
    bc: Dict[Optional[str], List[TaskItem]] = defaultdict(list)
    for i in evaluated:
        bc[i.category_id if i.category_id in cats else None].append(i)
    by_category = sorted(
        [{
            "category_id": cid,
            "name": cats[cid].name if cid else "Sin categoría",
            "color": cats[cid].color if cid else "#a1a1aa",
            "count": len(v),
            "rate": _rate(v),
        } for cid, v in bc.items()],
        key=lambda x: -x["count"],
    )

    # Por semana (tendencia)
    bw: Dict[date, List[TaskItem]] = defaultdict(list)
    for i in evaluated:
        bw[i.date - timedelta(days=i.date.weekday())].append(i)
    by_week = [{"week_start": w.isoformat(), "count": len(v), "rate": _rate(v)} for w, v in sorted(bw.items())]

    # Por franja horaria
    bs: Dict[str, List[TaskItem]] = defaultdict(list)
    for i in evaluated:
        bs[_slot(i.time)].append(i)
    by_time_slot = [{"slot": s, "count": len(bs[s]), "rate": _rate(bs[s])} for s in ("manana", "tarde", "noche", "sin_hora")]

    # Rachas: días con tareas marcadas y >= 70%. Días sin tareas no rompen la racha.
    day_rates = {d: _rate(v) for d, v in by_day.items()}
    streak, best, run = 0, 0, 0
    for d in sorted(day_rates):
        run = run + 1 if day_rates[d] >= GOOD_DAY else 0
        best = max(best, run)
    # Hoy suma si ya va bien, pero no rompe la racha mientras el día sigue en curso
    if day_rates.get(today, 0) >= GOOD_DAY:
        streak += 1
    d = today - timedelta(days=1)
    while d >= start:
        if d in day_rates:
            if day_rates[d] < GOOD_DAY:
                break
            streak += 1
        d -= timedelta(days=1)

    # Planificado vs hecho por día activo
    active_days = len(by_day)
    avg_planned = round(len(evaluated) / active_days, 1) if active_days else 0
    avg_done = round(sum(WEIGHTS[i.status] for i in evaluated) / active_days, 1) if active_days else 0

    def top(status: str, n: int) -> List[Dict]:
        c = Counter(i.title.strip() for i in evaluated if i.status == status)
        return [{"title": t, "count": k} for t, k in c.most_common(n)]

    # Energía (cierre del día) vs cumplimiento
    reviews = (
        db.query(TaskDayReview)
        .filter(TaskDayReview.user_id == user_id, TaskDayReview.date >= start, TaskDayReview.date <= end_eval)
        .all()
    )
    be: Dict[int, List[float]] = defaultdict(list)
    for r in reviews:
        if r.energy and day_rates.get(r.date) is not None:
            be[r.energy].append(day_rates[r.date])
    by_energy = [{"energy": e, "days": len(be[e]), "rate": round(sum(be[e]) / len(be[e]), 3) if be[e] else None} for e in range(1, 6)]

    metrics = {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "counts": {s: counts.get(s, 0) for s in WEIGHTS},
        "evaluated": len(evaluated),
        "unreviewed": len(unreviewed),
        "completion_rate": _rate(evaluated),
        "active_days": active_days,
        "first_day": min(by_day).isoformat() if by_day else None,
        "avg_planned_per_day": avg_planned,
        "avg_done_per_day": avg_done,
        "streak": streak,
        "best_streak": best,
        "by_weekday": by_weekday,
        "by_category": by_category,
        "by_week": by_week,
        "by_time_slot": by_time_slot,
        "by_energy": by_energy,
        "top_postponed": top("postponed", 5),
        "top_partial": top("partial", 3),
        "reviews": len(reviews),
    }
    metrics["insights"] = insights(metrics)
    return metrics


def _extremes(rows: List[Dict], min_count: int = 2):
    valid = [r for r in rows if r["rate"] is not None and r["count"] >= min_count]
    if len(valid) < 2:
        return None, None
    best = max(valid, key=lambda r: r["rate"])
    worst = min(valid, key=lambda r: r["rate"])
    return (best, worst) if best["rate"] - worst["rate"] >= 0.15 else (None, None)


def insights(m: Dict) -> List[str]:
    """Observaciones en texto a partir de las métricas (resumen semanal)."""
    if not m["evaluated"]:
        return ["Aún no hay tareas marcadas en este periodo. Marca tu checklist diario para ver tu análisis."]
    out = [f"Cumpliste el {_pct(m['completion_rate'])} de lo que planificaste ({m['evaluated']} tareas en {m['active_days']} días)."]

    best, worst = _extremes(m["by_weekday"])
    if best:
        out.append(f"Tu mejor día es el {best['name']} ({_pct(best['rate'])}) y el más difícil el {worst['name']} ({_pct(worst['rate'])}).")
    best, worst = _extremes(m["by_category"])
    if best:
        out.append(f"Donde más cumples es en {best['name']} ({_pct(best['rate'])}); donde menos, en {worst['name']} ({_pct(worst['rate'])}).")

    if m["avg_planned_per_day"] and m["avg_done_per_day"] / m["avg_planned_per_day"] < 0.6:
        out.append(
            f"Planificas en promedio {m['avg_planned_per_day']} tareas por día y completas {m['avg_done_per_day']}. "
            "Prueba planificar menos para terminar lo que empiezas."
        )
    partial = m["counts"]["partial"]
    if partial / m["evaluated"] >= 0.25:
        out.append(f"Dejas a medias el {round(partial / m['evaluated'] * 100)}% de tus tareas: divide las grandes en pasos más pequeños.")
    if m["top_postponed"] and m["top_postponed"][0]["count"] >= 3:
        t = m["top_postponed"][0]
        out.append(f"“{t['title']}” la pospusiste {t['count']} veces. ¿Sigue siendo importante?")

    high = [r for r in m["by_energy"] if r["energy"] >= 4 and r["days"]]
    low = [r for r in m["by_energy"] if r["energy"] <= 2 and r["days"]]
    if sum(r["days"] for r in high) >= 3 and sum(r["days"] for r in low) >= 3:
        hr = sum(r["rate"] * r["days"] for r in high) / sum(r["days"] for r in high)
        lr = sum(r["rate"] * r["days"] for r in low) / sum(r["days"] for r in low)
        if hr - lr >= 0.15:
            out.append(f"Con energía alta cumples {_pct(hr)}; con energía baja, {_pct(lr)}. Deja lo difícil para tus días buenos.")

    if m["streak"] >= 3:
        out.append(f"Llevas {m['streak']} días seguidos cumpliendo al menos el 70%. ¡Sigue así!")
    if m["unreviewed"]:
        out.append(f"Tienes {m['unreviewed']} tareas de días pasados sin marcar; haz el cierre del día para que el análisis sea exacto.")
    return out
