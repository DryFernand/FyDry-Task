"""Notas: letra y puntos según la escala, aprobada/reprobada e índice ponderado por créditos.

Índice = Σ(puntos × créditos) / Σ créditos. Las materias reprobadas (y las repetidas) cuentan
con sus créditos. El historial manual (índice y créditos previos) se suma como un bloque más.
Todo se calcula por carrera: cada carrera agrupa sus horarios con su escala e historial.
"""
import calendar
import math
from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import CurriculumCourse, Program, Schedule, Subject
from app.services.schedules import PERIOD_MONTHS


def get_programs(db: Session, user_id: str) -> List[Program]:
    """Carreras del usuario; la primera es la principal. Siempre hay al menos una."""
    rows = db.query(Program).filter(Program.user_id == user_id).order_by(Program.created_at, Program.id).all()
    if not rows:
        rows = [Program(user_id=user_id, name="Mi carrera")]
        db.add(rows[0])
        db.commit()
    # Horarios sin carrera (creados antes de que existieran) pasan a la principal
    if db.query(Schedule).filter(Schedule.user_id == user_id, Schedule.program_id.is_(None)).update({"program_id": rows[0].id}):
        db.commit()  # solo si cambió algo: así no guarda cambios pendientes de quien llama
    return rows


def get_program(db: Session, user_id: str, program_id: Optional[str] = None) -> Program:
    programs = get_programs(db, user_id)
    if program_id is None:
        return programs[0]
    for p in programs:
        if p.id == program_id:
            return p
    raise HTTPException(status_code=404, detail="Carrera no encontrada.")


def letter_for(grade: float, scale: List[Dict]) -> Dict:
    """Primer tramo (de mayor a menor) cuyo mínimo alcanza la nota."""
    for band in sorted(scale, key=lambda b: -b["min"]):
        if grade >= band["min"]:
            return band
    return sorted(scale, key=lambda b: b["min"])[0]


def _index(points_credits: float, credits: float) -> Optional[float]:
    return round(points_credits / credits, 2) if credits else None


