import secrets
from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    generate_secure_otp,
)
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.otp import OtpCode
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    VerifyOtpRequest,
    ResendOtpRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    GoogleAuthRequest,
    GitHubAuthRequest,
    TokenResponse,
    AuthActionResponse,
    UserOut,
    UserSettingsResponse,
    UserSettingsUpdate,
)
from app.services.email import (
    send_verification_otp_email,
    send_login_otp_email,
    send_password_reset_email,
    send_account_locked_alert,
)
from app.services.oauth import exchange_google_code_or_token, verify_google_id_token, get_github_user_profile
from app.api.deps import get_current_user

router = APIRouter()

# Hash fijo para igualar el tiempo de respuesta cuando el correo no existe (evita enumeración por timing)
_DUMMY_PASSWORD_HASH = get_password_hash("fydry-task-timing-equalizer")


def _issue_otp(db: Session, email: str, code_type: str) -> str:
    """Invalida códigos previos del mismo tipo y crea uno nuevo. Devuelve el código."""
    db.query(OtpCode).filter(
        OtpCode.email == email,
        OtpCode.code_type == code_type,
        OtpCode.is_used == False,
    ).update({"is_used": True})
    code = generate_secure_otp(6)
    db.add(OtpCode(
        email=email,
        code=code,
        code_type=code_type,
        expires_at=OtpCode.generate_expiry(settings.OTP_EXPIRE_MINUTES),
        is_used=False,
        attempts=0,
    ))
    return code


def _check_otp(db: Session, email: str, code: str, code_type: str, invalid_msg: str, consume: bool = True) -> OtpCode:
    """Valida el último OTP activo. Cada fallo cuenta; al llegar a OTP_MAX_ATTEMPTS el código se invalida."""
    otp_entry = (
        db.query(OtpCode)
        .filter(
            OtpCode.email == email,
            OtpCode.code_type == code_type,
            OtpCode.is_used == False,
        )
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if not otp_entry or otp_entry.is_expired or otp_entry.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=invalid_msg)

    if not secrets.compare_digest(otp_entry.code, code):
        otp_entry.attempts += 1
        if otp_entry.attempts >= settings.OTP_MAX_ATTEMPTS:
            otp_entry.is_used = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=invalid_msg)

    if consume:
        otp_entry.is_used = True
    return otp_entry


def _link_oauth_user(db: Session, profile: dict, provider: str, default_name: str) -> User:
    """Crea o vincula un usuario OAuth. Exige correo verificado por el proveedor."""
    if not profile.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo de tu cuenta no está verificado por el proveedor.",
        )

    email = profile["email"].lower()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            email=email,
            full_name=profile.get("full_name") or default_name,
            avatar_url=profile.get("avatar_url"),
            auth_provider=provider,
            provider_id=profile.get("provider_id"),
            is_active=True,
            is_verified=True,
        )
        db.add(user)
    else:
        if not user.is_verified:
            # Cuenta creada por correo sin verificar: alguien pudo registrarla con una contraseña ajena.
            # El dueño real demuestra control del correo vía OAuth, así que se descarta esa contraseña.
            user.hashed_password = None
            user.auth_provider = provider
            user.provider_id = profile.get("provider_id")
            user.password_changed_at = datetime.utcnow()
        user.is_verified = True
        if not user.avatar_url and profile.get("avatar_url"):
            user.avatar_url = profile.get("avatar_url")

    db.commit()
    db.refresh(user)
    return user


# ============================================================================
# 1. REGISTRO & VERIFICACIÓN OTP POR CORREO
# ============================================================================
@router.post(
    "/register",
    response_model=AuthActionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo usuario y enviar código OTP a su correo",
)
def register(
    user_in: UserRegister,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe una cuenta activa con este correo electrónico.",
            )
        else:
            # User registered before but not verified yet: update info
            existing_user.full_name = user_in.full_name
            existing_user.hashed_password = get_password_hash(user_in.password)
            user = existing_user
    else:
        # Create new user
        user = User(
            email=user_in.email.lower(),
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name,
            is_active=True,
            is_verified=False,
            auth_provider="email",
        )
        db.add(user)

    otp_code_str = _issue_otp(db, user_in.email.lower(), "register_verification")
    db.commit()

    # Send verification email via Google SMTP in background
    background_tasks.add_task(
        send_verification_otp_email,
        to_email=user.email,
        code=otp_code_str,
        user_name=user.full_name,
    )

    return AuthActionResponse(
        status="success",
        message=f"Código de verificación de 6 dígitos enviado exitosamente a {user.email}",
        require_otp=True,
    )


@router.post(
    "/verify-email-otp",
    response_model=TokenResponse,
    summary="Verificar código OTP y activar cuenta",
)
def verify_email_otp(
    payload: VerifyOtpRequest,
    db: Session = Depends(get_db),
) -> Any:
    # Solo códigos de registro pueden activar una cuenta y emitir un JWT
    _check_otp(
        db,
        payload.email.lower(),
        payload.code,
        "register_verification",
        "El código de verificación es inválido o ha expirado.",
    )

    # Activate & verify user
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )

    user.is_verified = True
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)

    # Generate JWT access token
    access_token = create_access_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post(
    "/resend-otp",
    response_model=AuthActionResponse,
    summary="Reenviar código OTP de 6 dígitos por correo",
)
def resend_otp(
    payload: ResendOtpRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    generic_response = AuthActionResponse(
        status="success",
        message=f"Si el correo {payload.email} está registrado, recibirás un nuevo código.",
        require_otp=True,
    )
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # No revelamos si el correo existe; tampoco reenviamos verificación a cuentas ya verificadas
    if not user or (payload.code_type == "register_verification" and user.is_verified):
        return generic_response

    otp_code_str = _issue_otp(db, payload.email.lower(), payload.code_type)
    db.commit()

    # Trigger email dispatch
    if payload.code_type == "password_reset":
        background_tasks.add_task(
            send_password_reset_email,
            to_email=user.email,
            code=otp_code_str,
            user_name=user.full_name,
        )
    else:
        background_tasks.add_task(
            send_verification_otp_email,
            to_email=user.email,
            code=otp_code_str,
            user_name=user.full_name,
        )

    return generic_response


# ============================================================================
# 2. INICIO DE SESIÓN CON BLOQUEO POR INTENTOS
# ============================================================================
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión con protección contra fuerza bruta",
)
def login(
    credentials: UserLogin,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    user = db.query(User).filter(User.email == credentials.email.lower()).first()
    if not user:
        verify_password(credentials.password, _DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas.",
        )

    # 1. Check if account is temporarily locked
    if user.is_locked:
        remaining_seconds = max(1, int((user.locked_until - datetime.utcnow()).total_seconds()))
        if remaining_seconds >= 3600:
            hours = remaining_seconds // 3600
            mins = (remaining_seconds % 3600) // 60
            time_str = f"{hours}h {mins}m" if mins > 0 else f"{hours} hora(s)"
        elif remaining_seconds >= 60:
            time_str = f"{remaining_seconds // 60} minuto(s)"
        else:
            time_str = f"{remaining_seconds} segundo(s)"

        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cuenta bloqueada temporalmente por seguridad. Podrás reintentar en {time_str}.",
            headers={"Retry-After": str(remaining_seconds)},
        )

    # 2. Verify Password
    if not verify_password(credentials.password, user.hashed_password):
        user.failed_login_attempts += 1
        attempts = user.failed_login_attempts

        # Escalonamiento de seguridad:
        # Nivel 1: 5 intentos fallidos -> Bloqueo por 1 minuto
        # Nivel 2: +2 intentos (total 7) -> Bloqueo por 1 hora
        # Nivel 3: +1 intento (total 8+) -> Bloqueo por 24 horas
        should_lock = False
        lock_duration = timedelta(minutes=1)
        lock_label = "1 minuto"
        remaining_in_tier = 0

        if attempts < 5:
            remaining_in_tier = 5 - attempts
        elif attempts == 5:
            should_lock = True
            lock_duration = timedelta(minutes=1)
            lock_label = "1 minuto"
        elif attempts < 7:
            remaining_in_tier = 7 - attempts
        elif attempts == 7:
            should_lock = True
            lock_duration = timedelta(hours=1)
            lock_label = "1 hora"
        elif attempts < 8:
            remaining_in_tier = 8 - attempts
        else:
            should_lock = True
            lock_duration = timedelta(hours=24)
            lock_label = "24 horas"

        if should_lock:
            user.locked_until = datetime.utcnow() + lock_duration
            db.commit()

            # Dispatch security alert email
            background_tasks.add_task(
                send_account_locked_alert,
                to_email=user.email,
                user_name=user.full_name,
                minutes=int(lock_duration.total_seconds() // 60),
            )

            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Límite de intentos alcanzado. Por seguridad tu cuenta ha sido bloqueada durante {lock_label}.",
                headers={"Retry-After": str(int(lock_duration.total_seconds()))},
            )

        db.commit()

        if remaining_in_tier <= 2:
            detail_msg = f"Correo o contraseña incorrectos. Te quedan solo {remaining_in_tier} intento(s) antes del bloqueo por seguridad."
        else:
            detail_msg = "Correo o contraseña incorrectos."

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail_msg,
        )

    # 3. Successful password match -> Reset security counters
    user.failed_login_attempts = 0
    user.locked_until = None

    # 4. Correo sin verificar: no se emite token; se reenvía el código de verificación
    if not user.is_verified:
        otp_code_str = _issue_otp(db, user.email, "register_verification")
        db.commit()
        background_tasks.add_task(
            send_verification_otp_email,
            to_email=user.email,
            code=otp_code_str,
            user_name=user.full_name,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes verificar tu correo. Te enviamos un nuevo código de 6 dígitos.",
        )

    db.commit()
    db.refresh(user)

    # 5. Generate access token
    access_token = create_access_token(subject=user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


# ============================================================================
# 3. RECUPERACIÓN DE CONTRASEÑA
# ============================================================================
@router.post(
    "/forgot-password",
    response_model=AuthActionResponse,
    summary="Solicitar código de restablecimiento de contraseña",
)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    # Por seguridad no revelamos si el correo existe o no
    generic_response = AuthActionResponse(
        status="success",
        message=f"Si el correo {payload.email} está registrado, recibirás un código de recuperación.",
        require_otp=True,
    )
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        return generic_response

    otp_code_str = _issue_otp(db, payload.email.lower(), "password_reset")
    db.commit()

    # Send reset email
    background_tasks.add_task(
        send_password_reset_email,
        to_email=user.email,
        code=otp_code_str,
        user_name=user.full_name,
    )

    return generic_response


@router.post(
    "/verify-reset-otp",
    response_model=AuthActionResponse,
    summary="Validar código OTP de restablecimiento de contraseña",
)
def verify_reset_otp(
    payload: VerifyOtpRequest,
    db: Session = Depends(get_db),
) -> Any:
    _check_otp(
        db,
        payload.email.lower(),
        payload.code,
        "password_reset",
        "El código de 6 dígitos es inválido o ha expirado.",
        consume=False,
    )

    return AuthActionResponse(
        status="success",
        message="Código de recuperación válido.",
    )


@router.post(
    "/reset-password",
    response_model=AuthActionResponse,
    summary="Restablecer contraseña con código de verificación",
)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> Any:
    _check_otp(
        db,
        payload.email.lower(),
        payload.code,
        "password_reset",
        "El código de recuperación es inválido o ha expirado.",
    )

    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )

    # Update password, unlock account and revoke previously issued tokens.
    # Recibir el código prueba control del correo, así que la cuenta queda verificada.
    user.hashed_password = get_password_hash(payload.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.is_verified = True
    user.password_changed_at = datetime.utcnow()
    db.commit()

    return AuthActionResponse(
        status="success",
        message="Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.",
    )


# ============================================================================
# 4. OAUTH: INICIO DE SESIÓN CON GOOGLE Y GITHUB
# ============================================================================
@router.post(
    "/google",
    response_model=TokenResponse,
    summary="Autenticación con Google OAuth (Google ID Token o Auth Code)",
)
async def google_auth(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
) -> Any:
    profile = await exchange_google_code_or_token(payload.id_token, payload.redirect_uri)
    if not profile or not profile.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo validar la autenticación con Google. Verifica que el redireccionamiento esté autorizado.",
        )

    user = await run_in_threadpool(_link_oauth_user, db, profile, "google", "Usuario Google")

    access_token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post(
    "/github",
    response_model=TokenResponse,
    summary="Autenticación con GitHub OAuth",
)
async def github_auth(
    payload: GitHubAuthRequest,
    db: Session = Depends(get_db),
) -> Any:
    profile = await get_github_user_profile(payload.code_or_token)
    if not profile or not profile.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo autenticar con GitHub.",
        )

    user = await run_in_threadpool(_link_oauth_user, db, profile, "github", "Usuario GitHub")

    access_token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


