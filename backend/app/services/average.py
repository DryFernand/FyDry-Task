"""Carreras por promedio (sin créditos): una nota final (0-100) por periodo.

Promedio = Σ notas / periodos con nota (los reprobados también cuentan). El historial previo entra
como `prior_periods` periodos con `prior_average`. El avance se mide en periodos del pénsum.
Promedio final = (S + x·R) / (N + R) con S = suma de notas, N = periodos con nota y R = periodos
que faltan. Despejando: x = (meta·(N + R) − S) / R.
"""
import math
from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Program, Schedule
from app.services.grades import _end_after, _normal_cdf, _slots, letter_for
from app.services.schedules import PERIOD_MONTHS


def compute(db: Session, st: Program, today: date) -> Dict:
    rows = db.query(Schedule).filter(Schedule.user_id == st.user_id, Schedule.program_id == st.id).order_by(Schedule.start_date).all()
    current = next((s for s in rows if s.start_date <= today <= s.end_date), None)
    graded = [s for s in rows if s.final_grade is not None]
    prior_n = (st.prior_periods or 0) if st.prior_average is not None else 0
    S = sum(s.final_grade for s in graded) + (st.prior_average or 0) * prior_n
    N = len(graded) + prior_n

    evolution, run_s, run_n = [], (st.prior_average or 0) * prior_n, prior_n
    for s in graded:
        run_s, run_n = run_s + s.final_grade, run_n + 1
        evolution.append({
            "schedule_id": s.id, "name": s.name, "start_date": s.start_date.isoformat(), "end_date": s.end_date.isoformat(),
            "grade": s.final_grade, "letter": letter_for(s.final_grade, st.scale)["letter"], "passed": s.final_grade >= st.pass_min,
            "cumulative_average": round(run_s / run_n, 1),
        })
    failed_app = [e for e in evolution if not e["passed"]]
    m = {
        "mode": "average",
        "program": {"id": st.id, "name": st.name, "institution": st.institution},
        "scale": st.scale,
        "pass_min": st.pass_min,
        "has_prior": prior_n > 0,
        "prior": {"average": st.prior_average, "periods": st.prior_periods, "failed": st.prior_failed},
        "average": round(S / N, 1) if N else None,
        "app_average": round(sum(s.final_grade for s in graded) / len(graded), 1) if graded else None,
        "periods_graded": N,
        # Los periodos previos cuentan como aprobados salvo los que marcaste reprobados
        "passed": len(graded) - len(failed_app) + max((st.prior_periods or 0) - (st.prior_failed or 0), 0),
        "failed": len(failed_app) + (st.prior_failed or 0),
        "in_progress": 1 if current and current.final_grade is None else 0,
        "pending_grades": [{"schedule_id": s.id, "name": s.name} for s in rows if s.final_grade is None and s.end_date < today],
        "evolution": evolution,
        "best": max(evolution, key=lambda e: e["grade"]) if evolution else None,
    }
    finished = sum(1 for s in rows if s.end_date < today)
    timeline = {"today": today, "finished": finished, "current": current, "months": PERIOD_MONTHS.get(st.period_type)}
    if current and current.final_grade is not None:
        # Periodo en curso que ya tiene nota: cuenta como terminado y lo que falta empieza después de él
        timeline.update(finished=finished + 1, current=None, today=current.end_date + timedelta(days=1))
    m["plan"] = plan(m, st, S, N, timeline)
    m["insights"] = insights(m)
    return m


def plan(m: Dict, st: Program, S: float, N: int, timeline: Dict) -> Dict:
    total = st.plan_periods
    done = m["passed"]  # un periodo reprobado se repite: no avanza
    remaining = max(total - done, 0) if total else None
    periods_used = (st.prior_periods or 0) + timeline["finished"]
    current = m["average"]

    grades = [e["grade"] for e in m["evolution"]]
    mu = sd = None
    if len(grades) >= 3:
        mu = sum(grades) / len(grades)
        sd = max(math.sqrt(sum((g - mu) ** 2 for g in grades) / len(grades)), 3)
    elif st.prior_average is not None:
        mu, sd = st.prior_average, 6

    reqs = requirements(m, st, periods_used, remaining)
    eligible = not any(r["status"] == "fail" for r in reqs)
    targets = [{"name": h["name"], "min": h["min"], "kind": "honor"} for h in sorted(st.honors or [], key=lambda h: -h["min"])]
    if st.target_index is not None:
        targets.append({"name": "Promedio deseado", "min": st.target_index, "kind": "target"})
    for t in targets:
        T = t["min"]
        t.update(needed=None, margins=[], probability=None, final_if_all=None)
        if remaining is None:
            t["status"] = "sin_pensum"
        elif remaining == 0:
            t["status"] = "logrado" if current is not None and current >= T else "no_alcanzado"
        else:
            needed = (T * (N + remaining) - S) / remaining
            t["needed"] = round(max(needed, 0), 1)
            if needed > 100 + 1e-9:
                t["status"] = "imposible"
                t["final_if_all"] = round((S + 100 * remaining) / (N + remaining), 1)
            else:
                t["status"] = ("asegurado" if needed <= st.pass_min
                               else "en_camino" if current is not None and needed <= current else "exigente")
                if mu is not None:
                    # ponytail: periodos independientes con un piso de 4 puntos de incertidumbre en tu nivel
                    se = math.sqrt(sd ** 2 / remaining + 4 ** 2)
                    t["probability"] = round(100 * (1 - _normal_cdf((needed - mu) / se)))
        if t["kind"] == "honor" and not eligible:
            t["status"], t["probability"] = "descalificado", 0

    projected = periods_used + remaining if remaining is not None else None
    end_after = lambda k: _end_after(timeline, k)  # noqa: E731
    return {
        "total_periods": total,
        "periods_done": done,
        "periods_remaining": remaining,
        "progress": round(min(done / total, 1), 3) if total else None,
        "periods_used": periods_used,
        "periods_in_app": timeline["finished"],
        "prior_periods": st.prior_periods or 0,
        "pace": {
            "plan_periods": total,
            "projected_total": projected,
            "delta": projected - total if projected is not None and total else None,  # > 0 = periodos repetidos
            "projected_end": end_after(remaining or 0),
        },
        "time_goal": time_goal(st, remaining, timeline, end_after(remaining or 0)),
        "max_periods": st.max_periods,
        "expected_grade": round(mu, 1) if mu is not None else None,
        "max_average": (round((S + 100 * remaining) / (N + remaining), 1) if remaining else current) if remaining is not None else None,
        "eligible": eligible,
        "requirements": reqs,
        "targets": targets,
    }


