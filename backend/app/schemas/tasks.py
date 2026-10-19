import datetime as dt
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

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


# ---------- Recurrencias ----------
class RecurrenceIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category_id: Optional[str] = None
    priority: Priority = "medium"
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    weekdays: List[int] = Field(min_length=1)
    start_date: dt.date
    end_date: Optional[dt.date] = None

    @field_validator("weekdays")
    @classmethod
    def check_weekdays(cls, v: List[int]) -> List[int]:
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Los días van de 0 (lunes) a 6 (domingo).")
        return sorted(set(v))


class RecurrenceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category_id: Optional[str] = None
    priority: Optional[Priority] = None
    time: Optional[str] = Field(default=None, pattern=TIME_PATTERN)
    weekdays: Optional[List[int]] = Field(default=None, min_length=1)
    end_date: Optional[dt.date] = None

    @field_validator("weekdays")
    @classmethod
    def check_weekdays(cls, v: Optional[List[int]]) -> Optional[List[int]]:
        if v is not None and any(d < 0 or d > 6 for d in v):
            raise ValueError("Los días van de 0 (lunes) a 6 (domingo).")
        return sorted(set(v)) if v is not None else v


class RecurrenceOut(CoreSchema):
    id: str
    title: str
    category_id: Optional[str]
    priority: str
    time: Optional[str]
    weekdays: List[int]
    start_date: dt.date
    end_date: Optional[dt.date]
    is_active: bool

    @field_validator("weekdays", mode="before")
    @classmethod
    def parse_weekdays(cls, v):
        return [int(x) for x in v.split(",") if x != ""] if isinstance(v, str) else v


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
