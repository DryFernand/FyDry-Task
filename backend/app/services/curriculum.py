"""Pénsum: materias de la carrera con pre y correquisitos, y su estado según tus horarios.

Una materia del horario cuenta para una del pénsum si está enlazada (course_id) o tiene el mismo código.
Estados: aprobada > cursando > disponible (prerrequisitos aprobados) > bloqueada.
"""
from datetime import date
from typing import Dict, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import CurriculumCourse, Program, Schedule, Subject


def _code(c: str) -> str:
    return c.strip().upper()


def courses_of(db: Session, program: Program) -> List[CurriculumCourse]:
    return (db.query(CurriculumCourse).filter(CurriculumCourse.program_id == program.id)
            .order_by(CurriculumCourse.term.is_(None), CurriculumCourse.term, CurriculumCourse.position).all())


def status(db: Session, program: Program, today: date) -> Dict:
    courses = courses_of(db, program)
    taken = (db.query(Subject, Schedule).join(Schedule, Subject.schedule_id == Schedule.id)
             .filter(Schedule.program_id == program.id).all())
    by_course: Dict[str, list] = {}
    for c in courses:
        by_course[c.id] = [(s, sch) for s, sch in taken if s.course_id == c.id or (s.code and _code(s.code) == c.code)]

    passed, current = set(), set()
    for c in courses:
        linked = by_course[c.id]
        if c.done or any(s.final_grade is not None and s.final_grade >= program.pass_min for s, _ in linked):
            passed.add(c.code)
        elif any(s.final_grade is None and sch.end_date >= today for s, sch in linked):
            current.add(c.code)

    out = []
    for c in courses:
        linked = by_course[c.id]
        missing = [p for p in c.prereqs if p not in passed]
        st = ("aprobada" if c.code in passed else "cursando" if c.code in current
              else "disponible" if not missing else "bloqueada")
        out.append({
            "id": c.id, "code": c.code, "name": c.name, "credits": c.credits, "term": c.term,
            "prereqs": c.prereqs, "coreqs": c.coreqs, "done": c.done, "status": st,
            "missing_prereqs": missing,
            # Correquisitos sin aprobar ni en curso: hay que llevarlos en el mismo periodo
            "pending_coreqs": [x for x in c.coreqs if x not in passed and x not in current],
            "failed_before": any(s.final_grade is not None and s.final_grade < program.pass_min for s, _ in linked),
            "grade": max((s.final_grade for s, _ in linked if s.final_grade is not None), default=None),
        })
    count = lambda k: sum(1 for x in out if x["status"] == k)  # noqa: E731
    return {
        "courses": out,
        "summary": {
            "total": len(out), "aprobada": count("aprobada"), "cursando": count("cursando"),
            "disponible": count("disponible"), "bloqueada": count("bloqueada"),
            "credits_total": sum(x["credits"] or 0 for x in out),
            "credits_passed": sum(x["credits"] or 0 for x in out if x["status"] == "aprobada"),
        },
    }


def replace(db: Session, program: Program, items: list) -> None:
    """Guarda el pénsum completo: actualiza por código (conserva los enlaces), crea las nuevas y borra las que ya no están."""
    codes = [_code(i.code) for i in items]
    if len(set(codes)) != len(codes):
        dup = next(c for c in codes if codes.count(c) > 1)
        raise HTTPException(status_code=422, detail=f"El código {dup} está repetido.")
    known = set(codes)
    graph = {}
    for i in items:
        code = _code(i.code)
        for kind, refs in (("prerrequisito", i.prereqs), ("correquisito", i.coreqs)):
            for r in refs:
                if _code(r) == code:
                    raise HTTPException(status_code=422, detail=f"{code} no puede ser {kind} de sí misma.")
                if _code(r) not in known:
                    raise HTTPException(status_code=422, detail=f"El {kind} {_code(r)} de {code} no está en el pénsum.")
        graph[code] = [_code(r) for r in i.prereqs]
    # Un ciclo de prerrequisitos dejaría esas materias bloqueadas para siempre
    state: Dict[str, int] = {}

    def visit(n: str, path: List[str]) -> None:
        state[n] = 1
        for m in graph[n]:
            if state.get(m) == 1:
                raise HTTPException(status_code=422, detail="Prerrequisitos en círculo: " + " → ".join(path + [n, m]))
            if not state.get(m):
                visit(m, path + [n])
        state[n] = 2

    for n in graph:
        if not state.get(n):
            visit(n, [])

    current = {c.code: c for c in courses_of(db, program)}
    for pos, i in enumerate(items):
        code = _code(i.code)
        c = current.pop(code, None) or CurriculumCourse(program_id=program.id, user_id=program.user_id, code=code)
        c.name, c.credits, c.term, c.done, c.position = i.name.strip(), i.credits, i.term, i.done, pos
        c.prereqs, c.coreqs = [_code(r) for r in i.prereqs], [_code(r) for r in i.coreqs]
        db.add(c)
    for c in current.values():
        db.query(Subject).filter(Subject.course_id == c.id).update({"course_id": None})
        db.delete(c)
    db.commit()
