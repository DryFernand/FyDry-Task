"""Self-check de notas e índice. Ejecutar desde backend/: python tests/check_grades.py"""
import os
import sys
import tempfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'grades.db')}"
os.environ["DATABASE_POOLER_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.api.deps import CurrentUser, get_current_user  # noqa: E402
from app.core.database import db_url, init_db  # noqa: E402
from app.models.tasks import DEFAULT_GRADE_SCALE  # noqa: E402
from app.services.grades import letter_for  # noqa: E402

assert db_url.startswith("sqlite"), "las pruebas deben usar una base local"
init_db()
users = {"a": CurrentUser(id="ua", email="a@x.com", full_name="Ana"), "b": CurrentUser(id="ub", email="b@x.com", full_name="Beto")}
current = {"u": users["a"]}
app.dependency_overrides[get_current_user] = lambda: current["u"]
c = TestClient(app)
API = "/api/v1"
TODAY = date(2026, 10, 21)
T = {"today": str(TODAY)}


def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code} {r.text}"
    return r.json() if r.content else None


# --- Letras según la escala (A 90, B 80, C 70, D 60, F 0)
assert [letter_for(g, DEFAULT_GRADE_SCALE)["letter"] for g in (100, 90, 89.9, 80, 70, 69.5, 60, 59, 0)] == ["A", "A", "B", "B", "C", "D", "D", "F", "F"]


def subject(sch_id, name, credits):
    s = ok(c.post(f"{API}/schedules/{sch_id}/subjects", params=T, json={"name": name, "credits": credits}), 201)
    return {x["name"]: x for x in s["subjects"]}[name]["id"]


def grade(sid, g):
    return ok(c.put(f"{API}/subjects/{sid}/grade", json={"grade": g}))


# --- Periodo anterior (registrado como horario pasado, sin clases)
p1 = ok(c.post(f"{API}/schedules", params=T, json={"name": "2026-1", "period_type": "cuatrimestral", "start_date": "2026-01-05"}), 201)
calc, fis, ing = subject(p1["id"], "Cálculo I", 4), subject(p1["id"], "Física I", 3), subject(p1["id"], "Inglés I", 2)
r = grade(calc, 92)
assert (r["letter"], r["passed"]) == ("A", True)
grade(fis, 85)
r = grade(ing, 65)
assert (r["letter"], r["passed"]) == ("D", False), "D da 1 punto pero con 65 no se aprueba (mínimo 70)"
assert c.put(f"{API}/subjects/{calc}/grade", json={"grade": 101}).status_code == 422
current["u"] = users["b"]
assert c.put(f"{API}/subjects/{calc}/grade", json={"grade": 50}).status_code == 404
current["u"] = users["a"]

# Resumen del periodo dentro del horario: (4·4 + 3·3 + 1·2) / 9 = 27/9 = 3.00
s1 = {x["id"]: x for x in ok(c.get(f"{API}/schedules", params=T))}[p1["id"]]
assert s1["grades"]["period_index"] == 3.0 and s1["grades"]["failed"] == 1 and s1["grades"]["average"] == 80.7
assert {x["name"]: x["letter"] for x in s1["subjects"]} == {"Cálculo I": "A", "Física I": "B", "Inglés I": "D"}

# --- Periodo actual: Inglés repetido (cuentan las dos), una materia aún sin nota
p2 = ok(c.post(f"{API}/schedules", params=T, json={"name": "2026-3", "period_type": "cuatrimestral", "start_date": "2026-09-07"}), 201)
calc2, ing2, est = subject(p2["id"], "Cálculo II", 4), subject(p2["id"], "Inglés I", 2), subject(p2["id"], "Estadística", 3)
grade(calc2, 75)  # C = 2
grade(ing2, 80)   # B = 3
m = ok(c.get(f"{API}/grades/analytics", params=T))
# Acumulado: (27 + 2·4 + 3·2) / (9 + 6) = 41/15 = 2.73
assert m["cumulative_index"] == 2.73, m["cumulative_index"]
assert [e["period_index"] for e in m["evolution"]] == [3.0, 2.33]
assert [e["cumulative_index"] for e in m["evolution"]] == [3.0, 2.73]
assert m["letters"] == {"A": 1, "B": 2, "C": 1, "D": 1, "F": 0}
assert (m["courses"], m["passed"], m["failed"]) == (5, 4, 1)
assert (m["credits_attempted"], m["credits_passed"]) == (15, 13)
assert m["in_progress"] == 1 and m["average"] == 79.4
assert any("reprobada" in s for s in m["insights"]) and any("Cálculo I" in s for s in m["insights"])

# Quitar una nota vuelve la materia a "en curso"
grade(calc2, None)
assert ok(c.get(f"{API}/grades/analytics", params=T))["in_progress"] == 2
grade(calc2, 75)

# Materia de un periodo terminado sin nota -> pendiente
sin_nota = subject(p1["id"], "Química", 3)
m = ok(c.get(f"{API}/grades/analytics", params=T))
assert [p["name"] for p in m["pending_grades"]] == ["Química"]
ok(c.delete(f"{API}/subjects/{sin_nota}"), 204)

