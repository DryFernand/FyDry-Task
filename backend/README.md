# FyDry Backend (FastAPI + Supabase PostgreSQL + Alembic)

Backend estructurado con FastAPI, SQLAlchemy 2.0 y Alembic para la gestión de migraciones sobre Supabase.

---

## 🛠️ Requisitos Previos

- Python 3.10+
- Acceso al proyecto de Supabase (Database credentials & API keys)

---

## 🚀 Instalación y Puesta en Marcha

### 1. Crear y activar entorno virtual

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Edita el archivo `.env` en la raíz de `backend/` con las credenciales de tu proyecto de Supabase:

```env
DATABASE_URL="postgresql+psycopg2://postgres:[TU_PASSWORD]@[TU_HOST_SUPABASE]:5432/postgres"
DATABASE_POOLER_URL="postgresql+psycopg2://postgres.[PROJECT_REF]:[TU_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"

SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_ANON_KEY="[TU_ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[TU_SERVICE_ROLE_KEY]"
SUPABASE_JWT_SECRET="[TU_JWT_SECRET]"
```

### 4. Ejecutar el servidor de desarrollo

```bash
uvicorn app.main:app --reload --port 8000
```

- **Swagger UI:** [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **ReDoc:** [http://localhost:8000/api/v1/redoc](http://localhost:8000/api/v1/redoc)
- **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- **Database Connection Check:** [http://localhost:8000/api/v1/health/db](http://localhost:8000/api/v1/health/db)

---

## 🗄️ Migraciones con Alembic

El servidor ya no crea tablas al arrancar en PostgreSQL (solo en SQLite local). El esquema se gestiona solo con Alembic.

### Primera vez sobre una base existente (creada antes con `create_all`)
Haz un backup en Supabase y luego:
```bash
alembic stamp 0001_baseline
alembic upgrade head
```
`0003` convierte montos a `NUMERIC(14,2)`, fechas texto a `DATE` (textos como "Hoy" toman la fecha de creación) y elimina los tokens de Gmail guardados en texto plano.

### Checks rápidos
```bash
python tests/check_auth_security.py
python tests/check_ledger.py
```
Usan SQLite temporal; con `CHECK_DATABASE_URL` apuntan a otra base (nunca a producción).

### Generar una nueva migración automáticamente:
```bash
alembic revision --autogenerate -m "descripcion_del_cambio"
```

### Aplicar migraciones pendientes a Supabase:
```bash
alembic upgrade head
```

### Revertir la última migración:
```bash
alembic downgrade -1
```
