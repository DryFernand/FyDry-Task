"""Autenticación delegada: las cuentas viven en FyDry; aquí solo se valida su token."""
import time
from typing import Dict, Optional, Tuple

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# token -> (expira_en, usuario). Evita llamar a FyDry en cada petición.
_cache: Dict[str, Tuple[float, "CurrentUser"]] = {}


class CurrentUser(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales de acceso.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def fetch_fydry_user(token: str) -> Optional[dict]:
    """Pregunta a FyDry por el dueño del token. None si FyDry lo rechaza (401/403).
    Lanza httpx.HTTPError si FyDry no responde."""
    res = httpx.get(
        f"{settings.FYDRY_API_URL}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=5.0,
    )
    if res.status_code in (401, 403):
        return None
    res.raise_for_status()
    return res.json()


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> CurrentUser:
    if not token:
        raise _unauthorized()

    # 1. Firma y expiración con la misma clave que FyDry: descarta tokens falsos sin red.
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise _unauthorized()
    if not payload.get("sub"):
        raise _unauthorized()

    now = time.time()
    cached = _cache.get(token)
    if cached and cached[0] > now:
        return cached[1]

    # 2. FyDry confirma que la cuenta sigue activa y que el token no fue revocado
    #    (cambio de contraseña). Resultado en caché unos minutos.
    try:
        data = await run_in_threadpool(fetch_fydry_user, token)
    except httpx.HTTPError:
        if cached:  # FyDry caído: se tolera una sesión ya validada antes
            return cached[1]
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="El servicio de cuentas FyDry no está disponible.")
    if data is None or str(data.get("id")) != str(payload["sub"]):
        _cache.pop(token, None)
        raise _unauthorized()

    user = CurrentUser(**{k: data.get(k) for k in CurrentUser.model_fields})
    if len(_cache) > 5000:  # ponytail: caché en memoria por instancia; usar Redis si hay muchas instancias
        _cache.clear()
    _cache[token] = (now + settings.AUTH_CACHE_SECONDS, user)
    return user
