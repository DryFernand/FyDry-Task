import hmac
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models import TaskPushSubscription
from app.schemas.tasks import NotificationPrefsIn, NotificationPrefsOut, PushSubscriptionIn, PushUnsubscribeIn
from app.services import notifications as svc

router = APIRouter()


@router.get("/push/config", summary="Clave pública VAPID y si el push está activo")
def push_config():
    return {"enabled": svc.push_enabled(), "public_key": settings.VAPID_PUBLIC_KEY or None}


@router.post("/push/subscribe", status_code=204)
def subscribe(payload: PushSubscriptionIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = db.query(TaskPushSubscription).filter(TaskPushSubscription.endpoint == payload.endpoint).first()
    if not sub:
        sub = TaskPushSubscription(endpoint=payload.endpoint)
        db.add(sub)
    sub.user_id, sub.p256dh, sub.auth = user.id, payload.keys["p256dh"], payload.keys["auth"]
    db.commit()
    return Response(status_code=204)


@router.post("/push/unsubscribe", status_code=204)
def unsubscribe(payload: PushUnsubscribeIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(TaskPushSubscription).filter(
        TaskPushSubscription.user_id == user.id, TaskPushSubscription.endpoint == payload.endpoint
    ).delete()
    db.commit()
    return Response(status_code=204)


@router.post("/push/test", summary="Envía una notificación de prueba a tus dispositivos")
async def push_test(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not svc.push_enabled():
        raise HTTPException(status_code=503, detail="Las notificaciones push no están configuradas en el servidor.")
    payload = {"title": "🔔 FyDry Task", "body": "¡Listo! Así te llegarán tus avisos.", "url": "/dashboard"}
    delivered = await run_in_threadpool(svc.send_to_user, db, user.id, payload, svc.webpush_sender)
    if not delivered:
        raise HTTPException(status_code=404, detail="No hay dispositivos suscritos. Activa las notificaciones primero.")
    return {"delivered": delivered}


@router.get("/notifications/prefs", response_model=NotificationPrefsOut)
def get_prefs(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get_prefs(db, user.id)


@router.put("/notifications/prefs", response_model=NotificationPrefsOut)
def update_prefs(payload: NotificationPrefsIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = svc.get_prefs(db, user.id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(prefs, k, v)
    db.commit()
    db.refresh(prefs)
    return prefs


@router.get("/cron/notifications", summary="Lo llama el cron cada 5 min; envía los avisos vencidos")
async def cron_notifications(
    authorization: Optional[str] = Header(default=None),
    key: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    provided = (authorization or "").removeprefix("Bearer ").strip() or (key or "")
    if not settings.CRON_SECRET or not hmac.compare_digest(provided, settings.CRON_SECRET):
        raise HTTPException(status_code=401, detail="No autorizado.")
    if not svc.push_enabled():
        return {"skipped": "push no configurado"}
    return await run_in_threadpool(svc.run_due, db, svc.webpush_sender)
