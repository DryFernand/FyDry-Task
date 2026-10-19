"""Métricas de actividad. Hecho = 1, A medias = 0.5, No hecho y Pospuesta = 0."""
from collections import Counter, defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Challenge, Habit, TaskCategory, TaskDayReview, TaskItem
from app.services import habits as hs

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


def compute_tasks(db: Session, user_id: str, start: date, end: date, today: date) -> Dict:
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


# ===================== Hábitos =====================
def compute_habits(db: Session, user_id: str, start: date, end: date, today: date) -> Dict:
    """Cumplimiento de hábitos: días que tocaban vs días hechos. Hoy cuenta solo si ya se marcó."""
    end_eval = min(end, today)
    habits = db.query(Habit).filter(Habit.user_id == user_id).all()
    logs = hs.logs_by_date(db, [h.id for h in habits], start, end_eval)
    cats = {c.id: c for c in db.query(TaskCategory).filter(TaskCategory.user_id == user_id).all()}

    rows, wd = [], defaultdict(lambda: [0, 0])  # weekday -> [esperados, hechos]
    days_with = set()
    for h in habits:
        days = hs.scheduled_dates(h, start, end_eval, history=True)
        if h.status == "archived":
            days = [d for d in days if (h.id, d) in logs]  # tras archivar no se espera nada
        days = [d for d in days if d < today or (h.id, d) in logs]
        if not days:
            continue
        done = [d for d in days if logs.get((h.id, d)) == "done"]
        for d in days:
            wd[d.weekday()][0] += 1
            if logs.get((h.id, d)) == "done":
                wd[d.weekday()][1] += 1
            if (h.id, d) in logs:
                days_with.add(d)
        st = hs.stats(h, hs.logs_by_date(db, [h.id], h.start_date, today), today)
        rows.append({
            "habit_id": h.id,
            "title": h.title,
            "kind": h.kind,
            "status": h.status,
            "category": cats[h.category_id].name if h.category_id in cats else None,
            "expected": len(days),
            "done": len(done),
            "rate": round(len(done) / len(days), 3),
            "streak": st["streak"],
            "consolidated_on": h.consolidated_on.isoformat() if h.consolidated_on else None,
        })
    rows.sort(key=lambda r: -r["expected"])
    exp = sum(r["expected"] for r in rows)
    done_n = sum(r["done"] for r in rows)
    active = [h for h in habits if h.status != "archived"]
    m = {
        "expected": exp,
        "done": done_n,
        "rate": round(done_n / exp, 3) if exp else None,
        "habits": rows,
        "by_weekday": [{"weekday": d, "name": WEEKDAYS[d], "count": wd[d][0], "rate": round(wd[d][1] / wd[d][0], 3) if wd[d][0] else None} for d in range(7)],
        "building": sum(1 for h in active if h.kind == "building" and h.status == "active"),
        "needs_adjust": sum(1 for h in active if h.status == "needs_adjust"),
        "established": sum(1 for h in active if h.kind == "established"),
        "consolidated_in_period": sum(1 for h in habits if h.consolidated_on and start <= h.consolidated_on <= end),
        "best_streak": max((r["streak"] for r in rows), default=0),
        "first_day": min(days_with).isoformat() if days_with else None,
        "active_days": len(days_with),
    }
    m["insights"] = habit_insights(m)
    return m


def habit_insights(m: Dict) -> List[str]:
    if not m["expected"]:
        return ["Aún no hay hábitos marcados en este periodo."]
    out = [f"Cumpliste tus hábitos el {_pct(m['rate'])} de las veces ({m['done']} de {m['expected']})."]
    valid = [r for r in m["habits"] if r["expected"] >= 3]
    if len(valid) >= 2:
        best = max(valid, key=lambda r: r["rate"])
        worst = min(valid, key=lambda r: r["rate"])
        if best["rate"] - worst["rate"] >= 0.15:
            out.append(f"Tu hábito más firme es “{best['title']}” ({_pct(best['rate'])}); el que más te cuesta, “{worst['title']}” ({_pct(worst['rate'])}).")
    best_d, worst_d = _extremes(m["by_weekday"])
    if worst_d:
        out.append(f"Los {worst_d['name']} es cuando más fallas tus hábitos ({_pct(worst_d['rate'])}).")
    if m["consolidated_in_period"]:
        out.append(f"🎉 Consolidaste {m['consolidated_in_period']} hábito(s) en este periodo.")
    if m["needs_adjust"]:
        out.append(f"{m['needs_adjust']} hábito(s) no llegaron a la meta: reajusta su periodo de adaptación.")
    if m["best_streak"] >= 5:
        out.append(f"Tu mejor racha actual de un hábito es de {m['best_streak']} veces seguidas.")
    return out


