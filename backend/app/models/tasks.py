import uuid
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Float,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from app.core.database import Base
from app.models.base import TimestampMixin


def _uuid() -> str:
    return str(uuid.uuid4())


# Estados de una tarea. "pending" = aún sin marcar.
TASK_STATUSES = ("pending", "done", "partial", "not_done", "postponed")
PRIORITIES = ("high", "medium", "low")


class TaskCategory(Base, TimestampMixin):
    __tablename__ = "task_categories"

    id = Column(String(36), primary_key=True, default=_uuid)
    # user_id es el id de la cuenta FyDry (vive en otra BD, sin FK)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    color = Column(String(20), nullable=False, default="#6e2234")
    is_default = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    # Categoría de estudio: sus tareas pueden tener materia y tipo de asignación
    is_academic = Column(Boolean, nullable=False, default=False)


class TaskRecurrence(Base, TimestampMixin):
    """LEGADO: las recurrentes se migraron a hábitos (migración 0002). Se conserva la tabla por el historial."""
    __tablename__ = "task_recurrences"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    category_id = Column(String(36), ForeignKey("task_categories.id", ondelete="SET NULL"), nullable=True)
    priority = Column(String(10), nullable=False, default="medium")
    time = Column(String(5), nullable=True)  # "HH:MM"
    weekdays = Column(String(20), nullable=False)  # "0,2,4" (0 = lunes)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class TaskItem(Base, TimestampMixin):
    __tablename__ = "task_items"
    __table_args__ = (UniqueConstraint("recurrence_id", "date", name="uq_task_items_recurrence_date"),)

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    category_id = Column(String(36), ForeignKey("task_categories.id", ondelete="SET NULL"), nullable=True)
    priority = Column(String(10), nullable=False, default="medium")
    date = Column(Date, nullable=True, index=True)  # None = bandeja "Sin fecha"
    time = Column(String(5), nullable=True)
    status = Column(String(12), nullable=False, default="pending")
    status_at = Column(DateTime, nullable=True)
    recurrence_id = Column(String(36), ForeignKey("task_recurrences.id", ondelete="SET NULL"), nullable=True, index=True)
    # Cadena de posposiciones: la copia apunta a la original
    postponed_from_id = Column(String(36), ForeignKey("task_items.id", ondelete="SET NULL"), nullable=True)
    postpone_count = Column(Integer, nullable=False, default=0)
    position = Column(Integer, nullable=False, default=0)
    # Las instancias de una recurrencia se borran de forma lógica para que no se regeneren
    is_deleted = Column(Boolean, nullable=False, default=False)
    reminder_sent_at = Column(DateTime, nullable=True)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True, index=True)
    assignment_type = Column(String(12), nullable=True)  # tarea | examen | proyecto | exposicion | lectura


HABIT_KINDS = ("building", "established")  # en construcción / hábito que ya tienes
HABIT_STATUSES = ("active", "needs_adjust", "archived")
CHALLENGE_STATUSES = ("pending", "achieved", "partial", "failed")


class Habit(Base, TimestampMixin):
    """Rutina en días fijos. 'building' se evalúa al terminar su periodo de adaptación."""
    __tablename__ = "habits"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    category_id = Column(String(36), ForeignKey("task_categories.id", ondelete="SET NULL"), nullable=True)
    time = Column(String(5), nullable=True)
    weekdays = Column(String(20), nullable=False)  # "0,2,4" (0 = lunes)
    kind = Column(String(12), nullable=False, default="established")
    status = Column(String(12), nullable=False, default="active")
    start_date = Column(Date, nullable=False)
    period_days = Column(Integer, nullable=True)  # solo 'building'
    target_rate = Column(Float, nullable=False, default=0.8)
    consolidated_on = Column(Date, nullable=True)  # cuando pasó de 'building' a hábito real
    evaluated_on = Column(Date, nullable=True)
    last_rate = Column(Float, nullable=True)
    result_notified = Column(Boolean, nullable=False, default=False)
    adjustments = Column(Integer, nullable=False, default=0)
    last_reminder_on = Column(Date, nullable=True)
    position = Column(Integer, nullable=False, default=0)


