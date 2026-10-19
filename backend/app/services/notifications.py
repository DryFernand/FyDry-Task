"""Web Push y la lógica del cron que decide qué avisos tocan."""
import json
import logging
from datetime import datetime, timedelta
from typing import Callable, Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Challenge, Habit, HabitLog, TaskItem, TaskNotificationPrefs, TaskPushSubscription
from app.services import habits as hs

logger = logging.getLogger("fydry_task_push")

# Firma: (subscription, payload) -> True si se entregó, False si la suscripción ya no existe (borrar)
Sender = Callable[[TaskPushSubscription, Dict], bool]


def webpush_sender(sub: TaskPushSubscription, payload: Dict) -> bool:
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=3600,
        )
        return True
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            return False
        logger.warning("Push falló (%s): %s", status, exc)
        return True


def push_enabled() -> bool:
    return bool(settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY)


def send_to_user(db: Session, user_id: str, payload: Dict, sender: Sender) -> int:
    subs = db.query(TaskPushSubscription).filter(TaskPushSubscription.user_id == user_id).all()
    delivered = 0
    for s in subs:
        if sender(s, payload):
            delivered += 1
        else:
            db.delete(s)
    db.commit()
    return delivered


def _tz(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("America/Santo_Domingo")


def _at(day, hhmm: str, tz: ZoneInfo) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime(day.year, day.month, day.day, h, m, tzinfo=tz)


def run_due(db: Session, sender: Sender, now_utc: Optional[datetime] = None) -> Dict[str, int]:
    """Envía los avisos vencidos. Idempotente: cada aviso se marca al enviarse."""
    now_utc = now_utc or datetime.now(ZoneInfo("UTC"))
    sent = {"reminders": 0, "habit_reminders": 0, "challenge_reminders": 0, "habit_results": 0, "day_close": 0, "weekly_plan": 0, "weekly_summary": 0}
    user_ids = {u for (u,) in db.query(TaskPushSubscription.user_id).distinct().all()}

    for uid in user_ids:
        prefs = get_prefs(db, uid)
        tz = _tz(prefs.timezone)
        now = now_utc.astimezone(tz)
        today = now.date()

        # 1. Recordatorio de tareas con hora (ventana: desde N min antes hasta 1 h después)
        if prefs.task_reminders:
            items = (
                db.query(TaskItem)
                .filter(TaskItem.user_id == uid, TaskItem.date == today, TaskItem.time.isnot(None))
                .filter(TaskItem.status == "pending", TaskItem.is_deleted.is_(False), TaskItem.reminder_sent_at.is_(None))
                .all()
            )
            for it in items:
                at = _at(today, it.time, tz)
                if at - timedelta(minutes=prefs.reminder_minutes) <= now <= at + timedelta(hours=1):
                    it.reminder_sent_at = now_utc.replace(tzinfo=None)
                    send_to_user(db, uid, {"title": f"⏰ {it.time} · {it.title}", "body": "Tienes una tarea en tu día.", "url": "/dashboard?tab=today", "tag": f"task-{it.id}"}, sender)
                    sent["reminders"] += 1

        def due(hhmm: str) -> bool:
            at = _at(today, hhmm, tz)
            return at - timedelta(minutes=prefs.reminder_minutes) <= now <= at + timedelta(hours=1)

        habits = db.query(Habit).filter(Habit.user_id == uid, Habit.status == "active").all()
        today_habits = [h for h in habits if hs.scheduled_dates(h, today, today)]
        logged = {hid for (hid,) in db.query(HabitLog.habit_id).filter(HabitLog.user_id == uid, HabitLog.date == today).all()}

        # 1b. Recordatorio de hábitos y retos con hora
        if prefs.task_reminders:
            for h in today_habits:
                if h.time and h.id not in logged and h.last_reminder_on != today and due(h.time):
                    h.last_reminder_on = today
                    send_to_user(db, uid, {"title": f"🔁 {h.time} · {h.title}", "body": "Es hora de tu hábito.", "url": "/dashboard?tab=today", "tag": f"habit-{h.id}"}, sender)
                    sent["habit_reminders"] += 1
            for c in db.query(Challenge).filter(Challenge.user_id == uid, Challenge.date == today, Challenge.time.isnot(None), Challenge.status == "pending", Challenge.reminder_sent_at.is_(None)).all():
                if due(c.time):
                    c.reminder_sent_at = now_utc.replace(tzinfo=None)
                    send_to_user(db, uid, {"title": f"🏁 {c.time} · Reto: {c.title}", "body": "¡A por tu reto de hoy!", "url": "/dashboard?tab=today", "tag": f"challenge-{c.id}"}, sender)
                    sent["challenge_reminders"] += 1

        # 1c. Resultado de la evaluación de hábitos en construcción
        hs.evaluate(db, uid, today)
        for h in db.query(Habit).filter(Habit.user_id == uid, Habit.evaluated_on.isnot(None), Habit.result_notified.is_(False)).all():
            h.result_notified = True
            if h.status == "needs_adjust":
                payload = {"title": f"💪 “{h.title}” aún no es hábito", "body": f"Cumpliste {round((h.last_rate or 0) * 100)}% (meta {round(h.target_rate * 100)}%). Reajusta el tiempo de adaptación.", "url": "/dashboard?tab=habits", "tag": f"habit-eval-{h.id}"}
            else:
                payload = {"title": f"🎉 “{h.title}” ya es un hábito", "body": f"Lo cumpliste {round((h.last_rate or 0) * 100)}% de las veces. ¡Lo lograste!", "url": "/dashboard?tab=habits", "tag": f"habit-eval-{h.id}"}
            send_to_user(db, uid, payload, sender)
            sent["habit_results"] += 1

        # 2. Cierre del día (solo si hoy había tareas, hábitos o retos)
        if prefs.day_close and prefs.last_day_close_sent != today and now >= _at(today, prefs.day_close_time, tz):
            has_tasks = (
                db.query(TaskItem.id).filter(TaskItem.user_id == uid, TaskItem.date == today, TaskItem.is_deleted.is_(False)).first()
                or today_habits
                or db.query(Challenge.id).filter(Challenge.user_id == uid, Challenge.date == today).first()
            )
            prefs.last_day_close_sent = today
            if has_tasks:
                send_to_user(db, uid, {"title": "🌙 ¿Cómo te fue hoy?", "body": "Haz el cierre del día: marca lo que hiciste y lo que pasa a mañana.", "url": "/dashboard?tab=today&close=1", "tag": "day-close"}, sender)
                sent["day_close"] += 1

        # 3. Planificar la semana (domingo)
        if prefs.weekly_plan and today.weekday() == 6 and prefs.last_weekly_plan_sent != today and now >= _at(today, prefs.weekly_plan_time, tz):
            prefs.last_weekly_plan_sent = today
            send_to_user(db, uid, {"title": "🗓️ Planifica tu semana", "body": "Toma 5 minutos para organizar los próximos 7 días.", "url": "/dashboard?tab=week", "tag": "weekly-plan"}, sender)
            sent["weekly_plan"] += 1

        # 4. Resumen semanal listo (lunes 08:00)
        if prefs.weekly_summary and today.weekday() == 0 and prefs.last_weekly_summary_sent != today and now >= _at(today, "08:00", tz):
            prefs.last_weekly_summary_sent = today
            send_to_user(db, uid, {"title": "📊 Tu resumen semanal está listo", "body": "Mira cómo te fue la semana pasada y tu perfil.", "url": "/dashboard?tab=analytics", "tag": "weekly-summary"}, sender)
            sent["weekly_summary"] += 1

        db.commit()
    return sent


def _apply_defaults(p: TaskNotificationPrefs) -> None:
    """Valores por defecto para filas nuevas aún no guardadas (los defaults de Column aplican al insertar)."""
    defaults = {
        "timezone": "America/Santo_Domingo", "task_reminders": True, "reminder_minutes": 10,
        "day_close": True, "day_close_time": "21:00", "weekly_plan": True,
        "weekly_plan_time": "18:00", "weekly_summary": True,
    }
    for k, v in defaults.items():
        if getattr(p, k) is None:
            setattr(p, k, v)


def get_prefs(db: Session, user_id: str) -> TaskNotificationPrefs:
    p = db.get(TaskNotificationPrefs, user_id)
    if not p:
        p = TaskNotificationPrefs(user_id=user_id)
        _apply_defaults(p)
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


def subscriptions(db: Session, user_id: str) -> List[TaskPushSubscription]:
    return db.query(TaskPushSubscription).filter(TaskPushSubscription.user_id == user_id).all()
