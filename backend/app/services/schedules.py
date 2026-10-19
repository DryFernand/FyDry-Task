"""Horarios de clases: ocurrencias por fecha, choques entre sesiones y duración de los periodos."""
import calendar
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import ClassAttendance, Schedule, Subject, SubjectSession

# Meses de cada tipo de periodo (None = el usuario pone las fechas)
PERIOD_MONTHS = {"bimestral": 2, "trimestral": 3, "cuatrimestral": 4, "semestral": 6, "anual": 12, "verano": 2, "personalizado": None}


def suggested_end(start: date, period_type: str) -> Optional[date]:
    """Fin sugerido: mismo día N meses después, menos un día."""
    months = PERIOD_MONTHS.get(period_type)
    if not months:
        return None
    y, m = divmod(start.month - 1 + months, 12)
    y, m = start.year + y, m + 1
    d = min(start.day, calendar.monthrange(y, m)[1])
    return date(y, m, d) - timedelta(days=1)


def _mins(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def minutes(sess: SubjectSession) -> int:
    return max(_mins(sess.end_time) - _mins(sess.start_time), 0)


def _overlap(a1: date, a2: date, b1: date, b2: date) -> bool:
    return a1 <= b2 and b1 <= a2


def conflicts(sessions: List[Tuple[SubjectSession, Schedule]]) -> Dict[str, List[str]]:
    """Sesiones que se cruzan (mismo día, horas superpuestas, periodos que coinciden en fechas)."""
    out: Dict[str, List[str]] = {}
    for i, (s1, sc1) in enumerate(sessions):
        for s2, sc2 in sessions[i + 1:]:
            if s1.weekday != s2.weekday or not _overlap(sc1.start_date, sc1.end_date, sc2.start_date, sc2.end_date):
                continue
            if _mins(s1.start_time) < _mins(s2.end_time) and _mins(s2.start_time) < _mins(s1.end_time):
                out.setdefault(s1.id, []).append(s2.id)
                out.setdefault(s2.id, []).append(s1.id)
    return out


def user_sessions(db: Session, user_id: str, include_archived: bool = False) -> List[Tuple[SubjectSession, Subject, Schedule]]:
    q = (
        db.query(SubjectSession, Subject, Schedule)
        .join(Subject, SubjectSession.subject_id == Subject.id)
        .join(Schedule, Subject.schedule_id == Schedule.id)
        .filter(Schedule.user_id == user_id)
    )
    if not include_archived:
        q = q.filter(Schedule.is_archived.is_(False))
    return q.all()


def occurrences(db: Session, user_id: str, start: date, end: date, include_archived: bool = False) -> List[Dict]:
    """Clases que caen en [start, end], dentro de las fechas de su horario, con su asistencia."""
    rows = [r for r in user_sessions(db, user_id, include_archived) if _overlap(r[2].start_date, r[2].end_date, start, end)]
    if not rows:
        return []
    att = {
        (a.session_id, a.date): a.status
        for a in db.query(ClassAttendance).filter(
            ClassAttendance.session_id.in_([s.id for s, _, _ in rows]), ClassAttendance.date >= start, ClassAttendance.date <= end
        )
    }
    out = []
    d = start
    while d <= end:
        for sess, subj, sch in rows:
            # Desde que existe la clase: al crear un horario a mitad de periodo no aparecen
            # semanas pasadas "sin marcar"
            since = max(sch.start_date, sess.created_at.date()) if sess.created_at else sch.start_date
            if sess.weekday == d.weekday() and since <= d <= sch.end_date:
                out.append({
                    "session_id": sess.id,
                    "subject_id": subj.id,
                    "schedule_id": sch.id,
                    "date": d.isoformat(),
                    "start_time": sess.start_time,
                    "end_time": sess.end_time,
                    "subject": subj.name,
                    "color": subj.color,
                    "location": sess.location or subj.location,
                    "modality": subj.modality,
                    "link": subj.link,
                    "teacher": subj.teacher,
                    "attendance": att.get((sess.id, d)),
                })
        d += timedelta(days=1)
    out.sort(key=lambda o: (o["date"], o["start_time"]))
    return out
