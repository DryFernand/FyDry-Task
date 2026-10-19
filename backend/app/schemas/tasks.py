import datetime as dt
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas import CoreSchema

Priority = Literal["high", "medium", "low"]
Status = Literal["pending", "done", "partial", "not_done"]  # "postponed" solo vía /postpone
TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


# ---------- Categorías ----------
class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(default="#6e2234", pattern=COLOR_PATTERN)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=60)
    color: Optional[str] = Field(default=None, pattern=COLOR_PATTERN)


class CategoryOut(CoreSchema):
    id: str
    name: str
    color: str
    is_default: bool
    position: int


# ---------- Tareas ----------
class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category_id: Optional[str] = None
    priority: Priority = "medium"
    date: Optional[dt.date] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category_id: Optional[str] = None
    priority: Optional[Priority] = None
    date: Optional[dt.date] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
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


class NotificationPrefsOut(CoreSchema):
    timezone: str
    task_reminders: bool
    reminder_minutes: int
    day_close: bool
    day_close_time: str
    weekly_plan: bool
    weekly_plan_time: str
    weekly_summary: bool


# ---------- Perfil IA ----------
class ProfileOut(CoreSchema):
    id: str
    period_start: dt.date
    period_end: dt.date
    profile: dict
    metrics: dict
    created_at: dt.datetime