def compute(db: Session, user_id: str, today: date, program_id: Optional[str] = None) -> Dict:
    st = get_program(db, user_id, program_id)
    scale = st.scale
    rows = (
        db.query(Subject, Schedule)
        .join(Schedule, Subject.schedule_id == Schedule.id)
        .filter(Schedule.user_id == user_id, Schedule.program_id == st.id)
        .order_by(Schedule.start_date, Subject.position)
        .all()
    )

    graded, pending, in_progress, in_progress_credits = [], [], 0, 0
    finished = set()  # periodos terminados; el que está en curso cuenta entre los que faltan
    current = None
    periods: Dict[str, Dict] = {}
    for subj, sch in rows:
        if sch.end_date < today:
            finished.add(sch.id)
        elif sch.start_date <= today:
            current = sch
        if subj.final_grade is None:
            if sch.end_date < today:
                pending.append({"subject_id": subj.id, "name": subj.name, "schedule": sch.name})
            elif sch.start_date <= today:
                in_progress += 1
                in_progress_credits += subj.credits or 0
            continue
        band = letter_for(subj.final_grade, scale)
        passed = subj.final_grade >= st.pass_min
        item = {
            "subject_id": subj.id,
            "name": subj.name,
            "color": subj.color,
            "schedule_id": sch.id,
            "schedule": sch.name,
            "grade": subj.final_grade,
            "letter": band["letter"],
            "points": band["points"],
            "credits": subj.credits,
            "passed": passed,
        }
        graded.append(item)
        p = periods.setdefault(sch.id, {"schedule_id": sch.id, "name": sch.name, "start_date": sch.start_date.isoformat(),
                                        "end_date": sch.end_date.isoformat(), "subjects": 0, "credits": 0, "pc": 0.0, "grades": []})
        p["subjects"] += 1
        p["grades"].append(subj.final_grade)
        if subj.credits:
            p["credits"] += subj.credits
            p["pc"] += band["points"] * subj.credits

    # Índice acumulado tras cada periodo (incluye el historial manual como punto de partida)
    base_credits = st.prior_credits or 0
    base_pc = (st.prior_index or 0) * base_credits if st.prior_index is not None else 0.0
    cum_credits, cum_pc = base_credits, base_pc
    evolution = []
    for p in sorted(periods.values(), key=lambda x: x["start_date"]):
        cum_credits += p["credits"]
        cum_pc += p["pc"]
        evolution.append({
            "schedule_id": p["schedule_id"], "name": p["name"], "start_date": p["start_date"], "end_date": p["end_date"],
            "subjects": p["subjects"], "credits": p["credits"],
            "period_index": _index(p["pc"], p["credits"]),
            "average": round(sum(p["grades"]) / len(p["grades"]), 1),
            "cumulative_index": _index(cum_pc, cum_credits),
        })

    with_credits = [g for g in graded if g["credits"]]
    letters = {b["letter"]: 0 for b in sorted(scale, key=lambda b: -b["min"])}
    for g in graded:
        letters[g["letter"]] = letters.get(g["letter"], 0) + 1
    passed = [g for g in graded if g["passed"]]
    failed = [g for g in graded if not g["passed"]]

    m = {
        "program": {"id": st.id, "name": st.name, "institution": st.institution},
        "scale": scale,
        "pass_min": st.pass_min,
        "has_prior": st.prior_index is not None or bool(st.prior_courses),
        "prior": {"index": st.prior_index, "credits": st.prior_credits, "courses": st.prior_courses, "passed": st.prior_passed, "failed": st.prior_failed},
        "cumulative_index": _index(cum_pc, cum_credits),
        "app_index": _index(sum(g["points"] * g["credits"] for g in with_credits), sum(g["credits"] for g in with_credits)),
        "average": round(sum(g["grade"] for g in graded) / len(graded), 1) if graded else None,
        "letters": letters,
        "courses": len(graded) + (st.prior_courses or 0),
        "passed": len(passed) + (st.prior_passed or 0),
        "failed": len(failed) + (st.prior_failed or 0),
        "credits_attempted": sum(g["credits"] for g in with_credits) + base_credits,
        # Del historial manual solo se sabe cuántos créditos aprobaste si no tuvo reprobadas
        "credits_passed": (
            sum(g["credits"] for g in passed if g["credits"]) + base_credits
            if not st.prior_failed else None
        ),
        "in_progress": in_progress,
        "pending_grades": pending,
        "without_credits": [g["name"] for g in graded if g["credits"] is None],
        "subjects": sorted(graded, key=lambda g: -g["grade"]),
        "evolution": evolution,
    }
    pensum = db.query(CurriculumCourse.credits).filter(CurriculumCourse.program_id == st.id).all()
    timeline = {"today": today, "finished": len(finished), "current": current,
                "months": PERIOD_MONTHS.get(st.period_type),  # duración de los periodos que vienen
                # Sin totales escritos a mano, salen del pénsum
                "total_credits": st.total_credits or (sum(c or 0 for (c,) in pensum) or None),
                "total_subjects": st.total_subjects or (len(pensum) or None)}
    m["plan"] = plan(m, st, cum_pc, in_progress_credits, timeline)
    m["insights"] = insights(m)
    return m


def _normal_cdf(z: float) -> float:
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def _add_months(d: date, n: int) -> date:
    y, mo = divmod(d.month - 1 + n, 12)
    y, mo = d.year + y, mo + 1
    return date(y, mo, min(d.day, calendar.monthrange(y, mo)[1]))


