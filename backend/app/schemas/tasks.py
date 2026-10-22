import datetime as dt
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas import CoreSchema

Priority = Literal["high", "medium", "low"]
Status = Literal["pending", "done", "partial", "not_done"]  # "postponed" solo vía /postpone
AssignmentType = Literal["tarea", "examen", "proyecto", "exposicion", "lectura"]
TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


# ---------- Categorías ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default="#6e2234", pattern=COLOR_PATTERN)
    is_academic: bool = False


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    color: Optional[str] = Field(default=None, pattern=COLOR_PATTERN)
    is_academic: Optional[bool] = None


class CategoryOut(CoreSchema):
    id: str
    name: str
    color: str
    is_default: bool
    position: int
    is_academic: bool


# ---------- Tareas ----------
class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category_id: Optional[str] = None
    priority: Priority = "medium"
    date: Optional[dt.date] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    subject_id: Optional[str] = None
    assignment_type: Optional[AssignmentType] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category_id: Optional[str] = None
    priority: Optional[Priority] = None
    date: Optional[dt.date] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    subject_id: Optional[str] = None
    assignment_type: Optional[AssignmentType] = None
    status: Optional[Status] = None


class PostponeIn(BaseModel):
    date: Optional[dt.date] = None  # None = a la bandeja "Sin fecha"


class CopyWeekIn(BaseModel):
    from_start: dt.date
    to_start: dt.date


class TaskOut(CoreSchema):
    id: str
    title: str
    category_id: Optional[str]
    priority: str
    date: Optional[dt.date]
    time: Optional[str]
    status: str
    status_at: Optional[dt.datetime]
    recurrence_id: Optional[str]
    postponed_from_id: Optional[str]
    postpone_count: int
    position: int
    subject_id: Optional[str] = None
    assignment_type: Optional[str] = None


# ---------- Hábitos ----------
def _check_days(v):
    if v is None:
        return v
    if any(d < 0 or d > 6 for d in v):
        raise ValueError("Los días van de 0 (lunes) a 6 (domingo).")
    return sorted(set(v))


class HabitIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category_id: Optional[str] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    weekdays: List[int] = Field(min_length=1)
    kind: Literal["building", "established"] = "established"
    start_date: dt.date
    period_days: Optional[int] = Field(default=None, ge=7, le=365)
    target_rate: float = Field(default=0.8, ge=0.5, le=1.0)

    _days = field_validator("weekdays")(classmethod(lambda cls, v: _check_days(v)))

    @model_validator(mode="after")
    def check_period(self):
        if self.kind == "building" and not self.period_days:
            raise ValueError("Un hábito en construcción necesita su periodo de adaptación (días).")
        if self.kind == "established":
            self.period_days = None
        return self


class HabitUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category_id: Optional[str] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    weekdays: Optional[List[int]] = Field(default=None, min_length=1)
    target_rate: Optional[float] = Field(default=None, ge=0.5, le=1.0)
    status: Optional[Literal["active", "archived"]] = None

    _days = field_validator("weekdays")(classmethod(lambda cls, v: _check_days(v)))


class HabitExtendIn(BaseModel):
    days: int = Field(ge=7, le=180)


class HabitRestartIn(BaseModel):
    start_date: dt.date
    period_days: int = Field(ge=7, le=365)


class HabitLogIn(BaseModel):
    date: dt.date
    status: Optional[Literal["done", "not_done"]] = None  # None = desmarcar


class HabitOut(CoreSchema):
    id: str
    title: str
    category_id: Optional[str]
    time: Optional[str]
    weekdays: List[int]
    kind: str
    status: str
    start_date: dt.date
    period_days: Optional[int]
    target_rate: float
    consolidated_on: Optional[dt.date]
    evaluated_on: Optional[dt.date]
    last_rate: Optional[float]
    adjustments: int
    stats: Optional[dict] = None

    @field_validator("weekdays", mode="before")
    @classmethod
    def parse_weekdays(cls, v):
        return [int(x) for x in v.split(",") if x != ""] if isinstance(v, str) else v


# ---------- Retos ----------
ChallengeResult = Literal["achieved", "partial", "failed"]


class ChallengeIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category_id: Optional[str] = None
    date: dt.date
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)


class ChallengeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category_id: Optional[str] = None
    date: Optional[dt.date] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)


class ChallengeResultIn(BaseModel):
    status: Literal["pending", "achieved", "partial", "failed"]
    note: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def note_required(self):
        if self.status != "pending" and len((self.note or "").strip()) < 3:
            raise ValueError("Cuenta cómo te fue: la nota del resultado es obligatoria.")
        return self


class ChallengeOut(CoreSchema):
    id: str
    title: str
    category_id: Optional[str]
    date: dt.date
    time: Optional[str]
    status: str
    result_note: Optional[str]
    status_at: Optional[dt.datetime]


