"""Notas: letra y puntos según la escala, aprobada/reprobada e índice ponderado por créditos.

Índice = Σ(puntos × créditos) / Σ créditos. Las materias reprobadas (y las repetidas) cuentan
con sus créditos. El historial manual (índice y créditos previos) se suma como un bloque más.
Todo se calcula por carrera: cada carrera agrupa sus horarios con su escala e historial.
"""
import math
from datetime import date
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Program, Schedule, Subject


def get_programs(db: Session, user_id: str) -> List[Program]:
    """Carreras del usuario; la primera es la principal. Siempre hay al menos una."""
    rows = db.query(Program).filter(Program.user_id == user_id).order_by(Program.created_at, Program.id).all()
    if not rows:
        rows = [Program(user_id=user_id, name="Mi carrera")]
        db.add(rows[0])
        db.flush()
    # Horarios sin carrera (creados antes de que existieran) pasan a la principal
    db.query(Schedule).filter(Schedule.user_id == user_id, Schedule.program_id.is_(None)).update({"program_id": rows[0].id})
    db.commit()
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
    started = set()
    periods: Dict[str, Dict] = {}
    for subj, sch in rows:
        if sch.start_date <= today:
            started.add(sch.id)
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
    m["plan"] = plan(m, st, cum_pc, in_progress_credits, (st.prior_periods or 0) + len(started))
    m["insights"] = insights(m)
    return m


def _normal_cdf(z: float) -> float:
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def plan(m: Dict, st: Program, pc: float, in_progress_credits: int, periods_used: int) -> Dict:
    """Lo que falta de la carrera y, por cada meta (honores o índice deseado), qué índice necesitas
    en los créditos restantes, cuánto margen tienes y una probabilidad estimada.

    Índice final = (pc + x·R) / (C + R), con pc = puntos-crédito actuales, C = créditos del índice
    y R = créditos que faltan. Despejando: x = (meta·(C + R) − pc) / R.
    """
    scale = sorted(st.scale, key=lambda b: -b["min"])
    top = scale[0]["points"]
    pass_band = letter_for(st.pass_min, scale)
    C = m["credits_attempted"]
    done = m["credits_passed"] if m["credits_passed"] is not None else C  # aprox. si el historial tuvo reprobadas
    transfer = st.transfer_credits or 0
    remaining = max(st.total_credits - transfer - done, 0) if st.total_credits else None
    with_cr = [s for s in m["subjects"] if s["credits"]]
    avg_cr = (st.total_credits / st.total_subjects if st.total_credits and st.total_subjects
              else sum(s["credits"] for s in with_cr) / len(with_cr) if with_cr else None)
    per_period = [e["credits"] for e in m["evolution"] if e["credits"]]
    periods_left = (0 if remaining == 0 else
                    math.ceil(remaining / (sum(per_period) / len(per_period))) if remaining and per_period else None)

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

    reqs = requirements(m, st, periods_used, periods_left)
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
        "total_credits": st.total_credits,
        "total_subjects": st.total_subjects,
        "transfer_credits": transfer,
        "credits_done": done,
        "credits_in_progress": in_progress_credits,
        "credits_remaining": remaining,
        "subjects_remaining": max(st.total_subjects - m["passed"], 0) if st.total_subjects else None,
        "progress": round(min((done + transfer) / st.total_credits, 1), 3) if st.total_credits else None,
        "periods_used": periods_used,
        "periods_left": periods_left,
        "max_periods": st.max_periods,
        "expected_points": round(mu, 2) if mu is not None else None,
        "eligible": eligible,
        "requirements": reqs,
        "targets": targets,
    }


def requirements(m: Dict, st: Program, periods_used: int, periods_left: Optional[int]) -> List[Dict]:
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

    if not st.total_credits or st.min_institution_pct is None:
        out.append({"key": "residency", "label": "Créditos cursados en la institución", "status": "unknown", "detail": "Indica los créditos del pénsum y el % mínimo."})
    else:
        pct = round(100 * (st.total_credits - (st.transfer_credits or 0)) / st.total_credits)
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
        reach = [t for t in p["targets"] if t["status"] in ("asegurado", "en_camino", "exigente")]
        if reach:
            t = reach[0]
            out.append(f"Para {t['name']} ({t['min']:.2f}) necesitas un índice de {t['needed']:.2f} en lo que te falta.")
    return out
