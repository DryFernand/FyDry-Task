"""initial: usuarios, perfiles y códigos OTP.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "otp_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("code_type", sa.String(length=50), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_otp_codes_email"), "otp_codes", ["email"], unique=False)
    op.create_index(op.f("ix_otp_codes_id"), "otp_codes", ["id"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False),
        sa.Column("auth_provider", sa.String(length=50), nullable=False),
        sa.Column("provider_id", sa.String(length=255), nullable=True),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(), nullable=True),
        sa.Column("password_changed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_provider_id"), "users", ["provider_id"], unique=False)

    op.create_table(
        "user_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("preferred_currency", sa.String(length=10), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False),
        sa.Column("budget_reset_day", sa.Integer(), nullable=False),
        sa.Column("transfer_tax_rate", sa.Numeric(6, 5), nullable=False, server_default="0.0015"),
        sa.Column("notifications_enabled", sa.Boolean(), nullable=False),
        sa.Column("email_notifications", sa.Boolean(), nullable=False),
        sa.Column("budget_alerts", sa.Boolean(), nullable=False),
        sa.Column("weekly_digest", sa.Boolean(), nullable=False),
        sa.Column("employment_type", sa.String(length=100), nullable=True),
        sa.Column("industry_or_role", sa.String(length=150), nullable=True),
        sa.Column("monthly_income_range", sa.String(length=100), nullable=True),
        sa.Column("income_sources", sa.JSON(), nullable=True),
        sa.Column("income_frequency", sa.String(length=50), nullable=True),
        sa.Column("financial_situation_status", sa.String(length=100), nullable=True),
        sa.Column("primary_goals", sa.JSON(), nullable=True),
        sa.Column("referral_source", sa.String(length=100), nullable=True),
        sa.Column("referral_detail", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_profiles_id"), "user_profiles", ["id"], unique=False)
    op.create_index(op.f("ix_user_profiles_user_id"), "user_profiles", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_profiles_user_id"), table_name="user_profiles")
    op.drop_index(op.f("ix_user_profiles_id"), table_name="user_profiles")
    op.drop_table("user_profiles")
    op.drop_index(op.f("ix_users_provider_id"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_otp_codes_id"), table_name="otp_codes")
    op.drop_index(op.f("ix_otp_codes_email"), table_name="otp_codes")
    op.drop_table("otp_codes")
