"""Self-check de tareas, análisis, perfil IA y avisos. Ejecutar desde backend/: python tests/check_tasks.py"""
import json
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

# --- Copiar semana (sin las pospuestas originales: su copia ya está en otro día)
copied = ok(c.post(f"{API}/tasks/copy-week", json={"from_start": str(MON), "to_start": str(MON + timedelta(days=7))}))
assert sorted(x["title"] for x in copied) == ["Informe", "Llamar al banco"], copied
assert all(x["status"] == "pending" for x in copied)
assert c.post(f"{API}/tasks/copy-week", json={"from_start": str(MON + timedelta(days=1)), "to_start": str(MON)}).status_code == 422

D = lambda n: str(MON + timedelta(days=n))  # noqa: E731

# --- Hábitos: "ya lo tengo" (recordatorio) y "en construcción" (evaluado)
cama = ok(c.post(f"{API}/habits", json={"title": "Arreglar la cama", "weekdays": [0, 1, 2, 3, 4, 5, 6], "start_date": D(0)}), 201)
assert cama["kind"] == "established" and cama["period_days"] is None
assert c.post(f"{API}/habits", json={"title": "x", "weekdays": [1], "kind": "building", "start_date": D(0)}).status_code == 422
gym = ok(c.post(f"{API}/habits", json={"title": "Gimnasio", "weekdays": [1, 3], "kind": "building", "start_date": D(0), "period_days": 14, "time": "07:00", "category_id": health}), 201)
ag = ok(c.get(f"{API}/agenda", params={"start": D(0), "end": D(6), "today": str(TODAY)}))
assert [e["date"] for e in ag["habit_entries"] if e["habit_id"] == gym["id"]] == [D(1), D(3)]
assert len([e for e in ag["habit_entries"] if e["habit_id"] == cama["id"]]) == 7
assert c.put(f"{API}/habits/{gym['id']}/log", json={"date": D(2), "status": "done"}).status_code == 422, "miércoles no toca"
for n in (1, 3):
    ok(c.put(f"{API}/habits/{gym['id']}/log", json={"date": D(n), "status": "done"}))
for n in (0, 1, 2):
    ok(c.put(f"{API}/habits/{cama['id']}/log", json={"date": D(n), "status": "done"}))
ok(c.put(f"{API}/habits/{cama['id']}/log", json={"date": D(2), "status": None}))  # desmarcar
ok(c.put(f"{API}/habits/{cama['id']}/log", json={"date": D(2), "status": "done"}))
current["u"] = users["b"]
assert c.put(f"{API}/habits/{gym['id']}/log", json={"date": D(1), "status": "done"}).status_code == 404
current["u"] = users["a"]

st = {h["id"]: h for h in ok(c.get(f"{API}/habits", params={"today": str(TODAY)}))}[gym["id"]]["stats"]
# Toca 4 veces en 14 días (mar/jue); meta 80% -> 4. Lleva 2 de 3 y queda 1: ya no llega
assert (st["expected_total"], st["expected_so_far"], st["done"], st["needed"], st["on_track"]) == (4, 3, 2, 4, False), st
ok(c.put(f"{API}/habits/{gym['id']}/log", json={"date": D(8), "status": "done"}))

# Terminado el periodo con 3/4 = 75% < 80% -> necesita reajuste
hs_after = {h["id"]: h for h in ok(c.get(f"{API}/habits", params={"today": D(14)}))}
assert hs_after[gym["id"]]["status"] == "needs_adjust" and hs_after[gym["id"]]["last_rate"] == 0.75
assert not [e for e in ok(c.get(f"{API}/agenda", params={"start": D(14), "end": D(20), "today": D(14)}))["habit_entries"] if e["habit_id"] == gym["id"]]
# Extender 7 días y cumplir todo -> se convierte en hábito real
ext = ok(c.post(f"{API}/habits/{gym['id']}/extend", json={"days": 7}))
assert ext["status"] == "active" and ext["period_days"] == 21 and ext["adjustments"] == 1
for n in (10, 15, 17):
    ok(c.put(f"{API}/habits/{gym['id']}/log", json={"date": D(n), "status": "done"}))
done_h = {h["id"]: h for h in ok(c.get(f"{API}/habits", params={"today": D(21)}))}[gym["id"]]
assert done_h["kind"] == "established" and done_h["consolidated_on"] == D(21) and done_h["status"] == "active", done_h
assert [e["date"] for e in ok(c.get(f"{API}/agenda", params={"start": D(22), "end": D(28), "today": D(22)}))["habit_entries"] if e["habit_id"] == gym["id"]] == [D(22), D(24)]

