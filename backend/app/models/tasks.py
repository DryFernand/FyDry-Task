import uuid
from sqlalchemy import (
    Boolean,
    Column,
    Date,
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


class TaskRecurrence(Base, TimestampMixin):
    """Regla 'cada lunes, miércoles y viernes'. Sus tareas se generan al consultar un rango."""
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


class TaskAiProfile(Base, TimestampMixin):
    __tablename__ = "task_ai_profiles"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    profile = Column(JSON, nullable=False)  # {type, title, summary, reasons[], recommendations[]}
    metrics = Column(JSON, nullable=False)
