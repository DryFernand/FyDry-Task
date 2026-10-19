# FyDry Task — Organiza tus tareas, tranquiliza tu mente

Gestor de tareas de la familia FyDry. Misma paleta (vino `#6e2234` + zinc), tipografía (Figtree + Fraunces) y organización que FyDry.

## Cuenta única FyDry

Las cuentas viven **solo en FyDry**. FyDry Task no guarda usuarios ni contraseñas.

```
Frontend Task ──login/registro/OTP/OAuth──► API FyDry ──► BD FyDry (usuarios)
      │                                        ▲
      └──tareas (Bearer token)──► API Task ────┘ valida token (/auth/me, caché 5 min)
                                     └──► BD Task (solo tareas, por user_id)
```

- Mismo correo y contraseña en FyDry y FyDry Task; el correo se verifica una sola vez.
- `JWT_SECRET_KEY` del backend de Task **debe ser igual** a la de FyDry.
- En FyDry hay que permitir el origen de Task en `CORS_ORIGINS`.
- Google/GitHub: registrar `https://<dominio-task>/auth/callback/google` (y `/github`) en las apps OAuth de FyDry.

## Estado actual

- Landing, registro, login, recuperación de contraseña y OAuth (vía API de FyDry).
- Panel (`/dashboard`): pantalla de inicio vacía. Módulos de tareas por definir.

## Desarrollo local

Puertos: FyDry API `8000`, Task API `8001`, Task web `3001`.

### Backend FyDry (en el repo FyDry, puerto 8000)
Su `CORS_ORIGINS` debe incluir `http://localhost:3001`.

### Backend Task (http://localhost:8001)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
Self-check: `python tests/check_fydry_auth.py`

### Frontend Task (http://localhost:3001)
```bash
cd frontend
npm install
npm run dev
```
Variables: `frontend/.env.local.example` y `backend/.env.example`.
