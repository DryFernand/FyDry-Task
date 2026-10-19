"""Self-check de seguridad de auth. Ejecutar desde backend/: python tests/check_auth_security.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_db = os.path.join(tempfile.mkdtemp(), "check.db")
os.environ["DATABASE_URL"] = os.environ.get("CHECK_DATABASE_URL") or f"sqlite:///{_db}"
os.environ["DATABASE_POOLER_URL"] = ""

import aiosmtplib  # noqa: E402


async def _no_send(*args, **kwargs):
    return None


aiosmtplib.send = _no_send

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.models import OtpCode  # noqa: E402

API = "/api/v1/auth"


def latest_code(email, code_type):
    db = SessionLocal()
    try:
        return (
            db.query(OtpCode)
            .filter(OtpCode.email == email, OtpCode.code_type == code_type, OtpCode.is_used == False)
            .order_by(OtpCode.created_at.desc())
            .first()
            .code
        )
    finally:
        db.close()


def wrong(code):
    return "000000" if code != "000000" else "111111"


with TestClient(app) as c:
    email, pwd = "ana@example.com", "Secreta123!"
    assert c.post(f"{API}/register", json={"email": email, "password": pwd, "full_name": "Ana"}).status_code == 201

    # 1. Sin verificar no se puede iniciar sesión
    r = c.post(f"{API}/login", json={"email": email, "password": pwd})
    assert r.status_code == 403, r.text

    # 2. Un código de reset no sirve para activar la cuenta / obtener JWT
    c.post(f"{API}/resend-otp", json={"email": email, "code_type": "password_reset"})
    reset_code = latest_code(email, "password_reset")
    r = c.post(f"{API}/verify-email-otp", json={"email": email, "code": reset_code, "code_type": "password_reset"})
    assert r.status_code == 400, r.text

    # 3. Fuerza bruta: tras 5 fallos el código queda invalidado aunque luego llegue el correcto
    code = latest_code(email, "register_verification")
    for _ in range(5):
        assert c.post(f"{API}/verify-email-otp", json={"email": email, "code": wrong(code)}).status_code == 400
    assert c.post(f"{API}/verify-email-otp", json={"email": email, "code": code}).status_code == 400

    # 4. Con un código nuevo correcto se verifica y entra
    c.post(f"{API}/resend-otp", json={"email": email})
    code = latest_code(email, "register_verification")
    r = c.post(f"{API}/verify-email-otp", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    old_token = r.json()["access_token"]
    assert c.get(f"{API}/me", headers={"Authorization": f"Bearer {old_token}"}).status_code == 200
    assert c.post(f"{API}/login", json={"email": email, "password": pwd}).status_code == 200

    # 5. Reenviar a correo inexistente no revela nada
    assert c.post(f"{API}/resend-otp", json={"email": "nadie@example.com"}).status_code == 200

    # 6. Restablecer contraseña revoca tokens anteriores
    import time
    time.sleep(1.1)
    c.post(f"{API}/forgot-password", json={"email": email})
    reset_code = latest_code(email, "password_reset")
    r = c.post(f"{API}/reset-password", json={"email": email, "code": reset_code, "new_password": "NuevaClave456!"})
    assert r.status_code == 200, r.text
    assert c.get(f"{API}/me", headers={"Authorization": f"Bearer {old_token}"}).status_code == 401
    r = c.post(f"{API}/login", json={"email": email, "password": "NuevaClave456!"})
    assert r.status_code == 200, r.text
    assert c.get(f"{API}/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 200

    # 7. Pre-secuestro: cuenta sin verificar vinculada luego por OAuth descarta la contraseña del atacante
    from app.api.v1.endpoints.auth import _link_oauth_user
    victim = "victima@example.com"
    c.post(f"{API}/register", json={"email": victim, "password": "Atacante123!", "full_name": "X"})
    db = SessionLocal()
    _link_oauth_user(db, {"email": victim, "email_verified": True, "full_name": "V"}, "google", "Usuario Google")
    db.close()
    assert c.post(f"{API}/login", json={"email": victim, "password": "Atacante123!"}).status_code == 401

    # 8. OAuth con correo no verificado se rechaza
    db = SessionLocal()
    try:
        _link_oauth_user(db, {"email": "z@example.com", "email_verified": False}, "github", "Usuario GitHub")
        raise AssertionError("debió rechazar correo no verificado")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 400
    finally:
        db.close()

print("OK: checks de seguridad de auth pasaron")
