from fastapi import APIRouter
from app.api.v1.endpoints import health, me

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(me.router, tags=["Sesión (cuenta FyDry)"])
