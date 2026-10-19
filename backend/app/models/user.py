import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Boolean, Integer, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Puede ser null si es OAuth
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)

    # Estado de la cuenta y Onboarding
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    onboarding_completed = Column(Boolean, default=False, nullable=False)

    # OAuth
    auth_provider = Column(String(50), default="email", nullable=False)  # "email", "google", "github"
    provider_id = Column(String(255), nullable=True, index=True)

    # Seguridad contra fuerza bruta
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    # Tokens emitidos antes de esta fecha quedan invalidados (cambio/restablecimiento de contraseña)
    password_changed_at = Column(DateTime, nullable=True)

    # Relación 1:1 con perfil
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")

    @property
    def is_locked(self) -> bool:
        if self.locked_until and self.locked_until > datetime.utcnow():
            return True
        return False
