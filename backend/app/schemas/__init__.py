from pydantic import BaseModel, ConfigDict


class CoreSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


from app.schemas.auth import (
    UserOut,
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
)

__all__ = [
    "CoreSchema",
    "UserOut",
    "UserRegister",
    "UserLogin",
    "VerifyOtpRequest",
    "ResendOtpRequest",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    "GoogleAuthRequest",
    "GitHubAuthRequest",
    "TokenResponse",
    "AuthActionResponse",
]
