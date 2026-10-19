from fastapi import APIRouter
from app.api.v1.endpoints import health, me, tasks, habits, schedules, insights, notifications

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(me.router, tags=["Sesión (cuenta FyDry)"])
api_router.include_router(tasks.router, tags=["Tareas, categorías y cierre del día"])
api_router.include_router(habits.router, tags=["Agenda, hábitos y retos"])
api_router.include_router(schedules.router, tags=["Horario de clases"])
api_router.include_router(insights.router, tags=["Análisis y perfil IA"])
api_router.include_router(notifications.router, tags=["Notificaciones push"])
