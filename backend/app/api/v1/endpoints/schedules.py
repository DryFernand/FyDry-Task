from datetime import date
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.api.v1.endpoints.tasks import _owned
from app.core.database import get_db
from app.models import ClassAttendance, Schedule, Subject, SubjectSession, TaskItem
from app.schemas.tasks import (
    AttendanceIn,
    ScheduleDuplicateIn,
    ScheduleIn,
    ScheduleOut,
    ScheduleUpdate,
    SessionOut,
    SubjectIn,
    SubjectOut,
    TaskOut,
)
from app.services import schedules as svc

router = APIRouter()


def _assignment_stats(db: Session, user_id: str, subject_ids: List[str], today: date) -> Dict[str, dict]:
    out = {sid: {"total": 0, "done": 0, "pending": 0, "overdue": 0, "next_date": None, "next_exam": None} for sid in subject_ids}
    if not subject_ids:
        return out
    for t in db.query(TaskItem).filter(TaskItem.user_id == user_id, TaskItem.subject_id.in_(subject_ids), TaskItem.is_deleted.is_(False)):
        if t.status == "postponed":
            continue  # su copia cuenta en el nuevo día
        o = out[t.subject_id]
        o["total"] += 1
        if t.status in ("done", "partial"):
            o["done"] += 1
        elif t.status == "pending":
            if t.date and t.date < today:
                o["overdue"] += 1
            else:
                o["pending"] += 1
                if t.date and (o["next_date"] is None or t.date.isoformat() < o["next_date"]):
                    o["next_date"] = t.date.isoformat()
                if t.assignment_type == "examen" and t.date and (o["next_exam"] is None or t.date.isoformat() < o["next_exam"]):
                    o["next_exam"] = t.date.isoformat()
    return out


def _serialize(db: Session, user_id: str, schedules: List[Schedule], today: date) -> List[ScheduleOut]:
    ids = [s.id for s in schedules]
    subjects = db.query(Subject).filter(Subject.schedule_id.in_(ids)).order_by(Subject.position, Subject.created_at).all() if ids else []
    sessions = (
        db.query(SubjectSession).filter(SubjectSession.subject_id.in_([s.id for s in subjects])).order_by(SubjectSession.weekday, SubjectSession.start_time).all()
        if subjects else []
    )
    # Choques contra TODAS las sesiones activas del usuario (también de otros horarios)
    clashes = svc.conflicts([(s, sch) for s, _, sch in svc.user_sessions(db, user_id)])
    stats = _assignment_stats(db, user_id, [s.id for s in subjects], today)
    by_subject: Dict[str, List[SubjectSession]] = {}
    for s in sessions:
        by_subject.setdefault(s.subject_id, []).append(s)

    out = []
    for sch in schedules:
        o = ScheduleOut.model_validate(sch)
        for subj in [x for x in subjects if x.schedule_id == sch.id]:
            so = SubjectOut.model_validate(subj)
            so.sessions = [SessionOut(**SessionOut.model_validate(s).model_dump(exclude={"conflicts"}), conflicts=clashes.get(s.id, [])) for s in by_subject.get(subj.id, [])]
            so.weekly_minutes = sum(svc.minutes(s) for s in by_subject.get(subj.id, []))
            so.assignments = stats[subj.id]
            o.subjects.append(so)
        o.weekly_minutes = sum(x.weekly_minutes for x in o.subjects)
        o.credits = sum(x.credits or 0 for x in o.subjects)
        out.append(o)
    return out


# ============ Horarios ============
@router.get("/schedules", response_model=List[ScheduleOut])
def list_schedules(today: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Schedule).filter(Schedule.user_id == user.id).order_by(Schedule.is_archived, Schedule.start_date.desc()).all()
    return _serialize(db, user.id, rows, today)


def _dates(payload) -> tuple:
    end = payload.end_date or svc.suggested_end(payload.start_date, payload.period_type)
    return payload.start_date, end


