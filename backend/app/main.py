from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: crea tablas solo en desarrollo (SQLite); producción usa Alembic
    init_db()
    yield
    # Shutdown: Cleanup if needed


_docs_enabled = not settings.is_production

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if _docs_enabled else None,
    docs_url=f"{settings.API_V1_STR}/docs" if _docs_enabled else None,
    redoc_url=f"{settings.API_V1_STR}/redoc" if _docs_enabled else None,
    lifespan=lifespan,
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Sin "input": no se reflejan datos enviados (contraseñas) y se evita fallar al serializar inf/nan
    errors = [{k: v for k, v in err.items() if k in ("loc", "msg", "type")} for err in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([*settings.CORS_ORIGINS, settings.FRONTEND_URL])),
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }
