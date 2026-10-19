from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field
from app.schemas import CoreSchema


# --- User Out Schema ---
class UserOut(CoreSchema):
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    onboarding_completed: bool = False
    auth_provider: str



# --- Registration & Login ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Contraseña mínimo 8 caracteres")
    full_name: str = Field(..., min_length=2, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# --- OTP Verification ---
class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="Código de 6 dígitos")
    code_type: str = Field(default="register_verification", description="register_verification, login_otp, password_reset")


class ResendOtpRequest(BaseModel):
    email: EmailStr
    code_type: Literal["register_verification", "password_reset"] = "register_verification"


# --- Password Recovery ---
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


# --- OAuth Requests ---
class GoogleAuthRequest(BaseModel):
    id_token: str
    redirect_uri: Optional[str] = None



class GitHubAuthRequest(BaseModel):
    code_or_token: str


# --- Responses ---
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AuthActionResponse(BaseModel):
    status: str
    message: str
    require_otp: bool = False
    remaining_attempts: Optional[int] = None
    locked_seconds: Optional[int] = None


# --- User Settings Schemas ---
class UserSettingsResponse(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    preferred_currency: str = "DOP"
    language: str = "es"
    budget_reset_day: int = 1
    transfer_tax_rate: float = 0.0015
    notifications_enabled: bool = True
    email_notifications: bool = True
    budget_alerts: bool = True
    weekly_digest: bool = True


class UserSettingsUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    preferred_currency: Optional[str] = None
    language: Optional[str] = None
    budget_reset_day: Optional[int] = Field(None, ge=1, le=31)
    # Fracción: 0.0015 = 0.15%. Máximo 5% para evitar errores de captura.
    transfer_tax_rate: Optional[float] = Field(None, ge=0, le=0.05, allow_inf_nan=False)
    notifications_enabled: Optional[bool] = None
    email_notifications: Optional[bool] = None
    budget_alerts: Optional[bool] = None
    weekly_digest: Optional[bool] = None