@router.post("/schedules", response_model=ScheduleOut, status_code=201)
def create_schedule(payload: ScheduleIn, today: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    start, end = _dates(payload)
    sch = Schedule(user_id=user.id, name=payload.name.strip(), institution=(payload.institution or "").strip() or None,
                   period_type=payload.period_type, start_date=start, end_date=end)
    db.add(sch)
    db.commit()
    return _serialize(db, user.id, [sch], today)[0]


@router.patch("/schedules/{sid}", response_model=ScheduleOut)
def update_schedule(sid: str, payload: ScheduleUpdate, today: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    sch = _owned(db, Schedule, sid, user.id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is None and k not in ("institution",):
            continue
        setattr(sch, k, v.strip() if isinstance(v, str) else v)
    if sch.end_date < sch.start_date:
        raise HTTPException(status_code=422, detail="La fecha de fin debe ser posterior al inicio.")
    db.commit()
    return _serialize(db, user.id, [sch], today)[0]


@router.delete("/schedules/{sid}", status_code=204, summary="Borra el horario con sus materias; las tareas quedan sin materia")
def delete_schedule(sid: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    sch = _owned(db, Schedule, sid, user.id)
    for subj in db.query(Subject).filter(Subject.schedule_id == sch.id).all():
        _delete_subject(db, subj)
    db.delete(sch)
    db.commit()
    return Response(status_code=204)


@router.post("/schedules/{sid}/duplicate", response_model=ScheduleOut, status_code=201, summary="Copia materias y clases a un periodo nuevo")
def duplicate_schedule(sid: str, payload: ScheduleDuplicateIn, today: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    src = _owned(db, Schedule, sid, user.id)
    start, end = _dates(payload)
    new = Schedule(user_id=user.id, name=payload.name.strip(), institution=(payload.institution or src.institution),
                   period_type=payload.period_type, start_date=start, end_date=end)
    db.add(new)
    db.flush()
    for subj in db.query(Subject).filter(Subject.schedule_id == src.id).all():
        copy = Subject(schedule_id=new.id, user_id=user.id, name=subj.name, code=subj.code, teacher=subj.teacher, color=subj.color,
                       credits=subj.credits, modality=subj.modality, location=subj.location, link=subj.link, position=subj.position)
        db.add(copy)
        db.flush()
        for s in db.query(SubjectSession).filter(SubjectSession.subject_id == subj.id).all():
            db.add(SubjectSession(subject_id=copy.id, user_id=user.id, weekday=s.weekday, start_time=s.start_time, end_time=s.end_time, location=s.location))
    db.commit()
    return _serialize(db, user.id, [new], today)[0]


# ============ Materias (con sus sesiones) ============
def _sync_sessions(db: Session, subj: Subject, user_id: str, sessions) -> None:
    """Actualiza las que traen id (conservan su asistencia), crea las nuevas y borra las que ya no están."""
    current = {s.id: s for s in db.query(SubjectSession).filter(SubjectSession.subject_id == subj.id).all()}
    keep = set()
    for item in sessions:
        if item.id and item.id in current:
            s = current[item.id]
            s.weekday, s.start_time, s.end_time, s.location = item.weekday, item.start_time, item.end_time, (item.location or "").strip() or None
            keep.add(s.id)
        else:
            db.add(SubjectSession(subject_id=subj.id, user_id=user_id, weekday=item.weekday, start_time=item.start_time,
                                  end_time=item.end_time, location=(item.location or "").strip() or None))
    for sid, s in current.items():
        if sid not in keep:
            db.query(ClassAttendance).filter(ClassAttendance.session_id == sid).delete()
            db.delete(s)


def _clean(payload: SubjectIn) -> dict:
    data = payload.model_dump(exclude={"sessions"})
    for k in ("code", "teacher", "location", "link"):
        data[k] = (data[k] or "").strip() or None
    data["name"] = data["name"].strip()
    return data


@router.post("/schedules/{sid}/subjects", response_model=ScheduleOut, status_code=201)
def create_subject(sid: str, payload: SubjectIn, today: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    sch = _owned(db, Schedule, sid, user.id)
    count = db.query(Subject).filter(Subject.schedule_id == sch.id).count()
    subj = Subject(schedule_id=sch.id, user_id=user.id, position=count, **_clean(payload))
    db.add(subj)
    db.flush()
    _sync_sessions(db, subj, user.id, payload.sessions)
    db.commit()
    return _serialize(db, user.id, [sch], today)[0]


@router.put("/subjects/{subject_id}", response_model=ScheduleOut)
def update_subject(subject_id: str, payload: SubjectIn, today: date = Query(...), user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    subj = _owned(db, Subject, subject_id, user.id)
    for k, v in _clean(payload).items():
        setattr(subj, k, v)
    _sync_sessions(db, subj, user.id, payload.sessions)
    db.commit()
    return _serialize(db, user.id, [db.get(Schedule, subj.schedule_id)], today)[0]


def _delete_subject(db: Session, subj: Subject) -> None:
    db.query(TaskItem).filter(TaskItem.subject_id == subj.id).update({"subject_id": None})
    for s in db.query(SubjectSession).filter(SubjectSession.subject_id == subj.id).all():
        db.query(ClassAttendance).filter(ClassAttendance.session_id == s.id).delete()
        db.delete(s)
    db.delete(subj)


@router.delete("/subjects/{subject_id}", status_code=204, summary="Borra la materia; sus tareas quedan sin materia")
def delete_subject(subject_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _delete_subject(db, _owned(db, Subject, subject_id, user.id))
    db.commit()
    return Response(status_code=204)


@router.get("/subjects/{subject_id}/assignments", response_model=List[TaskOut])
def subject_assignments(subject_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _owned(db, Subject, subject_id, user.id)
    return (
        db.query(TaskItem)
        .filter(TaskItem.user_id == user.id, TaskItem.subject_id == subject_id, TaskItem.is_deleted.is_(False))
        .order_by(TaskItem.date.is_(None), TaskItem.date, TaskItem.time)
        .all()
    )


# ============ Asistencia ============
@router.put("/sessions/{session_id}/attendance", summary="Asistí / No asistí (o desmarcar)")
def mark_attendance(session_id: str, payload: AttendanceIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    sess = _owned(db, SubjectSession, session_id, user.id)
    sch = db.query(Schedule).join(Subject, Subject.schedule_id == Schedule.id).filter(Subject.id == sess.subject_id).first()
    if payload.date.weekday() != sess.weekday or not (sch.start_date <= payload.date <= sch.end_date):
        raise HTTPException(status_code=422, detail="Ese día no hay esta clase.")
    row = db.query(ClassAttendance).filter(ClassAttendance.session_id == sess.id, ClassAttendance.date == payload.date).first()
    if payload.status is None:
        if row:
            db.delete(row)
    elif row:
        row.status = payload.status
    else:
        db.add(ClassAttendance(session_id=sess.id, user_id=user.id, date=payload.date, status=payload.status))
    db.commit()
    return {"session_id": sess.id, "date": payload.date.isoformat(), "status": payload.status}


@router.get("/schedules/suggest-end", summary="Fin sugerido del periodo según su tipo")
def suggest_end(start_date: date = Query(...), period_type: str = Query(...)):
    end = svc.suggested_end(start_date, period_type)
    return {"end_date": end.isoformat() if end else None}