# --- Historial manual como punto de partida: (3.5·30 + 41) / 45 = 146/45 = 3.24
PID = ok(c.get(f"{API}/programs"))[0]["id"]
assert p2["program_id"] == PID, "sin carrera, el horario va a la principal"
assert c.put(f"{API}/programs/{PID}", json={"prior_index": 3.5}).status_code == 422, "índice sin créditos"
assert c.put(f"{API}/programs/{PID}", json={"prior_courses": 3, "prior_passed": 3, "prior_failed": 1}).status_code == 422
ok(c.put(f"{API}/programs/{PID}", json={"prior_index": 3.5, "prior_credits": 30, "prior_courses": 10, "prior_passed": 10, "prior_failed": 0}))
m = ok(c.get(f"{API}/grades/analytics", params=T))
assert m["cumulative_index"] == 3.24 and m["app_index"] == 2.73, (m["cumulative_index"], m["app_index"])
assert (m["courses"], m["passed"], m["credits_attempted"]) == (15, 14, 45)
assert m["credits_passed"] == 43, "sin reprobadas en el historial, sus 30 créditos cuentan como aprobados"
assert [e["cumulative_index"] for e in m["evolution"]] == [round((105 + 27) / 39, 2), 3.24]
ok(c.put(f"{API}/programs/{PID}", json={"prior_failed": 2}))
assert ok(c.get(f"{API}/grades/analytics", params=T))["credits_passed"] is None, "con reprobadas en el historial no se sabe"
ok(c.put(f"{API}/programs/{PID}", json={"prior_index": None, "prior_credits": None, "prior_courses": None, "prior_passed": None, "prior_failed": None}))
assert ok(c.get(f"{API}/grades/analytics", params=T))["cumulative_index"] == 2.73

# --- Escala y mínimo editables
assert c.put(f"{API}/programs/{PID}", json={"scale": [{"letter": "A", "min": 90, "points": 4}, {"letter": "B", "min": 80, "points": 3}]}).status_code == 422, "falta tramo desde 0"
assert c.put(f"{API}/programs/{PID}", json={"scale": [{"letter": "A", "min": 90, "points": 4}, {"letter": "a", "min": 0, "points": 0}]}).status_code == 422, "letras repetidas"
ok(c.put(f"{API}/programs/{PID}", json={"pass_min": 65, "scale": [
    {"letter": "A", "min": 90, "points": 4}, {"letter": "B", "min": 80, "points": 3}, {"letter": "C", "min": 65, "points": 2}, {"letter": "F", "min": 0, "points": 0}]}))
m = ok(c.get(f"{API}/grades/analytics", params=T))
assert m["failed"] == 0 and m["letters"]["C"] == 2, "con mínimo 65 y C desde 65, Inglés I (65) aprueba con C"
current["u"] = users["b"]
assert ok(c.get(f"{API}/grades/analytics", params=T))["courses"] == 0
assert ok(c.get(f"{API}/programs"))[0]["pass_min"] == 70
assert c.put(f"{API}/programs/{PID}", json={"name": "Robada"}).status_code == 404

# --- Carrera: lo que falta, metas de honores y requisitos
# 3 materias de 4 créditos: A, B, A -> 44 puntos-crédito en 12 créditos (3.67). Pénsum 40 créditos / 10 materias.
current["u"] = CurrentUser(id="uc", email="c@x.com", full_name="Cira")
CID = ok(c.get(f"{API}/programs"))[0]["id"]
ok(c.put(f"{API}/programs/{CID}", json={"name": "Software", "institution": "ITLA", "total_credits": 40, "total_subjects": 10, "target_index": 3.0}))
pc = ok(c.post(f"{API}/schedules", params=T, json={"name": "2026-1", "start_date": "2026-01-05"}), 201)
for name, g in (("Prog I", 95), ("Redes", 85), ("BD", 95)):
    grade(subject(pc["id"], name, 4), g)