def time_goal(st: Program, remaining: Optional[int], timeline: Dict, earliest_end: Optional[str]) -> Optional[Dict]:
    """Meta de terminar para una fecha: ¿caben los periodos que faltan?"""
    goal, today, cur = st.goal_end_date, timeline["today"], timeline["current"]
    if not goal or not remaining or not timeline["months"]:
        return None
    slots, next_end = _slots(timeline, goal)
    rest = remaining - (1 if cur else 0)  # el periodo en curso ya está andando
    periods = [{"start": cur.start_date.isoformat(), "end": cur.end_date.isoformat(), "in_progress": True}] if cur else []
    periods += [{"start": a.isoformat(), "end": b.isoformat(), "in_progress": False} for a, b in slots[:max(rest, 0)]]
    return {
        "end_date": goal.isoformat(),
        "months": max(round((goal - today).days / 30.44), 0),
        "periods_available": len(slots) + (1 if cur else 0),
        "periods_needed": remaining,
        "next_end": next_end.isoformat(),
        "earliest_end": earliest_end,
        "status": "posible" if rest <= len(slots) else "imposible",
        "periods": periods,
        "leftover": max(rest - len(slots), 0),  # periodos que no caben antes de la fecha
    }


def requirements(m: Dict, st: Program, periods_used: int, remaining: Optional[int]) -> List[Dict]:
    out = []
    names = [e["name"] for e in m["evolution"] if not e["passed"]]
    out.append({
        "key": "no_failed", "label": "Sin periodos reprobados", "status": "fail" if m["failed"] else "ok",
        "detail": ("Reprobaste: " + ", ".join(names[:3]) if names else f"El historial tiene {m['failed']} reprobado(s).") if m["failed"]
        else "Un periodo reprobado anula los honores aunque luego lo apruebes.",
    })
    if st.probation_min is None:
        out.append({"key": "standing", "label": "Condición académica normal", "status": "unknown", "detail": "Indica la nota mínima para no caer en prueba."})
    else:
        pm = st.probation_min
        low = [e for e in m["evolution"] if e["grade"] < pm or e["cumulative_average"] < pm]
        out.append({
            "key": "standing", "label": "Condición académica normal", "status": "fail" if low else "ok",
            "detail": f"En {low[0]['name']} quedaste por debajo de {pm:g}." if low else f"Ningún periodo ni promedio por debajo de {pm:g}.",
        })
    if not st.max_periods:
        out.append({"key": "time", "label": "Dentro del tiempo reglamentario", "status": "unknown", "detail": "Indica la permanencia máxima en periodos."})
    else:
        total = periods_used + (remaining or 0)
        status = "fail" if periods_used > st.max_periods else "warn" if remaining is not None and total > st.max_periods else "ok"
        out.append({
            "key": "time", "label": "Dentro del tiempo reglamentario", "status": status,
            "detail": f"Llevas {periods_used} de {st.max_periods} periodos" + (f"; terminas en {total}." if remaining is not None else "."),
        })
    return out


def insights(m: Dict) -> List[str]:
    if not m["evolution"] and not m["has_prior"]:
        return ["Aún no hay notas. Registra la nota final de cada periodo en Horario cuando termine."]
    out = []
    if m["average"] is not None:
        out.append(f"Tu promedio es {m['average']:g} de 100 con {m['periods_graded']} periodo(s) calificado(s).")
    ev = m["evolution"]
    if len(ev) >= 2 and abs(ev[-1]["grade"] - ev[-2]["grade"]) >= 1:
        diff = ev[-1]["grade"] - ev[-2]["grade"]
        out.append(f"En {ev[-1]['name']} sacaste {ev[-1]['grade']:g}, {'subiendo' if diff > 0 else 'bajando'} {abs(diff):g} respecto a {ev[-2]['name']}.")
    if m["failed"]:
        out.append(f"Tienes {m['failed']} periodo(s) reprobado(s).")
    if m["best"]:
        out.append(f"Tu mejor periodo es {m['best']['name']} ({m['best']['grade']:g}).")
    if m["pending_grades"]:
        out.append(f"Falta la nota de {len(m['pending_grades'])} periodo(s) terminado(s).")
    p = m["plan"]
    if p["periods_remaining"]:
        out.append(f"Te faltan {p['periods_remaining']} de {p['total_periods']} periodos.")
        g = p["time_goal"]
        if g:
            out.append(f"Terminar en {g['months']} meses " + ("cabe." if g["status"] == "posible" else f"no cabe: quedarían {g['leftover']} periodo(s) fuera."))
        reach = [t for t in p["targets"] if t["status"] in ("asegurado", "en_camino", "exigente")]
        if reach:
            out.append(f"Para {reach[0]['name']} ({reach[0]['min']:g}) necesitas un promedio de {reach[0]['needed']:g} en lo que falta.")
    return out
