"""Self-check de la migración 0002: las recurrentes pasan a hábitos con su historial.
Ejecutar desde backend/: python tests/check_migration.py"""
import os
import sqlite3
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(tempfile.mkdtemp(), "mig.db")
env = {**os.environ, "DATABASE_URL": f"sqlite:///{db_path}", "DATABASE_POOLER_URL": ""}
alembic = [sys.executable, "-m", "alembic"]


def run(*args):
    r = subprocess.run(alembic + list(args), cwd=ROOT, env=env, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-1500:]


run("upgrade", "0001_tasks")
con = sqlite3.connect(db_path)
now = "2026-10-01 00:00:00"
con.executescript(f"""
INSERT INTO task_recurrences (id, user_id, title, category_id, priority, time, weekdays, start_date, end_date, is_active, created_at, updated_at)
VALUES ('rec-1', 'u1', 'Gimnasio', NULL, 'medium', '07:00', '0,2,4', '2026-10-05', NULL, 1, '{now}', '{now}'),
       ('rec-2', 'u1', 'Viejo', NULL, 'medium', NULL, '1', '2026-09-01', '2026-09-30', 0, '{now}', '{now}');
INSERT INTO task_items (id, user_id, title, priority, date, status, recurrence_id, postponed_from_id, postpone_count, position, is_deleted, created_at, updated_at) VALUES
 ('i1', 'u1', 'Gimnasio', 'medium', '2026-10-05', 'done',      'rec-1', NULL, 0, 0, 0, '{now}', '{now}'),
 ('i2', 'u1', 'Gimnasio', 'medium', '2026-10-07', 'partial',   'rec-1', NULL, 0, 0, 0, '{now}', '{now}'),
 ('i3', 'u1', 'Gimnasio', 'medium', '2026-10-09', 'not_done',  'rec-1', NULL, 0, 0, 0, '{now}', '{now}'),
 ('i4', 'u1', 'Gimnasio', 'medium', '2026-10-12', 'postponed', 'rec-1', NULL, 0, 0, 0, '{now}', '{now}'),
 ('i5', 'u1', 'Gimnasio', 'medium', '2026-10-13', 'pending',   NULL,    'i4', 1, 0, 0, '{now}', '{now}'),
 ('i6', 'u1', 'Gimnasio', 'medium', '2026-10-14', 'pending',   'rec-1', NULL, 0, 0, 0, '{now}', '{now}'),
 ('i7', 'u1', 'Gimnasio', 'medium', '2026-10-16', 'done',      'rec-1', NULL, 0, 0, 1, '{now}', '{now}'),
 ('i8', 'u1', 'Viejo',    'medium', '2026-09-02', 'done',      'rec-2', NULL, 0, 0, 0, '{now}', '{now}'),
 ('i9', 'u1', 'Informe',  'high',   '2026-10-06', 'done',      NULL,    NULL, 0, 0, 0, '{now}', '{now}');
""")
con.commit()
con.close()

run("upgrade", "head")
con = sqlite3.connect(db_path)
habits = {r[0]: r[1:] for r in con.execute("SELECT title, kind, status, weekdays, time, start_date FROM habits")}
assert habits["Gimnasio"] == ("established", "active", "0,2,4", "07:00", "2026-10-05"), habits
assert habits["Viejo"][1] == "archived"
logs = sorted(con.execute(
    "SELECT h.title, l.date, l.status FROM habit_logs l JOIN habits h ON h.id = l.habit_id ORDER BY l.date"
).fetchall())
# done y A medias -> Hecho; No hecho -> No hecho; pospuesta, pendiente y borrada no dejan registro
assert logs == [
    ("Gimnasio", "2026-10-05", "done"),
    ("Gimnasio", "2026-10-07", "done"),
    ("Gimnasio", "2026-10-09", "not_done"),
    ("Viejo", "2026-09-02", "done"),
], logs
items = {r[0]: r[1] for r in con.execute("SELECT id, postponed_from_id FROM task_items")}
assert set(items) == {"i5", "i9"}, items  # solo quedan las tareas sueltas (incluida la copia pospuesta)
assert items["i5"] is None
assert con.execute("SELECT COUNT(*) FROM task_recurrences WHERE is_active = 1").fetchone()[0] == 0
con.close()

# 0005: la escala, el historial y la institución pasan a una carrera "Mi carrera" por usuario
run("downgrade", "0004_grades")
con = sqlite3.connect(db_path)
con.executescript(f"""
INSERT INTO schedules (id, user_id, name, institution, period_type, start_date, end_date, is_archived, created_at, updated_at) VALUES
 ('s1', 'u1', '2026-1', NULL,   'cuatrimestral', '2026-01-05', '2026-04-30', 0, '{now}', '{now}'),
 ('s2', 'u1', '2026-2', 'ITLA', 'cuatrimestral', '2026-05-04', '2026-08-31', 0, '{now}', '{now}'),
 ('s3', 'u2', 'Nivel 1', NULL,  'trimestral',    '2026-01-05', '2026-03-31', 0, '{now}', '{now}');
INSERT INTO academic_settings (user_id, scale, pass_min, prior_index, prior_credits, created_at, updated_at)
VALUES ('u1', '[{{"letter": "A", "min": 90, "points": 4.0}}, {{"letter": "F", "min": 0, "points": 0.0}}]', 65, 3.1, 24, '{now}', '{now}');
""")
con.commit()
con.close()
run("upgrade", "head")
con = sqlite3.connect(db_path)
progs = {r[0]: r[1:] for r in con.execute("SELECT user_id, name, institution, pass_min, prior_index, prior_credits, id FROM programs")}
assert progs["u1"][:5] == ("Mi carrera", "ITLA", 65.0, 3.1, 24), progs
assert progs["u2"][:5] == ("Mi carrera", None, 70.0, None, None), progs
assert dict(con.execute("SELECT id, program_id FROM schedules")) == {"s1": progs["u1"][5], "s2": progs["u1"][5], "s3": progs["u2"][5]}
con.close()

run("downgrade", "0004_grades")
con = sqlite3.connect(db_path)
assert dict(con.execute("SELECT id, institution FROM schedules")) == {"s1": "ITLA", "s2": "ITLA", "s3": None}
assert con.execute("SELECT pass_min, prior_index FROM academic_settings WHERE user_id = 'u1'").fetchone() == (65.0, 3.1)
con.close()

run("downgrade", "0001_tasks")
print("OK: migraciones de recurrentes a hábitos y de carreras")
