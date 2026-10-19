import uuid
from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, JSON, Numeric
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # 1. Datos Personales & Preferencias
    phone = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    preferred_currency = Column(String(10), default="DOP", nullable=False)
    language = Column(String(10), default="es", nullable=False)
    budget_reset_day = Column(Integer, default=1, nullable=False)  # Día 1 al 31 del mes en que reinicia el presupuesto
    # Impuesto DGII a transferencias electrónicas (0.0015 = 0.15%). Editable porque la ley puede cambiarlo.
    transfer_tax_rate = Column(Numeric(6, 5), default=0.0015, nullable=False, server_default="0.0015")

    # 2. Preferencias de Notificación
    notifications_enabled = Column(Boolean, default=True, nullable=False)
    email_notifications = Column(Boolean, default=True, nullable=False)
    budget_alerts = Column(Boolean, default=True, nullable=False)
    weekly_digest = Column(Boolean, default=True, nullable=False)

    # 3. Datos Laborales
    employment_type = Column(String(100), nullable=True)
    industry_or_role = Column(String(150), nullable=True)

    # 4. Datos Financieros
    monthly_income_range = Column(String(100), nullable=True)
    income_sources = Column(JSON, nullable=True)
    income_frequency = Column(String(50), nullable=True)

    # 5. Situación Económica y Metas
    financial_situation_status = Column(String(100), nullable=True)
    primary_goals = Column(JSON, nullable=True)

    # 6. Canal de Adquisición
    referral_source = Column(String(100), nullable=True)
    referral_detail = Column(String(255), nullable=True)

    # Relación con User
    user = relationship("User", back_populates="profile")
