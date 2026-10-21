"""Notas: letra y puntos según la escala, aprobada/reprobada e índice ponderado por créditos.

Índice = Σ(puntos × créditos) / Σ créditos. Las materias reprobadas (y las repetidas) cuentan
con sus créditos. El historial manual (índice y créditos previos) se suma como un bloque más.
"""
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import AcademicSettings, Schedule, Subject
from app.models.tasks import DEFAULT_GRADE_SCALE


def get_settings(db: Session, user_id: str) -> AcademicSettings:
    s = db.get(AcademicSettings, user_id)
    if not s:
        s = AcademicSettings(user_id=user_id, scale=[dict(x) for x in DEFAULT_GRADE_SCALE], pass_min=70.0)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def letter_for(grade: float, scale: List[Dict]) -> Dict:
    """Primer tramo (de mayor a menor) cuyo mínimo alcanza la nota."""
    for band in sorted(scale, key=lambda b: -b["min"]):
        if grade >= band["min"]:
            return band
    return sorted(scale, key=lambda b: b["min"])[0]


def _index(points_credits: float, credits: float) -> Optional[float]:
    return round(points_credits / credits, 2) if credits else None


def compute(db: Session, user_id: str, today: date) -> Dict:
    st = get_settings(db, user_id)
    scale = st.scale
    rows = (
        db.query(Subject, Schedule)
        .join(Schedule, Subject.schedule_id == Schedule.id)
        .filter(Schedule.user_id == user_id)
        .order_by(Schedule.start_date, Subject.position)
        .all()
    )

    graded, pending, in_progress = [], [], 0
    periods: Dict[str, Dict] = {}
    for subj, sch in rows:
        if subj.final_grade is None:
            if sch.end_date < today:
                pending.append({"subject_id": subj.id, "name": subj.name, "schedule": sch.name})
            elif sch.start_date <= today:
                in_progress += 1
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
        "without_credits": [g["name"] for g in graded if not g["credits"]],
        "subjects": sorted(graded, key=lambda g: -g["grade"]),
        "evolution": evolution,
    }
    m["insights"] = insights(m)
    return m


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
    return out
