"""Self-check de carreras por promedio (sin créditos). Ejecutar desde backend/: python tests/check_average.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'average.db')}"
os.environ["DATABASE_POOLER_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.api.deps import CurrentUser, get_current_user  # noqa: E402
from app.core.database import db_url, init_db  # noqa: E402

assert db_url.startswith("sqlite"), "las pruebas deben usar una base local"
init_db()
app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="ua", email="a@x.com", full_name="Ana")
c = TestClient(app)
API = "/api/v1"
T = {"today": "2026-10-21"}


def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code} {r.text}"
    return r.json() if r.content else None


main = ok(c.get(f"{API}/programs"))[0]["id"]
# Una carrera por créditos no acepta metas en escala 0-100
assert c.put(f"{API}/programs/{main}", params=T, json={"honors": [{"name": "Honor", "min": 95}]}).status_code == 422

eng = ok(c.post(f"{API}/programs", json={"name": "Inglés", "institution": "Instituto"}), 201)["id"]
URL = f"{API}/programs/{eng}"
ok(c.put(URL, params=T, json={"grading": "average", "plan_periods": 6, "honors": [{"name": "Excelencia", "min": 90}], "target_index": 85}))
assert c.put(URL, params=T, json={"prior_average": 80}).status_code == 422, "promedio previo sin periodos"


def period(name, start, grade=None):
    s = ok(c.post(f"{API}/schedules", params=T, json={"name": name, "program_id": eng, "start_date": start}), 201)
    if grade is not None:
        r = ok(c.put(f"{API}/schedules/{s['id']}/grade", json={"grade": grade}))
        assert r["passed"] == (grade >= 70)
    return s["id"]


n1, n2, n3 = period("Nivel 1", "2026-01-05", 88), period("Nivel 2", "2026-05-04", 92), period("Nivel 3", "2026-09-07")
# En una carrera por créditos la nota va por materia
sch_cr = ok(c.post(f"{API}/schedules", params=T, json={"name": "x", "start_date": "2026-01-05"}), 201)["id"]
assert c.put(f"{API}/schedules/{sch_cr}/grade", json={"grade": 90}).status_code == 422

A = {**T, "program_id": eng}
m = ok(c.get(f"{API}/grades/analytics", params=A))
assert m["mode"] == "average" and (m["average"], m["periods_graded"], m["passed"], m["in_progress"]) == (90.0, 2, 2, 1), m
assert [e["cumulative_average"] for e in m["evolution"]] == [88.0, 90.0]
pl = m["plan"]
assert (pl["periods_remaining"], pl["periods_used"], pl["pace"]["projected_total"], pl["pace"]["delta"]) == (4, 2, 6, 0), pl
t = {x["name"]: x for x in pl["targets"]}
# Excelencia: (90·6 − 180) / 4 = 90 = tu promedio; deseado: (85·6 − 180) / 4 = 82.5
assert (t["Excelencia"]["needed"], t["Excelencia"]["status"]) == (90.0, "en_camino")
assert (t["Promedio deseado"]["needed"], t["Promedio deseado"]["status"]) == (82.5, "en_camino")
assert pl["max_average"] == 96.7 and pl["eligible"]
assert any("Te faltan 4 de 6 periodos" in s for s in m["insights"])

# Meta imposible: con 100 en todo llegarías a (180 + 400) / 6 = 96.7
r = c.put(URL, params=T, json={"target_index": 99})
assert r.status_code == 422 and "96.7" in r.json()["detail"], r.text

# Meta de tiempo en periodos: hasta jun-2027 cabe 1 cuatrimestre después del actual -> faltan 3, quedan 2 fuera
ok(c.put(URL, params=T, json={"goal_end_date": "2027-06-30"}))
g = ok(c.get(f"{API}/grades/analytics", params=A))["plan"]["time_goal"]
assert (g["periods_available"], g["status"], g["leftover"]) == (2, "imposible", 2), g
ok(c.put(URL, params=T, json={"goal_end_date": "2028-03-01"}))
g = ok(c.get(f"{API}/grades/analytics", params=A))["plan"]["time_goal"]
assert (g["status"], len(g["periods"]), g["periods"][0]["in_progress"]) == ("posible", 4, True), g

# El periodo en curso con nota ya cuenta como terminado: lo que falta empieza después de él
ok(c.put(f"{API}/schedules/{n3}/grade", json={"grade": 90}))
pl = ok(c.get(f"{API}/grades/analytics", params=A))["plan"]
assert (pl["periods_remaining"], pl["periods_used"], pl["pace"]["projected_total"]) == (3, 3, 6), pl
assert not pl["time_goal"]["periods"][0]["in_progress"] and pl["time_goal"]["periods"][0]["start"] == "2027-01-07", pl["time_goal"]
ok(c.put(f"{API}/schedules/{n3}/grade", json={"grade": None}))

# Un periodo reprobado: no avanza, quita los honores y el deseado se recalcula: (85·7 − 148) / 5 = 89.4
ok(c.put(f"{API}/schedules/{n2}/grade", json={"grade": 60}))
pl = ok(c.get(f"{API}/grades/analytics", params=A))["plan"]
t = {x["name"]: x for x in pl["targets"]}
assert pl["periods_remaining"] == 5 and pl["pace"]["delta"] == 1 and not pl["eligible"]
assert t["Excelencia"]["status"] == "descalificado" and t["Promedio deseado"]["needed"] == 89.4, t

# Historial previo: 2 periodos con 80 -> (148 + 160) / 4 = 77
ok(c.put(URL, params=T, json={"prior_average": 80, "prior_periods": 2}))
m = ok(c.get(f"{API}/grades/analytics", params=A))
assert (m["average"], m["periods_graded"], m["plan"]["periods_used"]) == (77.0, 4, 4), m

# La carrera principal (por créditos) no se mezcla
assert ok(c.get(f"{API}/grades/analytics", params=T))["mode"] == "credits"
print("OK: checks de carreras por promedio pasaron")