# Reiniciar un hábito que no se logró
leer = ok(c.post(f"{API}/habits", json={"title": "Leer", "weekdays": [0, 1, 2, 3, 4], "kind": "building", "start_date": D(0), "period_days": 7, "target_rate": 0.9}), 201)
assert {h["id"]: h for h in ok(c.get(f"{API}/habits", params={"today": D(8)}))}[leer["id"]]["status"] == "needs_adjust"
rs = ok(c.post(f"{API}/habits/{leer['id']}/restart", json={"start_date": D(8), "period_days": 14}))
assert rs["status"] == "active" and rs["start_date"] == D(8) and rs["evaluated_on"] is None
assert c.post(f"{API}/habits/{cama['id']}/extend", json={"days": 7}).status_code == 422
tmp = ok(c.post(f"{API}/habits", json={"title": "Temporal", "weekdays": [0], "start_date": D(0)}), 201)
ok(c.put(f"{API}/habits/{tmp['id']}/log", json={"date": D(0), "status": "done"}))
ok(c.delete(f"{API}/habits/{tmp['id']}"), 204)

# --- Retos: la nota del resultado es obligatoria
r1 = ok(c.post(f"{API}/challenges", json={"title": "Caminar 10k en 30 min", "date": str(TODAY), "time": "06:00"}), 201)
assert c.post(f"{API}/challenges/{r1['id']}/result", json={"status": "achieved"}).status_code == 422
assert c.post(f"{API}/challenges/{r1['id']}/result", json={"status": "achieved", "note": "  "}).status_code == 422
got = ok(c.post(f"{API}/challenges/{r1['id']}/result", json={"status": "partial", "note": " Corrí 10k pero en 40 min "}))
assert got["status"] == "partial" and got["result_note"] == "Corrí 10k pero en 40 min"
undo = ok(c.post(f"{API}/challenges/{r1['id']}/result", json={"status": "pending"}))
assert undo["result_note"] is None and undo["status_at"] is None
ok(c.post(f"{API}/challenges/{r1['id']}/result", json={"status": "achieved", "note": "10k en 29 min"}))
r2 = ok(c.post(f"{API}/challenges", json={"title": "Sin azúcar hoy", "date": D(0)}), 201)
ok(c.post(f"{API}/challenges/{r2['id']}/result", json={"status": "failed", "note": "Comí postre"}))
assert len(ok(c.get(f"{API}/challenges", params={"start": D(0), "end": str(TODAY)}))) == 2

# --- Cierre del día
ok(c.put(f"{API}/reviews/{MON}", json={"energy": 4, "note": " bien "}))
r = ok(c.put(f"{API}/reviews/{MON}", json={"energy": 5}))
assert r["energy"] == 5 and r["note"] is None
assert c.put(f"{API}/reviews/{MON}", json={"energy": 9}).status_code == 422

# --- Análisis
full = ok(c.get(f"{API}/analytics", params={"start": str(MON), "end": str(MON + timedelta(days=6)), "today": str(TODAY)}))
m = full["tasks"]
# done: Informe · not_done: banco · postponed: 3
assert m["counts"] == {"done": 1, "partial": 0, "not_done": 1, "postponed": 3}, m["counts"]
assert m["evaluated"] == 5 and abs(m["completion_rate"] - 1 / 5) < 0.01
assert m["top_postponed"][0] == {"title": "Llamar al banco", "count": 3}
assert any("pospusiste 3 veces" in s for s in m["insights"]), m["insights"]
assert m["unreviewed"] == 0
# Hábitos de esa semana: cama 3/7 + gimnasio 2/2
h = full["habits"]
assert (h["expected"], h["done"]) == (9, 5), (h["expected"], h["done"])
assert full["challenges"]["counts"] == {"achieved": 0, "partial": 0, "failed": 1}
assert set(full["overview"]) >= {"tasks_rate", "habits_rate", "challenges_rate", "active_days", "first_day"}
# La semana actual tiene la copia de "Informe" sin marcar -> cuenta como "sin marcar"
m2 = ok(c.get(f"{API}/analytics", params={"start": str(MON + timedelta(days=7)), "end": str(TODAY), "today": str(TODAY)}))
assert m2["tasks"]["unreviewed"] >= 1
assert m2["challenges"]["counts"]["achieved"] == 1

# --- Perfil IA: exige 2 semanas; con datos suficientes llama a la IA (simulada)
assert c.post(f"{API}/profile/generate", params={"today": str(TODAY)}).status_code == 422
db = SessionLocal()
for k in range(20):
    d = TODAY - timedelta(days=k)
    db.add(TaskItem(user_id="user-a", title=f"Tarea {k}", date=d, status="done" if k % 3 else "not_done"))
db.commit()
db.close()
calls = []
real_compact = ai_profile._compact
ai_profile.generate = lambda metrics: calls.append(metrics) or {"type": "Constante", "summary": "s", "reasons": ["r"], "recommendations": ["x"]}
p = ok(c.post(f"{API}/profile/generate", params={"today": str(TODAY)}))
assert p["profile"]["type"] == "Constante" and calls and {"tasks", "habits", "challenges"} <= set(calls[0])
compact = json.dumps(real_compact(calls[0]), ensure_ascii=False)
assert "Gimnasio" in compact and "29 min" not in compact, "las notas de retos no se envían a la IA"
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
assert res["habit_results"] == 1 and "habit-eval-" + gym["id"] in sent, "aviso: Gimnasio ya es hábito"
assert notifications.run_due(db, fake, now)["habit_results"] == 0
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

print("OK: checks de tareas, hábitos, retos, análisis, perfil y avisos pasaron")