# ===================== Retos =====================
CH_WEIGHTS = {"achieved": 1.0, "partial": 0.5, "failed": 0.0}
CH_LABEL = {"achieved": "Logrado", "partial": "Parcial", "failed": "No logrado"}


def compute_challenges(db: Session, user_id: str, start: date, end: date, today: date) -> Dict:
    end_eval = min(end, today)
    items = (
        db.query(Challenge)
        .filter(Challenge.user_id == user_id, Challenge.date >= start, Challenge.date <= end_eval)
        .order_by(Challenge.date.desc())
        .all()
    )
    decided = [c for c in items if c.status in CH_WEIGHTS]
    counts = Counter(c.status for c in decided)
    cats = {c.id: c for c in db.query(TaskCategory).filter(TaskCategory.user_id == user_id).all()}
    bc: Dict[Optional[str], List[Challenge]] = defaultdict(list)
    for c in decided:
        bc[c.category_id if c.category_id in cats else None].append(c)
    rate = lambda lst: round(sum(CH_WEIGHTS[c.status] for c in lst) / len(lst), 3) if lst else None  # noqa: E731
    m = {
        "counts": {s: counts.get(s, 0) for s in CH_WEIGHTS},
        "decided": len(decided),
        "pending_past": sum(1 for c in items if c.status == "pending" and c.date < today),
        "rate": rate(decided),
        "by_category": sorted(
            [{"category_id": cid, "name": cats[cid].name if cid else "Sin categoría", "color": cats[cid].color if cid else "#a1a1aa",
              "count": len(v), "rate": rate(v)} for cid, v in bc.items()],
            key=lambda x: -x["count"],
        ),
        # Sin las notas: solo título, fecha y resultado
        "recent": [{"title": c.title, "date": c.date.isoformat(), "status": c.status} for c in decided[:10]],
        "first_day": min(c.date for c in decided).isoformat() if decided else None,
        "active_days": len({c.date for c in decided}),
    }
    m["insights"] = challenge_insights(m)
    return m


def challenge_insights(m: Dict) -> List[str]:
    if not m["decided"]:
        return ["Aún no hay retos con resultado en este periodo."]
    c = m["counts"]
    out = [f"Lograste {c['achieved']} de {m['decided']} retos ({_pct(m['rate'])} contando los parciales a la mitad)."]
    if c["partial"] / m["decided"] >= 0.4:
        out.append("Muchos retos te quedan en parcial: quizá te pones metas un poco más altas de lo que hoy puedes; ajústalas un paso.")
    if m["pending_past"]:
        out.append(f"Tienes {m['pending_past']} reto(s) pasados sin resultado: cuéntanos cómo te fue en el cierre del día.")
    return out


# ===================== Resumen general =====================
def compute_all(db: Session, user_id: str, start: date, end: date, today: date) -> Dict:
    t = compute_tasks(db, user_id, start, end, today)
    h = compute_habits(db, user_id, start, end, today)
    c = compute_challenges(db, user_id, start, end, today)
    firsts = [x for x in (t["first_day"], h["first_day"], c["first_day"]) if x]
    days = set()
    # días activos combinados: cualquier día con algo marcado
    for d in db.query(TaskItem.date).filter(TaskItem.user_id == user_id, TaskItem.status != "pending", TaskItem.date >= start, TaskItem.date <= min(end, today)).distinct():
        days.add(d[0])
    from app.models import HabitLog  # noqa: E402  (evita import circular en el arranque)
    for d in db.query(HabitLog.date).filter(HabitLog.user_id == user_id, HabitLog.date >= start, HabitLog.date <= min(end, today)).distinct():
        days.add(d[0])
    for d in db.query(Challenge.date).filter(Challenge.user_id == user_id, Challenge.status != "pending", Challenge.date >= start, Challenge.date <= min(end, today)).distinct():
        days.add(d[0])
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "overview": {
            "tasks_rate": t["completion_rate"],
            "habits_rate": h["rate"],
            "challenges_rate": c["rate"],
            "active_days": len(days),
            "first_day": min(firsts) if firsts else None,
        },
        "insights": t["insights"][:2] + h["insights"][:2] + c["insights"][:1],
        "tasks": t,
        "habits": h,
        "challenges": c,
    }
