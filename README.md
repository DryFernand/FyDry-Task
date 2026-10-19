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

## Funcionalidades

| Sección | Qué hace |
|---|---|
| **Mi día** | Checklist de hoy con 4 estados: ✅ Hecho · 🟡 A medias · ❌ No hecho · ➡️ Pospuesta (mañana, en una semana, otro día o sin fecha). Captura rápida, progreso del día, aviso de días anteriores sin marcar y bandeja "Sin fecha". |
| **Cierre del día** | Repaso de lo pendiente (nada se mueve solo), energía 1–5 y nota. |
| **Semana** | 7 columnas, arrastrar tareas entre días o a "Sin fecha", copiar la semana anterior, % por día. |
| **Recurrentes** | "Gimnasio L/M/V 07:00": se generan solas al ver la semana; editar la regla cambia solo las próximas pendientes. |
| **Análisis** | Cumplimiento (Hecho 1, A medias 0.5, No hecho/Pospuesta 0), planificado vs hecho, racha (meta 70%), por día, categoría, semana, franja horaria y energía; lo más pospuesto; resumen en texto. |
| **Perfil IA** | Tipo de planificador, por qué (con tus números), fortalezas y recomendaciones. Requiere 2 semanas de datos. La IA recibe solo métricas agregadas. |
| **Configuración** | Categorías (5 base + propias con color), recurrentes y notificaciones. |
| **Push** | Recordatorio de tareas con hora, cierre del día, planificar la semana (domingo) y resumen listo (lunes 8:00). En iPhone requiere "Agregar a inicio". |

Hora de las tareas: opcional. Fechas siempre en la hora local del usuario.

## Notificaciones push (producción)

1. `python -m app.scripts.vapid` → poner `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en el backend de Task.
2. Definir `CRON_SECRET` y llamar cada 5 minutos a `GET /api/v1/cron/notifications` con `Authorization: Bearer <CRON_SECRET>`.
   - Vercel **Pro**: agregar en `backend/vercel.json` → `"crons": [{"path": "/api/v1/cron/notifications", "schedule": "*/5 * * * *"}]` (Vercel envía el header solo).
   - Vercel **Hobby** solo permite crons diarios: usar un cron externo (p. ej. cron-job.org) con el header.
3. El usuario activa los avisos en Configuración → Notificaciones.

## Perfil con IA

`AI_API_KEY` (y opcional `AI_BASE_URL`, `AI_MODEL`) en el backend de Task; cualquier proveedor compatible con OpenAI. Sin clave, la sección muestra un aviso.

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
Migraciones (PostgreSQL): `alembic upgrade head`. En local con SQLite las tablas se crean solas.

Self-checks: `python tests/check_fydry_auth.py` y `python tests/check_tasks.py`

### Frontend Task (http://localhost:3001)
```bash
cd frontend
npm install
npm run dev
```
Variables: `frontend/.env.local.example` y `backend/.env.example`.
