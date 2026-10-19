"""Self-check del horario de clases. Ejecutar desde backend/: python tests/check_classes.py"""
import os
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'classes.db')}"
os.environ["DATABASE_POOLER_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.api.deps import CurrentUser, get_current_user  # noqa: E402
from app.core.database import SessionLocal, db_url, init_db  # noqa: E402
from app.models import SubjectSession  # noqa: E402
from app.services import notifications  # noqa: E402
from app.services.schedules import suggested_end  # noqa: E402

assert db_url.startswith("sqlite"), "las pruebas deben usar una base local"
init_db()
users = {"a": CurrentUser(id="ua", email="a@x.com", full_name="Ana"), "b": CurrentUser(id="ub", email="b@x.com", full_name="Beto")}
current = {"u": users["a"]}
app.dependency_overrides[get_current_user] = lambda: current["u"]
c = TestClient(app)
API = "/api/v1"
MON = date(2026, 10, 12)
TODAY = MON + timedelta(days=9)  # miércoles de la semana siguiente
D = lambda n: str(MON + timedelta(days=n))  # noqa: E731
T = {"today": str(TODAY)}


def backdate():
    """Las sesiones se crean 'hoy'; la prueba usa fechas anteriores."""
    db = SessionLocal()
    db.query(SubjectSession).update({"created_at": datetime(2026, 9, 1)})
    db.commit()
    db.close()


def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code} {r.text}"
    return r.json() if r.content else None


# --- Periodos: el fin se calcula según el tipo
assert suggested_end(date(2026, 9, 7), "cuatrimestral") == date(2027, 1, 6)
assert suggested_end(date(2026, 1, 31), "bimestral") == date(2026, 3, 30)
assert suggested_end(date(2026, 1, 1), "personalizado") is None
assert c.post(f"{API}/schedules", params=T, json={"name": "x", "period_type": "personalizado", "start_date": D(0)}).status_code == 422
sch = ok(c.post(f"{API}/schedules", params=T, json={"name": "Cuatrimestre sep-dic", "institution": "UASD", "period_type": "cuatrimestral", "start_date": "2026-09-07"}), 201)
assert sch["end_date"] == "2027-01-06"

# --- Materias con sesiones; choques entre clases
calc = ok(c.post(f"{API}/schedules/{sch['id']}/subjects", params=T, json={
    "name": "Cálculo Integral", "teacher": "Prof. Pérez", "credits": 4, "color": "#2563eb", "location": "Aula 204",
    "sessions": [{"weekday": 0, "start_time": "08:00", "end_time": "10:00"}, {"weekday": 2, "start_time": "08:00", "end_time": "10:00"}],
}), 201)
calc_s = calc["subjects"][0]
assert calc_s["weekly_minutes"] == 240
assert c.post(f"{API}/schedules/{sch['id']}/subjects", params=T, json={"name": "x", "sessions": [{"weekday": 0, "start_time": "10:00", "end_time": "09:00"}]}).status_code == 422
full = ok(c.post(f"{API}/schedules/{sch['id']}/subjects", params=T, json={
    "name": "Física", "credits": 3, "modality": "mixta", "sessions": [{"weekday": 0, "start_time": "09:00", "end_time": "11:00", "location": "Lab 3"}],
}), 201)
backdate()
subj = {s["name"]: s for s in full["subjects"]}
fis = subj["Física"]
mon_calc = [x for x in subj["Cálculo Integral"]["sessions"] if x["weekday"] == 0][0]
assert fis["sessions"][0]["conflicts"] == [mon_calc["id"]] and mon_calc["conflicts"] == [fis["sessions"][0]["id"]]
assert full["credits"] == 7 and full["weekly_minutes"] == 360

# --- Asistencia (solo en días con esa clase y dentro del periodo)
ok(c.put(f"{API}/sessions/{mon_calc['id']}/attendance", json={"date": D(0), "status": "attended"}))
ok(c.put(f"{API}/sessions/{mon_calc['id']}/attendance", json={"date": D(7), "status": "absent"}))
assert c.put(f"{API}/sessions/{mon_calc['id']}/attendance", json={"date": D(1), "status": "attended"}).status_code == 422
assert c.put(f"{API}/sessions/{mon_calc['id']}/attendance", json={"date": "2027-03-01", "status": "attended"}).status_code == 422
current["u"] = users["b"]
assert c.put(f"{API}/sessions/{mon_calc['id']}/attendance", json={"date": D(0), "status": "attended"}).status_code == 404
current["u"] = users["a"]