# ---------- Cierre del día ----------
class ReviewIn(BaseModel):
    energy: Optional[int] = Field(default=None, ge=1, le=5)
    note: Optional[str] = Field(default=None, max_length=1000)


class ReviewOut(CoreSchema):
    date: dt.date
    energy: Optional[int]
    note: Optional[str]


# ---------- Notificaciones ----------
class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)
    keys: dict

    @field_validator("keys")
    @classmethod
    def check_keys(cls, v: dict) -> dict:
        if not v.get("p256dh") or not v.get("auth"):
            raise ValueError("Suscripción push incompleta.")
        return v


class PushUnsubscribeIn(BaseModel):
    endpoint: str


class NotificationPrefsIn(BaseModel):
    timezone: Optional[str] = Field(default=None, max_length=64)
    task_reminders: Optional[bool] = None
    reminder_minutes: Optional[int] = Field(default=None, ge=0, le=180)
    day_close: Optional[bool] = None
    day_close_time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    weekly_plan: Optional[bool] = None
    weekly_plan_time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    weekly_summary: Optional[bool] = None
    class_reminders: Optional[bool] = None
    deadline_reminders: Optional[bool] = None


class NotificationPrefsOut(CoreSchema):
    timezone: str
    task_reminders: bool
    reminder_minutes: int
    day_close: bool
    day_close_time: str
    weekly_plan: bool
    weekly_plan_time: str
    weekly_summary: bool
    class_reminders: bool
    deadline_reminders: bool


# ---------- Perfil IA ----------
class ProfileOut(CoreSchema):
    id: str
    period_start: dt.date
    period_end: dt.date
    profile: dict
    metrics: dict
    created_at: dt.datetime


# ---------- Horario de clases ----------
PeriodType = Literal["bimestral", "trimestral", "cuatrimestral", "semestral", "anual", "verano", "personalizado"]
ProgramPeriodType = Literal["bimestral", "trimestral", "cuatrimestral", "semestral", "anual"]


class ScheduleIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    program_id: Optional[str] = None  # None = la carrera principal
    period_type: Optional[PeriodType] = None  # None = el de la carrera
    start_date: dt.date
    end_date: Optional[dt.date] = None  # None = se calcula según el tipo

    @model_validator(mode="after")
    def check_dates(self):
        if self.end_date is None and self.period_type == "personalizado":
            raise ValueError("Un periodo personalizado necesita fecha de fin.")
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("La fecha de fin debe ser posterior al inicio.")
        return self


class ScheduleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    program_id: Optional[str] = None
    period_type: Optional[PeriodType] = None
    start_date: Optional[dt.date] = None
    end_date: Optional[dt.date] = None
    is_archived: Optional[bool] = None


class ScheduleDuplicateIn(ScheduleIn):
    pass


class SessionIn(BaseModel):
    id: Optional[str] = None  # con id = se actualiza (conserva su asistencia)
    weekday: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=TIME_PATTERN)
    end_time: str = Field(pattern=TIME_PATTERN)
    location: Optional[str] = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("La clase debe terminar después de empezar.")
        return self


class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: Optional[str] = Field(default=None, max_length=30)
    teacher: Optional[str] = Field(default=None, max_length=120)
    color: str = Field(default="#6e2234", pattern=COLOR_PATTERN)
    credits: Optional[int] = Field(default=None, ge=0, le=60)
    modality: Literal["presencial", "virtual", "mixta"] = "presencial"
    location: Optional[str] = Field(default=None, max_length=120)
    link: Optional[str] = Field(default=None, max_length=500)
    course_id: Optional[str] = None  # materia del pénsum que cursa
    sessions: List[SessionIn] = Field(default_factory=list, max_length=21)


class SessionOut(CoreSchema):
    id: str
    weekday: int
    start_time: str
    end_time: str
    location: Optional[str]
    conflicts: List[str] = []


class SubjectOut(CoreSchema):
    id: str
    schedule_id: str
    name: str
    code: Optional[str]
    teacher: Optional[str]
    color: str
    credits: Optional[int]
    modality: str
    location: Optional[str]
    link: Optional[str]
    sessions: List[SessionOut] = []
    weekly_minutes: int = 0
    assignments: dict = {}
    final_grade: Optional[float] = None
    course_id: Optional[str] = None
    letter: Optional[str] = None
    passed: Optional[bool] = None


class ScheduleOut(CoreSchema):
    id: str
    name: str
    program_id: Optional[str]
    period_type: str
    start_date: dt.date
    end_date: dt.date
    is_archived: bool
    subjects: List[SubjectOut] = []
    weekly_minutes: int = 0
    credits: int = 0
    grades: dict = {}  # resumen de notas del periodo: índice, promedio, cuántas con nota