def plan(m: Dict, st: Program, pc: float, in_progress_credits: int, timeline: Dict) -> Dict:
    """Lo que falta de la carrera y, por cada meta (honores o índice deseado), qué índice necesitas
    en los créditos restantes, cuánto margen tienes y una probabilidad estimada.

    Índice final = (pc + x·R) / (C + R), con pc = puntos-crédito actuales, C = créditos del índice
    y R = créditos que faltan. Despejando: x = (meta·(C + R) − pc) / R.
    """
    tc, ts = timeline["total_credits"], timeline["total_subjects"]
    scale = sorted(st.scale, key=lambda b: -b["min"])
    top = scale[0]["points"]
    pass_band = letter_for(st.pass_min, scale)
    C = m["credits_attempted"]
    done = m["credits_passed"] if m["credits_passed"] is not None else C  # aprox. si el historial tuvo reprobadas
    transfer = st.transfer_credits or 0
    remaining = max(tc - transfer - done, 0) if tc else None
    with_cr = [s for s in m["subjects"] if s["credits"]]
    avg_cr = (tc / ts if tc and ts
              else sum(s["credits"] for s in with_cr) / len(with_cr) if with_cr else None)
    per_period = [e["credits"] for e in m["evolution"] if e["credits"]]
    rate = sum(per_period) / len(per_period) if per_period else None  # tus créditos por periodo
    limit = st.max_credits_per_period
    pace_rate = min(rate, limit) if rate and limit else rate
    # Incluye el periodo en curso: sus créditos todavía están entre los que faltan
    periods_left = 0 if remaining == 0 else math.ceil(remaining / pace_rate) if remaining and pace_rate else None
    periods_used = (st.prior_periods or 0) + timeline["finished"]
    pm, today, cur = timeline["months"], timeline["today"], timeline["current"]

    def end_after(k: int) -> Optional[str]:
        """Fin del k-ésimo periodo contando el que está en curso como el primero."""
        if not pm or k <= 0:
            return None
        if cur:
            return (_add_months(cur.end_date + timedelta(days=1), (k - 1) * pm) - timedelta(days=1)).isoformat()
        return (_add_months(today, k * pm) - timedelta(days=1)).isoformat()

    projected = periods_used + periods_left if periods_left is not None else None
    pace = {
        "plan_periods": st.plan_periods,
        "pensum_rate": round(tc / st.plan_periods, 1) if tc and st.plan_periods else None,
        "your_rate": round(rate, 1) if rate else None,
        "limit": limit,
        "projected_total": projected,
        "delta": projected - st.plan_periods if projected is not None and st.plan_periods else None,  # < 0 = adelantado
        "projected_end": end_after(periods_left or 0),
        "fastest_left": math.ceil(remaining / limit) if remaining and limit else None,
        "fastest_end": end_after(math.ceil(remaining / limit)) if remaining and limit else None,
    }

    # Probabilidad: tus puntos por materia (ponderados por créditos) como una normal.
    # ponytail: supone materias independientes con un piso de incertidumbre de 0.15 en tu nivel;
    # para afinarlo, modelar la tendencia por periodo.
    mu = sd = None
    if len(with_cr) >= 3:
        cr = sum(s["credits"] for s in with_cr)
        mu = sum(s["points"] * s["credits"] for s in with_cr) / cr
        sd = max(math.sqrt(sum(s["credits"] * (s["points"] - mu) ** 2 for s in with_cr) / cr), 0.3)
    elif m["prior"]["index"] is not None:
        mu, sd = m["prior"]["index"], 0.5

    reqs = requirements(m, st, periods_used, periods_left, tc)
    eligible = not any(r["status"] == "fail" for r in reqs)
    current = m["cumulative_index"]
    targets = [{"name": h["name"], "min": h["min"], "kind": "honor"} for h in sorted(st.honors or [], key=lambda h: -h["min"])]
    if st.target_index is not None:
        targets.append({"name": "Índice deseado", "min": st.target_index, "kind": "target"})

    for t in targets:
        T = t["min"]
        t.update(needed=None, margins=[], probability=None, final_if_all=None)
        if remaining is None:
            t["status"] = "sin_pensum"
        elif remaining == 0:
            t["status"] = "logrado" if current is not None and current >= T else "no_alcanzado"
        else:
            needed = (T * (C + remaining) - pc) / remaining
            t["needed"] = round(max(needed, 0), 2)
            slack = pc + top * remaining - T * (C + remaining)  # puntos-crédito que puedes perder frente a sacar todo A
            if needed > top + 1e-9:
                t["status"] = "imposible"
                t["final_if_all"] = round((pc + top * remaining) / (C + remaining), 2)
            else:
                t["status"] = ("asegurado" if needed <= pass_band["points"]
                               else "en_camino" if current is not None and needed <= current else "exigente")
                for b in scale[1:]:
                    if b["min"] < st.pass_min:
                        break  # reprobar quita los honores: el margen solo usa notas aprobatorias
                    credits = min(math.floor(slack / (top - b["points"]) + 1e-9), remaining) if top > b["points"] else remaining
                    t["margins"].append({"letter": b["letter"], "credits": credits,
                                         "subjects": math.floor(credits / avg_cr) if avg_cr else None})
                if mu is not None:
                    n = max(round(remaining / (avg_cr or 3)), 1)
                    se = math.sqrt(sd ** 2 / n + 0.15 ** 2)
                    t["probability"] = round(100 * (1 - _normal_cdf((needed - mu) / se)))
        if t["kind"] == "honor" and not eligible:
            t["status"], t["probability"] = "descalificado", 0
    return {
        "total_credits": tc,
        "total_subjects": ts,
        "transfer_credits": transfer,
        "credits_done": done,
        "credits_in_progress": in_progress_credits,
        "credits_remaining": remaining,
        "subjects_remaining": max(ts - m["passed"], 0) if ts else None,
        "progress": round(min((done + transfer) / tc, 1), 3) if tc else None,
        "periods_used": periods_used,
        "periods_in_app": timeline["finished"],
        "prior_periods": st.prior_periods or 0,
        "periods_left": periods_left,
        "pace": pace,
        "time_goal": time_goal(st, remaining, in_progress_credits, rate, avg_cr, timeline, pace["fastest_end"] or pace["projected_end"]),
        "max_periods": st.max_periods,
        "expected_points": round(mu, 2) if mu is not None else None,
        # Lo más alto que puede quedar tu índice si sacas la nota más alta en todo lo que falta
        "max_index": (round((pc + top * remaining) / (C + remaining), 2) if remaining else current) if remaining is not None else None,
        "eligible": eligible,
        "requirements": reqs,
        "targets": targets,
    }