class HabitLog(Base, TimestampMixin):
    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_habit_logs_habit_date"),)

    id = Column(String(36), primary_key=True, default=_uuid)
    habit_id = Column(String(36), ForeignKey("habits.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    date = Column(Date, nullable=False)
    status = Column(String(10), nullable=False)  # done | not_done


class Challenge(Base, TimestampMixin):
    """Reto de un día. Al cerrarlo, la nota del resultado es obligatoria."""
    __tablename__ = "challenges"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    category_id = Column(String(36), ForeignKey("task_categories.id", ondelete="SET NULL"), nullable=True)
    date = Column(Date, nullable=False, index=True)
    time = Column(String(5), nullable=True)
    status = Column(String(10), nullable=False, default="pending")
    result_note = Column(Text, nullable=True)
    status_at = Column(DateTime, nullable=True)
    reminder_sent_at = Column(DateTime, nullable=True)


class TaskDayReview(Base, TimestampMixin):
    """Cierre del día: energía y nota."""
    __tablename__ = "task_day_reviews"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_task_day_reviews_user_date"),)

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    date = Column(Date, nullable=False)
    energy = Column(SmallInteger, nullable=True)  # 1..5
    note = Column(Text, nullable=True)


class TaskPushSubscription(Base, TimestampMixin):
    __tablename__ = "task_push_subscriptions"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    endpoint = Column(String(1000), nullable=False, unique=True)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)


class TaskNotificationPrefs(Base, TimestampMixin):
    __tablename__ = "task_notification_prefs"

    user_id = Column(String(36), primary_key=True)
    timezone = Column(String(64), nullable=False, default="America/Santo_Domingo")
    task_reminders = Column(Boolean, nullable=False, default=True)
    reminder_minutes = Column(Integer, nullable=False, default=10)
    day_close = Column(Boolean, nullable=False, default=True)
    day_close_time = Column(String(5), nullable=False, default="21:00")
    weekly_plan = Column(Boolean, nullable=False, default=True)
    weekly_plan_time = Column(String(5), nullable=False, default="18:00")  # domingos
    weekly_summary = Column(Boolean, nullable=False, default=True)  # lunes 08:00
    last_day_close_sent = Column(Date, nullable=True)
    last_weekly_plan_sent = Column(Date, nullable=True)
    last_weekly_summary_sent = Column(Date, nullable=True)
    class_reminders = Column(Boolean, nullable=False, default=True)
    deadline_reminders = Column(Boolean, nullable=False, default=True)  # entregas de mañana, 18:00
    last_deadline_sent = Column(Date, nullable=True)


class TaskAiProfile(Base, TimestampMixin):
    __tablename__ = "task_ai_profiles"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    profile = Column(JSON, nullable=False)  # {type, title, summary, reasons[], recommendations[]}
    metrics = Column(JSON, nullable=False)


PERIOD_TYPES = ("bimestral", "trimestral", "cuatrimestral", "semestral", "anual", "verano", "personalizado")
ASSIGNMENT_TYPES = ("tarea", "examen", "proyecto", "exposicion", "lectura")


class Schedule(Base, TimestampMixin):
    """Horario de clases de un periodo académico. Puede haber varios a la vez."""
    __tablename__ = "schedules"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="CASCADE"), nullable=True, index=True)
    period_type = Column(String(16), nullable=False, default="cuatrimestral")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_archived = Column(Boolean, nullable=False, default=False)


