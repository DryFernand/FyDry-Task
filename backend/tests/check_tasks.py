"""Self-check de tareas, análisis, perfil IA y avisos. Ejecutar desde backend/: python tests/check_tasks.py"""
import os
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'check.db')}"
os.environ["DATABASE_POOLER_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.api.deps import CurrentUser, get_current_user  # noqa: E402
from app.core.database import SessionLocal, init_db  # noqa: E402
from app.models import TaskItem, TaskNotificationPrefs, TaskPushSubscription  # noqa: E402
from app.services import ai_profile, notifications  # noqa: E402

init_db()
users = {"a": CurrentUser(id="user-a", email="a@x.com", full_name="Ana"), "b": CurrentUser(id="user-b", email="b@x.com", full_name="Beto")}
current = {"u": users["a"]}
app.dependency_overrides[get_current_user] = lambda: current["u"]
c = TestClient(app)
API = "/api/v1"

MON = date(2026, 10, 12)  # lunes
TODAY = MON + timedelta(days=9)  # miércoles de la semana siguiente


def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code} {r.text}"
    return r.json() if r.content else None


# --- Categorías: se crean las 5 base la primera vez, una sola vez
cats = ok(c.get(f"{API}/categories"))
assert [x["name"] for x in cats] == ["Trabajo", "Salud", "Personal", "Estudio", "Hogar"]
assert len(ok(c.get(f"{API}/categories"))) == 5
work, health = cats[0]["id"], cats[1]["id"]
mine = ok(c.post(f"{API}/categories", json={"name": "Gym", "color": "#112233"}), 201)
ok(c.patch(f"{API}/categories/{mine['id']}", json={"name": "Gimnasio"}))

# --- Aislamiento entre usuarios
current["u"] = users["b"]
assert c.patch(f"{API}/categories/{work}", json={"name": "hack"}).status_code == 404
assert c.post(f"{API}/tasks", json={"title": "x", "category_id": work}).status_code == 404
current["u"] = users["a"]

# --- Tareas: crear, hora opcional, validación
t1 = ok(c.post(f"{API}/tasks", json={"title": " Informe ", "category_id": work, "date": str(MON), "time": "10:00", "priority": "high"}), 201)
assert t1["title"] == "Informe" and t1["status"] == "pending"
assert c.post(f"{API}/tasks", json={"title": "x", "time": "25:00"}).status_code == 422
inbox = ok(c.post(f"{API}/tasks", json={"title": "Algún día"}), 201)
assert [x["id"] for x in ok(c.get(f"{API}/tasks/inbox"))] == [inbox["id"]]

# --- Estados
ok(c.patch(f"{API}/tasks/{t1['id']}", json={"status": "done"}))
assert c.patch(f"{API}/tasks/{t1['id']}", json={"status": "postponed"}).status_code == 422, "postponed solo vía /postpone"

# --- Posponer: original queda "postponed", copia en el nuevo día con contador
t2 = ok(c.post(f"{API}/tasks", json={"title": "Llamar al banco", "date": str(MON)}), 201)
assert c.post(f"{API}/tasks/{t2['id']}/postpone", json={"date": str(MON)}).status_code == 422
cp1 = ok(c.post(f"{API}/tasks/{t2['id']}/postpone", json={"date": str(MON + timedelta(days=1))}))
cp2 = ok(c.post(f"{API}/tasks/{cp1['id']}/postpone", json={"date": str(MON + timedelta(days=2))}))
cp3 = ok(c.post(f"{API}/tasks/{cp2['id']}/postpone", json={"date": str(MON + timedelta(days=3))}))
assert cp3["postpone_count"] == 3 and cp3["postponed_from_id"] == cp2["id"]
assert c.post(f"{API}/tasks/{t2['id']}/postpone", json={}).status_code == 409
assert c.patch(f"{API}/tasks/{t2['id']}", json={"status": "done"}).status_code == 409
ok(c.patch(f"{API}/tasks/{cp3['id']}", json={"status": "not_done"}))

# --- Recurrencias: se generan al consultar, sin duplicar; borrar una instancia no la regenera
rec = ok(c.post(f"{API}/recurrences", json={"title": "Gimnasio", "category_id": health, "weekdays": [0, 2, 4], "start_date": str(MON), "time": "07:00"}), 201)
assert rec["weekdays"] == [0, 2, 4]
week1 = ok(c.get(f"{API}/tasks", params={"start": str(MON), "end": str(MON + timedelta(days=6))}))
gym = [x for x in week1 if x["recurrence_id"] == rec["id"]]
assert [x["date"] for x in gym] == [str(MON), str(MON + timedelta(days=2)), str(MON + timedelta(days=4))]
assert len(ok(c.get(f"{API}/tasks", params={"start": str(MON), "end": str(MON + timedelta(days=6))}))) == len(week1)
ok(c.delete(f"{API}/tasks/{gym[1]['id']}"), 204)
week1b = ok(c.get(f"{API}/tasks", params={"start": str(MON), "end": str(MON + timedelta(days=6))}))
assert len([x for x in week1b if x["recurrence_id"] == rec["id"]]) == 2
# Mover una instancia a otro día no la duplica
moved = ok(c.patch(f"{API}/tasks/{gym[2]['id']}", json={"date": str(MON + timedelta(days=5))}))
assert moved["recurrence_id"] is None
week1c = ok(c.get(f"{API}/tasks", params={"start": str(MON), "end": str(MON + timedelta(days=6))}))
assert len([x for x in week1c if x["title"] == "Gimnasio"]) == 2
ok(c.patch(f"{API}/tasks/{gym[0]['id']}", json={"status": "partial"}))
ok(c.patch(f"{API}/tasks/{moved['id']}", json={"status": "done"}))

