"""carreras: tipo de periodo de la institución (los horarios nuevos lo toman de aquí)

Cada carrera toma el tipo de su horario más reciente; sin horarios, cuatrimestral.

Revision ID: 0008_program_period_type
Revises: 0007_curriculum
Create Date: 2026-10-22 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0008_program_period_type'
down_revision: Union[str, None] = '0007_curriculum'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('programs', sa.Column('period_type', sa.String(length=16), nullable=False, server_default='cuatrimestral'))
    conn = op.get_bind()
    latest = {}
    for r in conn.execute(sa.text("SELECT program_id, period_type FROM schedules WHERE program_id IS NOT NULL ORDER BY start_date")):
        if r.period_type not in ('verano', 'personalizado'):  # no describen la carrera
            latest[r.program_id] = r.period_type
    for pid, ptype in latest.items():
        conn.execute(sa.text("UPDATE programs SET period_type = :t WHERE id = :p"), {"t": ptype, "p": pid})


def downgrade() -> None:
    with op.batch_alter_table('programs') as b:
        b.drop_column('period_type')
