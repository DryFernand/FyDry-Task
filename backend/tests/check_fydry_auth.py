"""Self-check del login delegado a FyDry. Ejecutar desde backend/: python tests/check_fydry_auth.py"""
import os
import sys
import tempfile
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'check.db')}"
os.environ["DATABASE_POOLER_URL"] = ""

import httpx  # noqa: E402
import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.api import deps  # noqa: E402

USER = {"id": "u-1", "email": "ana@example.com", "full_name": "Ana Pérez", "avatar_url": None}
fydry = {"mode": "ok", "calls": 0}


def fake_fetch(token):
    fydry["calls"] += 1
    if fydry["mode"] == "down":
        raise httpx.ConnectError("FyDry caído")
    return None if fydry["mode"] == "revoked" else USER


deps.fetch_fydry_user = fake_fetch
client = TestClient(app)


def token(sub="u-1", secret=None, minutes=60):
    now = datetime.utcnow()
    return jwt.encode({"sub": sub, "iat": now, "exp": now + timedelta(minutes=minutes)},
                      secret or settings.JWT_SECRET_KEY, algorithm="HS256")


def me(tok):
    return client.get("/api/v1/me", headers={"Authorization": f"Bearer {tok}"} if tok else {})


assert me(None).status_code == 401
assert me(token(secret="otra-clave")).status_code == 401, "firma ajena debe fallar"
assert me(token(minutes=-1)).status_code == 401, "token expirado debe fallar"
assert fydry["calls"] == 0, "tokens inválidos no deben llegar a FyDry"

t = token()
r = me(t)
assert r.status_code == 200 and r.json()["email"] == USER["email"], r.text
me(t)
assert fydry["calls"] == 1, "la segunda petición debe salir de la caché"

fydry["mode"] = "down"
assert me(token(sub="u-1", minutes=59)).status_code == 503, "FyDry caído sin caché -> 503"

deps._cache.clear()
fydry["mode"] = "revoked"
assert me(t).status_code == 401, "token revocado en FyDry debe fallar"

fydry["mode"] = "ok"
assert me(token(sub="otro-id")).status_code == 401, "id del token debe coincidir con FyDry"

print("OK: checks del login con cuentas FyDry pasaron")