# Editar la regla cambia solo las futuras pendientes
ok(c.patch(f"{API}/recurrences/{rec['id']}", params={"today": str(TODAY)}, json={"weekdays": [1], "title": "Gym"}))
week2 = ok(c.get(f"{API}/tasks", params={"start": str(MON + timedelta(days=7)), "end": str(MON + timedelta(days=13))}))
assert [(x["date"], x["title"]) for x in week2 if x["recurrence_id"] == rec["id"]] == [(str(MON + timedelta(days=8)), "Gym")]

# --- Copiar semana (sin recurrentes ni pospuestas originales)
copied = ok(c.post(f"{API}/tasks/copy-week", json={"from_start": str(MON), "to_start": str(MON + timedelta(days=7))}))
assert sorted(x["title"] for x in copied) == ["Gimnasio", "Informe", "Llamar al banco"], copied
assert all(x["status"] == "pending" for x in copied)
assert c.post(f"{API}/tasks/copy-week", json={"from_start": str(MON + timedelta(days=1)), "to_start": str(MON)}).status_code == 422

# --- Cierre del día
ok(c.put(f"{API}/reviews/{MON}", json={"energy": 4, "note": " bien "}))
r = ok(c.put(f"{API}/reviews/{MON}", json={"energy": 5}))
assert r["energy"] == 5 and r["note"] is None
assert c.put(f"{API}/reviews/{MON}", json={"energy": 9}).status_code == 422

# --- Análisis
m = ok(c.get(f"{API}/analytics", params={"start": str(MON), "end": str(MON + timedelta(days=6)), "today": str(TODAY)}))
# done: Informe, Gimnasio(movido) · partial: Gimnasio lunes · not_done: banco · postponed: 3
assert m["counts"] == {"done": 2, "partial": 1, "not_done": 1, "postponed": 3}, m["counts"]
assert m["evaluated"] == 7 and abs(m["completion_rate"] - 2.5 / 7) < 0.01
assert m["top_postponed"][0] == {"title": "Llamar al banco", "count": 3}
assert any("pospusiste 3 veces" in s for s in m["insights"]), m["insights"]
assert m["unreviewed"] == 0
# Recurrencia materializada hacia la semana actual sin marcar -> cuenta como "sin marcar"
m2 = ok(c.get(f"{API}/analytics", params={"start": str(MON + timedelta(days=7)), "end": str(TODAY), "today": str(TODAY)}))
assert m2["unreviewed"] >= 1

# --- Perfil IA: exige 2 semanas; con datos suficientes llama a la IA (simulada)
assert c.post(f"{API}/profile/generate", params={"today": str(TODAY)}).status_code == 422
db = SessionLocal()
for k in range(20):
    d = TODAY - timedelta(days=k)
    db.add(TaskItem(user_id="user-a", title=f"Tarea {k}", date=d, status="done" if k % 3 else "not_done"))
db.commit()
db.close()
calls = []
ai_profile.generate = lambda metrics: calls.append(metrics) or {"type": "Constante", "summary": "s", "reasons": ["r"], "recommendations": ["x"]}
p = ok(c.post(f"{API}/profile/generate", params={"today": str(TODAY)}))
assert p["profile"]["type"] == "Constante" and calls and "insights" in calls[0]
assert ok(c.get(f"{API}/profile"))["id"] == p["id"]
current["u"] = users["b"]
assert ok(c.get(f"{API}/profile")) is None
current["u"] = users["a"]

# --- Preferencias y cron de avisos (envío simulado)
prefs = ok(c.put(f"{API}/notifications/prefs", json={"timezone": "America/Santo_Domingo", "day_close_time": "21:00", "reminder_minutes": 15}))
assert prefs["reminder_minutes"] == 15
ok(c.post(f"{API}/push/subscribe", json={"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}), 204)
assert c.get(f"{API}/cron/notifications").status_code == 401

sent = []
fake = lambda sub, payload: sent.append(payload["tag"]) or True  # noqa: E731
db = SessionLocal()
db.add(TaskItem(user_id="user-a", title="Reunión", date=TODAY, time="15:00"))
db.commit()
# Santo Domingo = UTC-4. 14:50 local -> dentro de la ventana de 15 min
now = datetime(TODAY.year, TODAY.month, TODAY.day, 18, 50, tzinfo=timezone.utc)
res = notifications.run_due(db, fake, now)
assert res["reminders"] == 1 and res["day_close"] == 0, res
assert notifications.run_due(db, fake, now)["reminders"] == 0, "no repetir el aviso"
night = datetime(TODAY.year, TODAY.month, TODAY.day, 1, 30, tzinfo=timezone.utc) + timedelta(days=1)  # 21:30 local
assert notifications.run_due(db, fake, night)["day_close"] == 1
assert notifications.run_due(db, fake, night)["day_close"] == 0, "un cierre por día"
# Domingo 18:00 -> planificar; lunes 08:00 -> resumen
sunday = TODAY + timedelta(days=(6 - TODAY.weekday()))
assert notifications.run_due(db, fake, datetime(sunday.year, sunday.month, sunday.day, 22, 5, tzinfo=timezone.utc))["weekly_plan"] == 1
monday = sunday + timedelta(days=1)
assert notifications.run_due(db, fake, datetime(monday.year, monday.month, monday.day, 12, 5, tzinfo=timezone.utc))["weekly_summary"] == 1
# Suscripción caducada (410) se borra
notifications.run_due(db, lambda s, p: False, datetime(monday.year, monday.month, monday.day, 13, 0, tzinfo=timezone.utc) + timedelta(days=7))
db.commit()
assert db.query(TaskPushSubscription).count() == 0
assert db.get(TaskNotificationPrefs, "user-a").reminder_minutes == 15
db.close()

print("OK: checks de tareas, análisis, perfil y avisos pasaron")