def time_goal(st: Program, remaining: Optional[int], in_progress_credits: int, rate: Optional[float],
              avg_cr: Optional[float], timeline: Dict, earliest_end: Optional[str]) -> Optional[Dict]:
    """Meta de terminar para una fecha: cuántos periodos caben y cuántos créditos tocan en cada uno."""
    pm, today, cur = timeline["months"], timeline["today"], timeline["current"]
    goal = st.goal_end_date
    if not goal or not remaining or not pm:
        return None
    limit = st.max_credits_per_period
    slots = []  # periodos completos que terminan antes de la fecha meta (después del que está en curso)
    start = cur.end_date + timedelta(days=1) if cur else today
    next_end = _add_months(start, pm) - timedelta(days=1)
    while len(slots) < 60:
        end = _add_months(start, pm) - timedelta(days=1)
        if end > goal:
            break
        slots.append((start, end))
        start = end + timedelta(days=1)
    rest = remaining - (in_progress_credits if cur else 0)
    n = len(slots)
    per = (math.ceil(rest / n) if n else None) if rest > 0 else 0  # None = no cabe ningún periodo
    if rest <= 0:
        status = "posible"
    elif not n or (limit and per > limit):
        status = "imposible"
    elif rate and per > rate * 1.1:
        status = "exigente"  # más de lo que sueles inscribir
    else:
        status = "posible"
    periods = []
    if cur:
        periods.append({"start": cur.start_date.isoformat(), "end": cur.end_date.isoformat(), "credits": in_progress_credits, "in_progress": True})
    base, extra = divmod(max(rest, 0), n) if n else (0, 0)
    for i, (a, b) in enumerate(slots):
        cr = base + (1 if i < extra else 0)
        if limit:
            cr = min(cr, limit)
        if cr:
            periods.append({"start": a.isoformat(), "end": b.isoformat(), "credits": cr, "in_progress": False})
    for x in periods:
        x["subjects"] = round(x["credits"] / avg_cr) if avg_cr else None
    planned = sum(x["credits"] for x in periods if not x["in_progress"])
    return {
        "end_date": goal.isoformat(),
        "months": max(round((goal - today).days / 30.44), 0),
        "periods_available": n + (1 if cur else 0),
        "credits_per_period": per,
        "subjects_per_period": round(per / avg_cr, 1) if avg_cr and per else None,
        "next_end": next_end.isoformat(),
        "earliest_end": earliest_end,
        "your_rate": round(rate, 1) if rate else None,
        "limit": limit,
        "status": status,
        "periods": periods,
        "leftover": max(rest - planned, 0),  # créditos que no caben antes de la fecha
    }


def requirements(m: Dict, st: Program, periods_used: int, periods_left: Optional[int], tc: Optional[int]) -> List[Dict]:
    """Requisitos de historial para honores. status: ok | fail | warn | unknown."""
    out = []
    names = [s["name"] for s in m["subjects"] if not s["passed"]]
    out.append({
        "key": "no_failed", "label": "Sin materias reprobadas", "status": "fail" if m["failed"] else "ok",
        "detail": (("Reprobaste: " + ", ".join(names[:3])) if names else f"El historial tiene {m['failed']} reprobada(s).") if m["failed"]
        else "Una reprobada anula los honores aunque luego la apruebes.",
    })

    if st.probation_min is None:
        out.append({"key": "standing", "label": "Condición académica normal", "status": "unknown", "detail": "Indica el índice mínimo para no caer en prueba."})
    else:
        pm = st.probation_min
        low = [e for e in m["evolution"] if any(v is not None and v < pm for v in (e["period_index"], e["cumulative_index"]))]
        prior_low = st.prior_index is not None and st.prior_index < pm
        out.append({
            "key": "standing", "label": "Condición académica normal", "status": "fail" if low or prior_low else "ok",
            "detail": f"En {low[0]['name']} quedaste por debajo de {pm:.2f}." if low
            else f"Tu historial anterior está por debajo de {pm:.2f}." if prior_low
            else f"Ningún periodo ni acumulado por debajo de {pm:.2f}.",
        })

    if not st.max_periods:
        out.append({"key": "time", "label": "Dentro del tiempo reglamentario", "status": "unknown", "detail": "Indica la permanencia máxima en periodos."})
    else:
        total = periods_used + (periods_left or 0)
        status = "fail" if periods_used > st.max_periods else "warn" if periods_left is not None and total > st.max_periods else "ok"
        out.append({
            "key": "time", "label": "Dentro del tiempo reglamentario", "status": status,
            "detail": f"Llevas {periods_used} de {st.max_periods} periodos" + (f"; a tu ritmo terminas en {total}." if periods_left is not None else "."),
        })

    if not tc or st.min_institution_pct is None:
        out.append({"key": "residency", "label": "Créditos cursados en la institución", "status": "unknown", "detail": "Indica los créditos del pénsum y el % mínimo."})
    else:
        pct = round(100 * (tc - (st.transfer_credits or 0)) / tc)
        out.append({
            "key": "residency", "label": "Créditos cursados en la institución", "status": "ok" if pct >= st.min_institution_pct else "fail",
            "detail": f"{pct}% del pénsum en la institución (mínimo {st.min_institution_pct}%).",
        })
    return out


