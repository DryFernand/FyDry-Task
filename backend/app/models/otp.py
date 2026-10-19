import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Boolean, DateTime, Integer
from app.core.database import Base
from app.models.base import TimestampMixin
from app.core.config import settings


class OtpCode(Base, TimestampMixin):
    __tablename__ = "otp_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String(255), index=True, nullable=False)
    code = Column(String(6), nullable=False)
    code_type = Column(String(50), nullable=False)  # "register_verification", "login_otp", "password_reset"
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=0, nullable=False, server_default="0")

    @classmethod
    def generate_expiry(cls, minutes: int = settings.OTP_EXPIRE_MINUTES) -> datetime:
        return datetime.utcnow() + timedelta(minutes=minutes)

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at