class Subject(Base, TimestampMixin):
    __tablename__ = "subjects"

    id = Column(String(36), primary_key=True, default=_uuid)
    schedule_id = Column(String(36), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(30), nullable=True)
    teacher = Column(String(120), nullable=True)
    color = Column(String(20), nullable=False, default="#6e2234")
    credits = Column(Integer, nullable=True)
    modality = Column(String(12), nullable=False, default="presencial")  # presencial | virtual | mixta
    location = Column(String(120), nullable=True)
    link = Column(String(500), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    final_grade = Column(Float, nullable=True)  # 0-100; letra, puntos y aprobada salen de la escala
    course_id = Column(String(36), ForeignKey("curriculum_courses.id", ondelete="SET NULL"), nullable=True, index=True)


class SubjectSession(Base, TimestampMixin):
    """Una clase semanal: día y horas. El aula puede cambiar por sesión (ej. laboratorio)."""
    __tablename__ = "subject_sessions"

    id = Column(String(36), primary_key=True, default=_uuid)
    subject_id = Column(String(36), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    weekday = Column(SmallInteger, nullable=False)  # 0 = lunes
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)
    location = Column(String(120), nullable=True)
    last_reminder_on = Column(Date, nullable=True)


class ClassAttendance(Base, TimestampMixin):
    __tablename__ = "class_attendance"
    __table_args__ = (UniqueConstraint("session_id", "date", name="uq_class_attendance_session_date"),)

    id = Column(String(36), primary_key=True, default=_uuid)
    session_id = Column(String(36), ForeignKey("subject_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    date = Column(Date, nullable=False)
    status = Column(String(10), nullable=False)  # attended | absent


# Escala por defecto (RD, 4 puntos). Se aprueba con pass_min (70): la D da 1 punto pero es reprobada.
DEFAULT_GRADE_SCALE = [
    {"letter": "A", "min": 90, "points": 4.0},
    {"letter": "B", "min": 80, "points": 3.0},
    {"letter": "C", "min": 70, "points": 2.0},
    {"letter": "D", "min": 60, "points": 1.0},
    {"letter": "F", "min": 0, "points": 0.0},
]


DEFAULT_HONORS = [
    {"name": "Summa Cum Laude", "min": 3.8},
    {"name": "Magna Cum Laude", "min": 3.5},
    {"name": "Cum Laude", "min": 3.2},
]


class Program(Base, TimestampMixin):
    """Carrera: agrupa los horarios de una institución con su escala, historial, pénsum y metas."""
    __tablename__ = "programs"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    institution = Column(String(120), nullable=True)
    scale = Column(JSON, nullable=False, default=lambda: [dict(x) for x in DEFAULT_GRADE_SCALE])
    pass_min = Column(Float, nullable=False, default=70.0)
    # Historial anterior a lo registrado en la app (opcional)
    prior_index = Column(Float, nullable=True)
    prior_credits = Column(Integer, nullable=True)
    prior_courses = Column(Integer, nullable=True)
    prior_passed = Column(Integer, nullable=True)
    prior_failed = Column(Integer, nullable=True)
    prior_periods = Column(Integer, nullable=True)
    # Pénsum
    total_credits = Column(Integer, nullable=True)
    total_subjects = Column(Integer, nullable=True)
    transfer_credits = Column(Integer, nullable=True)  # convalidados: avanzan el pénsum, no cuentan en el índice
    plan_periods = Column(Integer, nullable=True)  # duración del pénsum en periodos
    max_credits_per_period = Column(Integer, nullable=True)  # límite de inscripción de la institución
    goal_end_date = Column(Date, nullable=True)  # meta: terminar la carrera para esta fecha
    # Metas y requisitos de honores
    honors = Column(JSON, nullable=False, default=lambda: [dict(x) for x in DEFAULT_HONORS])
    target_index = Column(Float, nullable=True)
    probation_min = Column(Float, nullable=True, default=2.0)  # por debajo = condición de prueba
    max_periods = Column(Integer, nullable=True)
    min_institution_pct = Column(Integer, nullable=True, default=50)


class CurriculumCourse(Base, TimestampMixin):
    """Materia del pénsum de una carrera. Pre y correquisitos van por código."""
    __tablename__ = "curriculum_courses"
    __table_args__ = (UniqueConstraint("program_id", "code", name="uq_course_program_code"),)

    id = Column(String(36), primary_key=True, default=_uuid)
    program_id = Column(String(36), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    code = Column(String(30), nullable=False)
    name = Column(String(150), nullable=False)
    credits = Column(Integer, nullable=True)
    term = Column(Integer, nullable=True)  # periodo sugerido en el pénsum (1, 2, 3...)
    prereqs = Column(JSON, nullable=False, default=list)
    coreqs = Column(JSON, nullable=False, default=list)
    done = Column(Boolean, nullable=False, default=False)  # aprobada fuera de la app (antes o convalidada)
    position = Column(Integer, nullable=False, default=0)