# Editar la materia: la sesión del lunes (con id) conserva su asistencia; miércoles se borra; viernes es nueva
upd = ok(c.put(f"{API}/subjects/{calc_s['id']}", params=T, json={
    "name": "Cálculo Integral", "credits": 4, "color": "#2563eb",
    "sessions": [{"id": mon_calc["id"], "weekday": 0, "start_time": "08:00", "end_time": "09:30"}, {"weekday": 4, "start_time": "14:00", "end_time": "16:00"}],
}))
backdate()
calc_now = {s["name"]: s for s in upd["subjects"]}["Cálculo Integral"]
assert sorted(x["weekday"] for x in calc_now["sessions"]) == [0, 4] and calc_now["weekly_minutes"] == 210
assert [x for x in calc_now["sessions"] if x["weekday"] == 0][0]["conflicts"], "08:00-09:30 sigue chocando con Física 09:00"

ag = ok(c.get(f"{API}/agenda", params={"start": D(0), "end": D(6), "today": str(TODAY)}))
cls = [(x["subject"], x["date"], x["attendance"]) for x in ag["classes"]]
assert ("Cálculo Integral", D(0), "attended") in cls and ("Física", D(0), None) in cls and ("Cálculo Integral", D(4), None) in cls
assert not [x for x in cls if x[1] == D(2)], "el miércoles ya no tiene clase"

# --- Tareas académicas: materia y tipo solo con categoría académica
cats = {x["name"]: x for x in ok(c.get(f"{API}/categories"))}
assert cats["Estudio"]["is_academic"] and not cats["Trabajo"]["is_academic"]
t_work = ok(c.post(f"{API}/tasks", json={"title": "Informe", "category_id": cats["Trabajo"]["id"], "subject_id": calc_s["id"], "assignment_type": "examen", "date": D(1)}), 201)
assert t_work["subject_id"] is None and t_work["assignment_type"] is None
exam = ok(c.post(f"{API}/tasks", json={"title": "Parcial 1", "category_id": cats["Estudio"]["id"], "subject_id": calc_s["id"], "assignment_type": "examen", "date": str(TODAY + timedelta(days=1))}), 201)
assert exam["subject_id"] == calc_s["id"] and exam["assignment_type"] == "examen"
late = ok(c.post(f"{API}/tasks", json={"title": "Guía 3", "category_id": cats["Estudio"]["id"], "subject_id": calc_s["id"], "assignment_type": "tarea", "date": D(2)}), 201)
done = ok(c.post(f"{API}/tasks", json={"title": "Lectura cap. 2", "category_id": cats["Estudio"]["id"], "subject_id": fis["id"], "assignment_type": "lectura", "date": D(1)}), 201)
ok(c.patch(f"{API}/tasks/{done['id']}", json={"status": "done"}))
# Cambiar a una categoría no académica limpia la materia
moved = ok(c.patch(f"{API}/tasks/{late['id']}", json={"category_id": cats["Trabajo"]["id"]}))
assert moved["subject_id"] is None
ok(c.patch(f"{API}/tasks/{late['id']}", json={"category_id": cats["Estudio"]["id"], "subject_id": calc_s["id"], "assignment_type": "tarea"}))
current["u"] = users["b"]
bcats = {x["name"]: x for x in ok(c.get(f"{API}/categories"))}
assert c.post(f"{API}/tasks", json={"title": "x", "category_id": bcats["Estudio"]["id"], "subject_id": calc_s["id"]}).status_code == 404
current["u"] = users["a"]

