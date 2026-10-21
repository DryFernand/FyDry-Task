"""carreras: agrupan horarios con su escala, historial, pénsum, metas y requisitos de honores

Cada usuario con horarios o configuración académica recibe una carrera "Mi carrera" con su
escala e historial actuales y la institución de su primer horario. Reemplaza academic_settings
y schedules.institution.

Revision ID: 0005_programs
Revises: 0004_grades
Create Date: 2026-10-21 12:10:00

"""
import uuid
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0005_programs'
down_revision: Union[str, None] = '0004_grades'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_SCALE = [
    {"letter": "A", "min": 90, "points": 4.0},
    {"letter": "B", "min": 80, "points": 3.0},
    {"letter": "C", "min": 70, "points": 2.0},
    {"letter": "D", "min": 60, "points": 1.0},
    {"letter": "F", "min": 0, "points": 0.0},
]
DEFAULT_HONORS = [
    {"name": "Summa Cum Laude", "min": 3.8},
    {"name": "Magna Cum Laude", "min": 3.5},
    {"name": "Cum Laude", "min": 3.2},
]
PRIOR = ("prior_index", "prior_credits", "prior_courses", "prior_passed", "prior_failed")

programs = sa.table(
    'programs', sa.column('id', sa.String), sa.column('user_id', sa.String), sa.column('name', sa.String),
    sa.column('institution', sa.String), sa.column('scale', sa.JSON), sa.column('pass_min', sa.Float),
    sa.column('honors', sa.JSON), sa.column('probation_min', sa.Float), sa.column('min_institution_pct', sa.Integer),
    *[sa.column(k) for k in PRIOR], sa.column('created_at', sa.DateTime), sa.column('updated_at', sa.DateTime),
)
settings = sa.table('academic_settings', sa.column('user_id', sa.String), sa.column('scale', sa.JSON), sa.column('pass_min', sa.Float),
                    *[sa.column(k) for k in PRIOR], sa.column('created_at', sa.DateTime), sa.column('updated_at', sa.DateTime))


def upgrade() -> None:
    op.create_table('programs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('institution', sa.String(length=120), nullable=True),
    sa.Column('scale', sa.JSON(), nullable=False),
    sa.Column('pass_min', sa.Float(), nullable=False),
    sa.Column('prior_index', sa.Float(), nullable=True),
    sa.Column('prior_credits', sa.Integer(), nullable=True),
    sa.Column('prior_courses', sa.Integer(), nullable=True),
    sa.Column('prior_passed', sa.Integer(), nullable=True),
    sa.Column('prior_failed', sa.Integer(), nullable=True),
    sa.Column('prior_periods', sa.Integer(), nullable=True),
    sa.Column('total_credits', sa.Integer(), nullable=True),
    sa.Column('total_subjects', sa.Integer(), nullable=True),
    sa.Column('transfer_credits', sa.Integer(), nullable=True),
    sa.Column('honors', sa.JSON(), nullable=False),
    sa.Column('target_index', sa.Float(), nullable=True),
    sa.Column('probation_min', sa.Float(), nullable=True),
    sa.Column('max_periods', sa.Integer(), nullable=True),
    sa.Column('min_institution_pct', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_programs_user_id'), 'programs', ['user_id'], unique=False)
    with op.batch_alter_table('schedules') as b:  # batch: SQLite no altera llaves foráneas en sitio
        b.add_column(sa.Column('program_id', sa.String(length=36), nullable=True))
        b.create_index(op.f('ix_schedules_program_id'), ['program_id'], unique=False)
        b.create_foreign_key('fk_schedules_program_id', 'programs', ['program_id'], ['id'], ondelete='CASCADE')

    conn = op.get_bind()
    now = datetime.utcnow()
    by_user = {r.user_id: r for r in conn.execute(sa.select(settings))}
    institution = {}
    for r in conn.execute(sa.text("SELECT user_id, institution FROM schedules ORDER BY start_date")):
        institution.setdefault(r.user_id, None)
        if r.institution and not institution[r.user_id]:
            institution[r.user_id] = r.institution
    for user_id in set(by_user) | set(institution):
        st = by_user.get(user_id)
        pid = str(uuid.uuid4())
        conn.execute(programs.insert().values(
            id=pid, user_id=user_id, name="Mi carrera", institution=institution.get(user_id),
            scale=st.scale if st else DEFAULT_SCALE, pass_min=st.pass_min if st else 70.0,
            honors=DEFAULT_HONORS, probation_min=2.0, min_institution_pct=50,
            **{k: getattr(st, k) if st else None for k in PRIOR}, created_at=now, updated_at=now,
        ))
        conn.execute(sa.text("UPDATE schedules SET program_id = :p WHERE user_id = :u"), {"p": pid, "u": user_id})

    with op.batch_alter_table('schedules') as b:
        b.drop_column('institution')
    op.drop_table('academic_settings')


def downgrade() -> None:
    op.create_table('academic_settings',
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('scale', sa.JSON(), nullable=False),
    sa.Column('pass_min', sa.Float(), nullable=False),
    sa.Column('prior_index', sa.Float(), nullable=True),
    sa.Column('prior_credits', sa.Integer(), nullable=True),
    sa.Column('prior_courses', sa.Integer(), nullable=True),
    sa.Column('prior_passed', sa.Integer(), nullable=True),
    sa.Column('prior_failed', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('user_id')
    )
    with op.batch_alter_table('schedules') as b:
        b.add_column(sa.Column('institution', sa.String(length=120), nullable=True))
    conn = op.get_bind()
    seen = set()
    for p in conn.execute(sa.select(programs).order_by(programs.c.created_at)):
        conn.execute(sa.text("UPDATE schedules SET institution = :i WHERE program_id = :p"), {"i": p.institution, "p": p.id})
        if p.user_id in seen:
            continue  # academic_settings solo guardaba una configuración por usuario
        seen.add(p.user_id)
        conn.execute(settings.insert().values(user_id=p.user_id, scale=p.scale, pass_min=p.pass_min,
                                              **{k: getattr(p, k) for k in PRIOR}, created_at=p.created_at, updated_at=p.updated_at))
    with op.batch_alter_table('schedules') as b:
        b.drop_constraint('fk_schedules_program_id', type_='foreignkey')
        b.drop_index(op.f('ix_schedules_program_id'))
        b.drop_column('program_id')
    op.drop_index(op.f('ix_programs_user_id'), table_name='programs')
    op.drop_table('programs')
