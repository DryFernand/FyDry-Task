"""pénsum: materias de la carrera con pre y correquisitos; las del horario se enlazan a ellas

Revision ID: 0007_curriculum
Revises: 0006_program_goals
Create Date: 2026-10-22 13:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0007_curriculum'
down_revision: Union[str, None] = '0006_program_goals'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('curriculum_courses',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('program_id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=30), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('credits', sa.Integer(), nullable=True),
    sa.Column('term', sa.Integer(), nullable=True),
    sa.Column('prereqs', sa.JSON(), nullable=False),
    sa.Column('coreqs', sa.JSON(), nullable=False),
    sa.Column('done', sa.Boolean(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('program_id', 'code', name='uq_course_program_code')
    )
    op.create_index(op.f('ix_curriculum_courses_program_id'), 'curriculum_courses', ['program_id'], unique=False)
    op.create_index(op.f('ix_curriculum_courses_user_id'), 'curriculum_courses', ['user_id'], unique=False)
    with op.batch_alter_table('subjects') as b:  # batch: SQLite no altera llaves foráneas en sitio
        b.add_column(sa.Column('course_id', sa.String(length=36), nullable=True))
        b.create_index(op.f('ix_subjects_course_id'), ['course_id'], unique=False)
        b.create_foreign_key('fk_subjects_course_id', 'curriculum_courses', ['course_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    with op.batch_alter_table('subjects') as b:
        b.drop_constraint('fk_subjects_course_id', type_='foreignkey')
        b.drop_index(op.f('ix_subjects_course_id'))
        b.drop_column('course_id')
    op.drop_index(op.f('ix_curriculum_courses_user_id'), table_name='curriculum_courses')
    op.drop_index(op.f('ix_curriculum_courses_program_id'), table_name='curriculum_courses')
    op.drop_table('curriculum_courses')