class AttendanceIn(BaseModel):
    date: dt.date
    status: Optional[Literal["attended", "absent"]] = None  # None = desmarcar


# ---------- Notas ----------
class GradeIn(BaseModel):
    grade: Optional[float] = Field(default=None, ge=0, le=100)  # None = quitar la nota


class GradeBand(BaseModel):
    letter: str = Field(min_length=1, max_length=3)
    min: float = Field(ge=0, le=100)
    points: float = Field(ge=0, le=5)


class HonorLevel(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    min: float = Field(ge=0, le=5)


class ProgramIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    institution: Optional[str] = Field(default=None, max_length=120)
    scale: Optional[List[GradeBand]] = Field(default=None, min_length=2, max_length=12)
    pass_min: Optional[float] = Field(default=None, ge=0, le=100)
    prior_index: Optional[float] = Field(default=None, ge=0, le=5)
    prior_credits: Optional[int] = Field(default=None, ge=0, le=1000)
    prior_courses: Optional[int] = Field(default=None, ge=0, le=500)
    prior_passed: Optional[int] = Field(default=None, ge=0, le=500)
    prior_failed: Optional[int] = Field(default=None, ge=0, le=500)
    prior_periods: Optional[int] = Field(default=None, ge=0, le=60)
    total_credits: Optional[int] = Field(default=None, ge=1, le=1000)
    total_subjects: Optional[int] = Field(default=None, ge=1, le=500)
    transfer_credits: Optional[int] = Field(default=None, ge=0, le=1000)
    period_type: Optional[ProgramPeriodType] = None
    plan_periods: Optional[int] = Field(default=None, ge=1, le=60)
    max_credits_per_period: Optional[int] = Field(default=None, ge=1, le=100)
    goal_end_date: Optional[dt.date] = None
    honors: Optional[List[HonorLevel]] = Field(default=None, max_length=8)
    target_index: Optional[float] = Field(default=None, ge=0, le=5)
    probation_min: Optional[float] = Field(default=None, ge=0, le=5)
    max_periods: Optional[int] = Field(default=None, ge=1, le=60)
    min_institution_pct: Optional[int] = Field(default=None, ge=0, le=100)

    @field_validator("scale")
    @classmethod
    def check_scale(cls, v):
        if v is None:
            return v
        letters = [b.letter.strip().upper() for b in v]
        if len(set(letters)) != len(letters):
            raise ValueError("Cada letra de la escala debe ser única.")
        if not any(b.min == 0 for b in v):
            raise ValueError("La escala necesita un tramo que empiece en 0.")
        mins = [b.min for b in v]
        if len(set(mins)) != len(mins):
            raise ValueError("Dos tramos no pueden empezar en la misma nota.")
        return sorted([GradeBand(letter=b.letter.strip().upper(), min=b.min, points=b.points) for b in v], key=lambda b: -b.min)

    @field_validator("honors")
    @classmethod
    def check_honors(cls, v):
        return sorted([HonorLevel(name=h.name.strip(), min=h.min) for h in v], key=lambda h: -h.min) if v is not None else v

    @model_validator(mode="after")
    def check_prior(self):
        if self.prior_courses is not None and (self.prior_passed or 0) + (self.prior_failed or 0) > self.prior_courses:
            raise ValueError("Aprobadas + reprobadas no puede ser mayor que las materias cursadas.")
        if self.prior_index is not None and not self.prior_credits:
            raise ValueError("Para usar tu índice anterior indica también los créditos cursados.")
        if self.total_credits and self.transfer_credits and self.transfer_credits > self.total_credits:
            raise ValueError("Los créditos convalidados no pueden superar los del pénsum.")
        return self


class ProgramOut(CoreSchema):
    id: str
    name: str
    institution: Optional[str]
    scale: List[dict]
    pass_min: float
    prior_index: Optional[float]
    prior_credits: Optional[int]
    prior_courses: Optional[int]
    prior_passed: Optional[int]
    prior_failed: Optional[int]
    prior_periods: Optional[int]
    total_credits: Optional[int]
    total_subjects: Optional[int]
    transfer_credits: Optional[int]
    period_type: str
    plan_periods: Optional[int]
    max_credits_per_period: Optional[int]
    goal_end_date: Optional[dt.date]
    honors: List[dict]
    target_index: Optional[float]
    probation_min: Optional[float]
    max_periods: Optional[int]
    min_institution_pct: Optional[int]


class CourseIn(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name: str = Field(min_length=1, max_length=150)
    credits: Optional[int] = Field(default=None, ge=0, le=60)
    term: Optional[int] = Field(default=None, ge=1, le=60)
    prereqs: List[str] = Field(default_factory=list, max_length=20)
    coreqs: List[str] = Field(default_factory=list, max_length=20)
    done: bool = False


class CoursesIn(BaseModel):
    courses: List[CourseIn] = Field(max_length=300)
