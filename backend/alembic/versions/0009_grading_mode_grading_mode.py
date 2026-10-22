"""carreras por promedio: modo de calificación, nota por periodo y promedio previo

Revision ID: 0009_grading_mode
Revises: 0008_program_period_type
Create Date: 2026-10-22 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0009_grading_mode'
down_revision: Union[str, None] = '0008_program_period_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('programs', sa.Column('grading', sa.String(length=12), nullable=False, server_default='credits'))
    op.add_column('programs', sa.Column('prior_average', sa.Float(), nullable=True))
    op.add_column('schedules', sa.Column('final_grade', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('schedules') as b:
        b.drop_column('final_grade')
    with op.batch_alter_table('programs') as b:
        b.drop_column('prior_average')
        b.drop_column('grading')