st = {s["name"]: s for s in ok(c.get(f"{API}/schedules", params=T))[0]["subjects"]}["Cálculo Integral"]["assignments"]
assert (st["total"], st["overdue"], st["pending"], st["next_exam"]) == (2, 1, 1, str(TODAY + timedelta(days=1))), st
assert [t["title"] for t in ok(c.get(f"{API}/subjects/{calc_s['id']}/assignments"))] == ["Guía 3", "Parcial 1"]

# --- Análisis de clases
an = ok(c.get(f"{API}/analytics", params={"start": D(0), "end": str(TODAY), "today": str(TODAY)}))["classes"]
by = {x["name"]: x for x in an["by_subject"]}
assert (an["attended"], an["absent"]) == (1, 1) and an["attendance_rate"] == 0.5
assert by["Cálculo Integral"]["overdue"] == 1 and by["Física"]["assignment_rate"] == 1.0
assert any("atrasado en Cálculo Integral" in s for s in an["insights"]), an["insights"]

# --- Avisos: clase con hora y entregas de mañana a las 18:00
ok(c.put(f"{API}/notifications/prefs", json={"timezone": "America/Santo_Domingo", "reminder_minutes": 15, "day_close": False}))
ok(c.post(f"{API}/push/subscribe", json={"endpoint": "https://push.example/a", "keys": {"p256dh": "k", "auth": "a"}}), 204)
sent = []
fake = lambda sub, payload: sent.append(payload) or True  # noqa: E731
db = SessionLocal()
fri = MON + timedelta(days=11)  # viernes 23: Cálculo 14:00
r1 = notifications.run_due(db, fake, datetime(fri.year, fri.month, fri.day, 17, 50, tzinfo=timezone.utc))  # 13:50 local
assert r1["class_reminders"] == 1 and "Cálculo Integral" in sent[-1]["title"], (r1, sent)
assert notifications.run_due(db, fake, datetime(fri.year, fri.month, fri.day, 17, 55, tzinfo=timezone.utc))["class_reminders"] == 0
r2 = notifications.run_due(db, fake, datetime(TODAY.year, TODAY.month, TODAY.day, 22, 5, tzinfo=timezone.utc))  # 18:05 local
assert r2["deadlines"] == 1 and "examen" in sent[-1]["title"] and "Parcial 1" in sent[-1]["title"], sent[-1]
db.close()

# --- Duplicar para el siguiente periodo (sin asistencia) y archivar
dup = ok(c.post(f"{API}/schedules/{sch['id']}/duplicate", params=T, json={"name": "Cuatrimestre ene-abr", "period_type": "cuatrimestral", "start_date": "2027-01-11"}), 201)
assert dup["end_date"] == "2027-05-10" and sorted(s["name"] for s in dup["subjects"]) == ["Cálculo Integral", "Física"]
assert dup["institution"] == "UASD"
assert not ok(c.get(f"{API}/agenda", params={"start": "2027-01-11", "end": "2027-01-17", "today": "2027-01-11"}))["classes"][0]["attendance"]
# Una clase recién creada no aparece en semanas anteriores a su creación ("sin marcar" falsos)
new = ok(c.post(f"{API}/schedules/{dup['id']}/subjects", params=T, json={"name": "Nueva", "sessions": [{"weekday": 0, "start_time": "07:00", "end_time": "08:00"}]}), 201)
far_past = ok(c.get(f"{API}/agenda", params={"start": "2027-01-11", "end": "2027-01-17", "today": "2027-01-11"}))["classes"]
assert any(x["subject"] == "Nueva" for x in far_past), "en el futuro sí aparece"
ok(c.patch(f"{API}/schedules/{dup['id']}", params=T, json={"is_archived": True}))
assert not ok(c.get(f"{API}/agenda", params={"start": "2027-01-11", "end": "2027-01-17", "today": "2027-01-11"}))["classes"]

# --- Borrar materia: sus tareas quedan sin materia
ok(c.delete(f"{API}/subjects/{calc_s['id']}"), 204)
assert ok(c.patch(f"{API}/tasks/{exam['id']}", json={"title": "Parcial 1"}))["subject_id"] is None
ok(c.delete(f"{API}/schedules/{sch['id']}"), 204)
assert len(ok(c.get(f"{API}/schedules", params=T))) == 1

print("OK: checks del horario de clases pasaron")
