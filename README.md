# FyDry Task — Organiza tus tareas, tranquiliza tu mente

Gestor de tareas de la familia FyDry. Misma paleta (vino `#6e2234` + zinc), tipografía (Figtree + Fraunces) y organización que FyDry.

## Estado actual

- Landing, registro con OTP por correo, login con bloqueo escalonado, recuperación de contraseña, OAuth Google/GitHub.
- Panel (`/dashboard`): solo pantalla de inicio vacía. Módulos de tareas por definir.

## Tecnologías

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, `motion/react`, Lucide.
- **Backend**: FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL (Supabase) / SQLite en desarrollo.

## Desarrollo local

Puertos distintos a FyDry (3000/8000) para correr ambos a la vez.

### Backend (http://localhost:8001)
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
Sin SMTP configurado, los códigos OTP se imprimen en la consola del backend.

### Frontend (http://localhost:3001)
```bash
cd frontend
npm install
npm run dev
```
Variables: ver `frontend/.env.local.example` y `backend/.env.example`.
