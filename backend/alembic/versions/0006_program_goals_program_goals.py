"""carreras: duración del pénsum, límite de créditos por periodo y meta de fecha de graduación

Revision ID: 0006_program_goals
Revises: 0005_programs
Create Date: 2026-10-22 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0006_program_goals'
down_revision: Union[str, None] = '0005_programs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('programs', sa.Column('plan_periods', sa.Integer(), nullable=True))
    op.add_column('programs', sa.Column('max_credits_per_period', sa.Integer(), nullable=True))
    op.add_column('programs', sa.Column('goal_end_date', sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('programs') as b:
        b.drop_column('goal_end_date')
        b.drop_column('max_credits_per_period')
        b.drop_column('plan_periods')