# ============================================================================
# 5. PERFIL DE USUARIO ACTUAL & ONBOARDING
# ============================================================================
@router.get(
    "/me",
    response_model=UserOut,
    summary="Obtener perfil del usuario autenticado",
)
def get_me(current_user: User = Depends(get_current_user)) -> Any:
    return current_user


@router.post(
    "/complete-onboarding",
    response_model=UserOut,
    summary="Marcar onboarding como completado",
)
def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    current_user.onboarding_completed = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get(
    "/settings",
    response_model=UserSettingsResponse,
    summary="Obtener configuraciones y preferencias del usuario",
)
def get_user_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    profile = current_user.profile
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return UserSettingsResponse(
        full_name=current_user.full_name,
        email=current_user.email,
        phone=profile.phone,
        city=profile.city,
        country=profile.country,
        preferred_currency=profile.preferred_currency or "DOP",
        language=profile.language or "es",
        budget_reset_day=profile.budget_reset_day or 1,
        transfer_tax_rate=float(profile.transfer_tax_rate if profile.transfer_tax_rate is not None else 0.0015),
        notifications_enabled=profile.notifications_enabled,
        email_notifications=profile.email_notifications,
        budget_alerts=profile.budget_alerts,
        weekly_digest=profile.weekly_digest,
    )


@router.put(
    "/settings",
    response_model=UserSettingsResponse,
    summary="Actualizar configuraciones y preferencias del usuario",
)
def update_user_settings(
    settings_in: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if settings_in.full_name is not None:
        current_user.full_name = settings_in.full_name

    profile = current_user.profile
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    update_dict = settings_in.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if field != "full_name" and hasattr(profile, field):
            setattr(profile, field, val)

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)

    return UserSettingsResponse(
        full_name=current_user.full_name,
        email=current_user.email,
        phone=profile.phone,
        city=profile.city,
        country=profile.country,
        preferred_currency=profile.preferred_currency or "DOP",
        language=profile.language or "es",
        budget_reset_day=profile.budget_reset_day or 1,
        transfer_tax_rate=float(profile.transfer_tax_rate if profile.transfer_tax_rate is not None else 0.0015),
        notifications_enabled=profile.notifications_enabled,
        email_notifications=profile.email_notifications,
        budget_alerts=profile.budget_alerts,
        weekly_digest=profile.weekly_digest,
    )