pl = ok(c.get(f"{API}/grades/analytics", params=T))["plan"]
assert (pl["credits_remaining"], pl["subjects_remaining"], pl["periods_left"], pl["progress"]) == (28, 7, 3, 0.3), pl
assert pl["eligible"] and [r["status"] for r in pl["requirements"]] == ["ok", "ok", "unknown", "ok"], pl["requirements"]
t = {x["name"]: x for x in pl["targets"]}
assert list(t) == ["Summa Cum Laude", "Magna Cum Laude", "Cum Laude", "Índice deseado"]
# Summa: (3.8·40 − 44) / 28 = 3.86 > 3.67 actual; margen 44 + 4·28 − 152 = 4 puntos-crédito -> 4 créditos en B o 2 en C
assert (t["Summa Cum Laude"]["needed"], t["Summa Cum Laude"]["status"]) == (3.86, "exigente")
assert [(x["letter"], x["credits"], x["subjects"]) for x in t["Summa Cum Laude"]["margins"]] == [("B", 4, 1), ("C", 2, 0)], "D no aprueba: no cuenta como margen"
assert (t["Magna Cum Laude"]["needed"], t["Magna Cum Laude"]["status"]) == (3.43, "en_camino")
assert t["Magna Cum Laude"]["margins"][0]["credits"] == 16
assert t["Índice deseado"]["needed"] == 2.71
probs = [t[k]["probability"] for k in ("Summa Cum Laude", "Magna Cum Laude", "Cum Laude", "Índice deseado")]
assert probs == sorted(probs) and 10 < probs[0] < 35 and probs[-1] > 90, probs
cur = ok(c.post(f"{API}/schedules", params=T, json={"name": "2026-3", "start_date": "2026-09-07"}), 201)
subject(cur["id"], "Redes II", 4)
assert ok(c.get(f"{API}/grades/analytics", params=T))["plan"]["periods_used"] == 1, "el periodo en curso no cuenta como terminado"
ok(c.delete(f"{API}/schedules/{cur['id']}"), 204)
assert any("Te faltan 28 créditos (7 materias)" in s for s in ok(c.get(f"{API}/grades/analytics", params=T))["insights"])

# Una F descalifica los honores, pero el índice deseado se sigue calculando
f = subject(pc["id"], "Física", 4)
grade(f, 50)
m = ok(c.get(f"{API}/grades/analytics", params=T))
t = {x["name"]: x for x in m["plan"]["targets"]}
assert not m["plan"]["eligible"] and m["plan"]["requirements"][0]["status"] == "fail"
assert t["Cum Laude"]["status"] == "descalificado" and t["Cum Laude"]["probability"] == 0
assert (t["Índice deseado"]["needed"], t["Índice deseado"]["status"]) == (3.14, "exigente"), t["Índice deseado"]  # (3·44 − 44) / 28
ok(c.delete(f"{API}/subjects/{f}"), 204)

# Condición de prueba, convalidaciones y tiempo máximo
ok(c.put(f"{API}/programs/{CID}", json={"probation_min": 3.7}))
assert ok(c.get(f"{API}/grades/analytics", params=T))["plan"]["requirements"][1]["status"] == "fail"
ok(c.put(f"{API}/programs/{CID}", json={"probation_min": 2.0, "transfer_credits": 25}))
pl = ok(c.get(f"{API}/grades/analytics", params=T))["plan"]
assert pl["credits_remaining"] == 3 and pl["requirements"][3]["status"] == "fail", "38% en la institución < 50%"
assert c.put(f"{API}/programs/{CID}", json={"transfer_credits": 50}).status_code == 422
ok(c.put(f"{API}/programs/{CID}", json={"transfer_credits": None, "max_periods": 3}))
assert ok(c.get(f"{API}/grades/analytics", params=T))["plan"]["requirements"][2]["status"] == "warn", "1 usado + 3 por delante > 3"
ok(c.put(f"{API}/programs/{CID}", json={"prior_periods": 3}))
assert ok(c.get(f"{API}/grades/analytics", params=T))["plan"]["requirements"][2]["status"] == "fail"

# Meta imposible: dice hasta dónde llegarías con todo A
ok(c.put(f"{API}/programs/{CID}", json={"total_credits": 14, "total_subjects": None, "honors": [{"name": "Summa", "min": 3.9}]}))
t = ok(c.get(f"{API}/grades/analytics", params=T))["plan"]["targets"][0]
assert (t["status"], t["final_if_all"]) == ("descalificado", 3.71), t  # tiempo excedido; (44 + 8) / 14
ok(c.put(f"{API}/programs/{CID}", json={"prior_periods": None, "max_periods": None}))
assert ok(c.get(f"{API}/grades/analytics", params=T))["plan"]["targets"][0]["status"] == "imposible"

# Varias carreras: cada una con sus horarios e índice
idi = ok(c.post(f"{API}/programs", json={"name": "Inglés", "institution": "Instituto"}), 201)
assert c.post(f"{API}/programs", json={"institution": "x"}).status_code == 422
pi = ok(c.post(f"{API}/schedules", params=T, json={"name": "Nivel 1", "program_id": idi["id"], "start_date": "2026-01-05"}), 201)
grade(subject(pi["id"], "Inglés 1", 2), 70)
assert ok(c.get(f"{API}/grades/analytics", params={**T, "program_id": idi["id"]}))["cumulative_index"] == 2.0
assert ok(c.get(f"{API}/grades/analytics", params=T))["cumulative_index"] == 3.67, "la principal no mezcla la otra carrera"
assert c.delete(f"{API}/programs/{idi['id']}").status_code == 409, "tiene horarios"
ok(c.patch(f"{API}/schedules/{pi['id']}", params=T, json={"program_id": CID}))
ok(c.delete(f"{API}/programs/{idi['id']}"), 204)
assert c.delete(f"{API}/programs/{CID}").status_code == 409, "la única carrera"
assert c.get(f"{API}/grades/analytics", params={**T, "program_id": PID}).status_code == 404, "carrera de otro usuario"

print("OK: checks de notas e índice pasaron")