def insights(m: Dict) -> List[str]:
    if not m["subjects"] and not m["has_prior"]:
        return ["Aún no hay notas. Registra la nota final de cada materia al terminar el periodo, o agrega tu historial."]
    out = []
    if m["cumulative_index"] is not None:
        out.append(f"Tu índice acumulado es {m['cumulative_index']:.2f} de 4.00 con {m['credits_attempted']} créditos cursados.")
    ev = [e for e in m["evolution"] if e["period_index"] is not None]
    if len(ev) >= 2:
        last, prev = ev[-1], ev[-2]
        diff = last["period_index"] - prev["period_index"]
        if abs(diff) >= 0.1:
            out.append(f"En {last['name']} tu índice fue {last['period_index']:.2f}, {'subiendo' if diff > 0 else 'bajando'} {abs(diff):.2f} respecto a {prev['name']}.")
    if m["failed"]:
        names = [s["name"] for s in m["subjects"] if not s["passed"]]
        out.append(f"Tienes {m['failed']} materia(s) reprobada(s){': ' + ', '.join(names[:3]) if names else ''}.")
    near = [s for s in m["subjects"] if s["passed"] and s["grade"] < m["pass_min"] + 5]
    if near:
        out.append(f"Aprobaste justo en el límite: {', '.join(s['name'] for s in near[:3])}.")
    if m["subjects"]:
        best = m["subjects"][0]
        out.append(f"Tu mejor materia es {best['name']} ({best['grade']:g} · {best['letter']}).")
    if m["pending_grades"]:
        out.append(f"Faltan las notas de {len(m['pending_grades'])} materia(s) de periodos terminados.")
    if m["without_credits"]:
        out.append(f"{len(m['without_credits'])} materia(s) sin créditos no cuentan en el índice: agrégalos para que sea exacto.")
    p = m.get("plan")
    if p and p["credits_remaining"]:
        left = f"Te faltan {p['credits_remaining']} créditos"
        if p["subjects_remaining"] is not None:
            left += f" ({p['subjects_remaining']} materias)"
        if p["periods_left"]:
            left += f", unos {p['periods_left']} periodo(s) a tu ritmo"
        out.append(left + ".")
        pace = p["pace"]
        if pace["delta"] is not None:
            when = "al día con" if pace["delta"] == 0 else f"{abs(pace['delta'])} periodo(s) {'antes' if pace['delta'] < 0 else 'después'} de"
            out.append(f"A tu ritmo terminas en {pace['projected_total']} periodos, {when} los {pace['plan_periods']} del pénsum.")
        g = p["time_goal"]
        if g:
            if g["status"] == "imposible":
                soonest = f" Lo más pronto sería hacia {g['earliest_end']}." if g["earliest_end"] else ""
                if g["credits_per_period"] is None:
                    out.append(f"Terminar para {g['end_date']} no cabe: el próximo periodo completo termina el {g['next_end']}.{soonest}")
                else:
                    out.append(f"Terminar para {g['end_date']} no cabe: necesitarías {g['credits_per_period']} créditos por periodo"
                               + (f" y el límite es {g['limit']}." if g["limit"] else ".") + soonest)
            else:
                out.append(f"Para terminar en {g['months']} meses necesitas unos {g['credits_per_period']} créditos por periodo"
                           + (f" (sueles inscribir {g['your_rate']:g})." if g["your_rate"] else "."))
        reach = [t for t in p["targets"] if t["status"] in ("asegurado", "en_camino", "exigente")]
        if reach:
            t = reach[0]
            out.append(f"Para {t['name']} ({t['min']:.2f}) necesitas un índice de {t['needed']:.2f} en lo que te falta.")
    return out
