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
| **Hábitos** | "Construir uno nuevo" con periodo de adaptación y meta (80% editable): al terminar pasa a hábito o pide reajuste (extender / reiniciar). "Ya lo tengo" como recordatorio. Se marcan Hecho / No hecho. |
| **Retos** | Metas de un día con resultado Logrado / Parcial / No logrado y nota obligatoria. |
| **Análisis** | Pantalla previa para elegir: General, Tareas, Hábitos, Retos, Clases o Notas. Cumplimiento (Hecho 1, A medias 0.5, No hecho/Pospuesta 0), planificado vs hecho, racha (meta 70%), por día, categoría, semana, franja horaria y energía; lo más pospuesto; resumen en texto. |
| **Perfil IA** | Tipo de planificador, por qué (con tus números), fortalezas y recomendaciones. Requiere 2 semanas de datos. La IA recibe solo métricas agregadas. |
| **Horario** | Varios horarios por periodo (bimestral, trimestral, cuatrimestral, semestral, anual, verano, personalizado) con fin calculado; materias con profesor, aula/enlace, créditos y clases semanales; grilla semanal con choques; duplicar para el siguiente periodo. Asistencia (Asistí / No asistí) en Mi día, Semana y el cierre del día. |
| **Notas** | Nota final (0–100) por materia; letra, puntos y Aprobada/Reprobada salen de la escala (A 90 · B 80 · C 70 · D 60 · F 0, se aprueba con 70; editable). Índice = Σ(puntos × créditos) / Σ créditos, por periodo y acumulado; reprobadas y repetidas cuentan. Historial: registrar periodos anteriores como horarios pasados o un resumen manual (índice, créditos, materias). |
| **Carrera** | Agrupa los horarios de una institución; cada una tiene su escala, historial y pénsum (créditos, materias, convalidados). Calcula lo que falta (créditos, materias, periodos a tu ritmo) y, por meta (honores editables, 3.8 / 3.5 / 3.2 por defecto, e índice deseado), el índice necesario en lo que falta = (meta·(C+R) − puntos-crédito) / R, el margen en créditos con B o C y una probabilidad estimada. Ritmo: créditos por periodo frente a la duración del pénsum y al límite de créditos de la institución (adelantado/atrasado, fecha estimada y lo más rápido posible). Meta de tiempo: "terminar para" una fecha → periodos que caben, créditos y materias por periodo y si es posible, exigente o no cabe. Requisitos de honores: sin reprobadas (aunque se repitan), sin condición de prueba, dentro de la permanencia máxima y % mínimo del pénsum cursado en la institución. |
| **Asignaciones** | En categorías 🎓 académicas ("Estudio" por defecto) la tarea tiene Materia y Tipo (Tarea, Examen, Proyecto, Exposición, Lectura); su día es la fecha de entrega. |
| **Configuración** | Categorías (5 base + propias con color, marca 🎓 académica) y notificaciones. |
| **Push** | Recordatorio de tareas, hábitos, retos y clases con hora, entregas y exámenes de mañana (18:00), resultado de los hábitos en construcción, cierre del día, planificar la semana (domingo) y resumen listo (lunes 8:00). En iPhone requiere "Agregar a inicio". |

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

Self-checks: `python tests/check_fydry_auth.py`, `check_tasks.py`, `check_classes.py`, `check_grades.py` y `check_migration.py`. Siempre usan SQLite local: un `DATABASE_URL` de SQLite gana sobre el `DATABASE_POOLER_URL` del `.env`.

### Frontend Task (http://localhost:3001)
```bash
cd frontend
npm install
npm run dev
```
Variables: `frontend/.env.local.example` y `backend/.env.example`.

### Logo
Fuente única: `frontend/public/logo_task.svg`. Si cambia, regenerar favicon, íconos de app e imagen OG con `node scripts/render-logo.mjs` (desde `frontend/`).
