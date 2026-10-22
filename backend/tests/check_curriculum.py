"""Self-check del pénsum: pre y correquisitos y estado de cada materia. Ejecutar desde backend/: python tests/check_curriculum.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'curriculum.db')}"
os.environ["DATABASE_POOLER_URL"] = ""

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.api.deps import CurrentUser, get_current_user  # noqa: E402
from app.core.database import db_url, init_db  # noqa: E402

assert db_url.startswith("sqlite"), "las pruebas deben usar una base local"
init_db()
current = {"u": CurrentUser(id="ua", email="a@x.com", full_name="Ana")}
app.dependency_overrides[get_current_user] = lambda: current["u"]
c = TestClient(app)
API = "/api/v1"
T = {"today": "2026-10-21"}


def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code} {r.text}"
    return r.json() if r.content else None


PID = ok(c.get(f"{API}/programs"))[0]["id"]
URL = f"{API}/programs/{PID}/courses"


def course(code, name, credits, term=None, pre=(), co=(), done=False):
    return {"code": code, "name": name, "credits": credits, "term": term, "prereqs": list(pre), "coreqs": list(co), "done": done}


PENSUM = [
    course("alg", "Algoritmos", 3, 1), course("MAT1", "Cálculo I", 4, 1),
    course("MAT2", "Cálculo II", 4, 2, pre=["mat1"]), course("FIS1", "Física I", 4, 2, pre=["MAT1"], co=["LABF"]),
    course("LABF", "Laboratorio de Física", 1, 2, co=["FIS1"]), course("ING", "Inglés", 0, done=True),
]

# --- Validaciones
assert c.put(URL, params=T, json={"courses": [course("A", "x", 1), course("a", "y", 1)]}).status_code == 422, "código repetido"
assert c.put(URL, params=T, json={"courses": [course("A", "x", 1, pre=["Z"])]}).status_code == 422, "prerrequisito inexistente"
assert c.put(URL, params=T, json={"courses": [course("A", "x", 1, co=["A"])]}).status_code == 422, "de sí misma"
r = c.put(URL, params=T, json={"courses": [course("A", "x", 1, pre=["B"]), course("B", "y", 1, pre=["C"]), course("C", "z", 1, pre=["A"])]})
assert r.status_code == 422 and "círculo" in r.json()["detail"], r.text

# --- Estado inicial: códigos en mayúscula; lo sin prerrequisitos está disponible
st = {x["code"]: x for x in ok(c.put(URL, params=T, json={"courses": PENSUM}))["courses"]}
assert list(st) == ["ALG", "MAT1", "MAT2", "FIS1", "LABF", "ING"]
assert {k: v["status"] for k, v in st.items()} == {"ALG": "disponible", "MAT1": "disponible", "MAT2": "bloqueada", "FIS1": "bloqueada", "LABF": "disponible", "ING": "aprobada"}
assert st["MAT2"]["missing_prereqs"] == ["MAT1"] and st["LABF"]["pending_coreqs"] == ["FIS1"]

# --- Periodo pasado: Cálculo I enlazada (aprobada) y Algoritmos por código (reprobada)
p1 = ok(c.post(f"{API}/schedules", params=T, json={"name": "2026-1", "start_date": "2026-01-05"}), 201)
s = ok(c.post(f"{API}/schedules/{p1['id']}/subjects", params=T, json={"name": "Cálculo 1", "credits": 4, "course_id": st["MAT1"]["id"]}), 201)
assert s["subjects"][0]["course_id"] == st["MAT1"]["id"]
ok(c.put(f"{API}/subjects/{s['subjects'][0]['id']}/grade", json={"grade": 85}))
s = ok(c.post(f"{API}/schedules/{p1['id']}/subjects", params=T, json={"name": "Algoritmos", "code": "alg", "credits": 3}), 201)
ok(c.put(f"{API}/subjects/{s['subjects'][1]['id']}/grade", json={"grade": 60}))

# --- Periodo actual: Física I en curso -> su laboratorio ya no tiene correquisito pendiente
p2 = ok(c.post(f"{API}/schedules", params=T, json={"name": "2026-3", "start_date": "2026-09-07"}), 201)
ok(c.post(f"{API}/schedules/{p2['id']}/subjects", params=T, json={"name": "Física I", "credits": 4, "course_id": st["FIS1"]["id"]}), 201)
res = ok(c.get(URL, params=T))
st = {x["code"]: x for x in res["courses"]}
assert {k: v["status"] for k, v in st.items()} == {"ALG": "disponible", "MAT1": "aprobada", "MAT2": "disponible", "FIS1": "cursando", "LABF": "disponible", "ING": "aprobada"}
assert st["ALG"]["failed_before"] and st["ALG"]["grade"] == 60 and st["LABF"]["pending_coreqs"] == []
assert res["summary"] == {"total": 6, "aprobada": 2, "cursando": 1, "disponible": 3, "bloqueada": 0, "credits_total": 16, "credits_passed": 4}

# Sin totales escritos a mano, el plan de la carrera los toma del pénsum
pl = ok(c.get(f"{API}/grades/analytics", params=T))["plan"]
assert (pl["total_credits"], pl["total_subjects"]) == (16, 6), pl

# --- Guardar de nuevo conserva los enlaces; quitar una materia enlazada la desenlaza
st = {x["code"]: x for x in ok(c.put(URL, params=T, json={"courses": [course("MAT1", "Cálculo I", 4, 1), course("FIS1", "Física I", 4, 2, pre=["MAT1"])]}))["courses"]}
assert st["FIS1"]["status"] == "cursando" and st["MAT1"]["status"] == "aprobada"
ok(c.put(URL, params=T, json={"courses": [course("FIS1", "Física I", 4, 2)]}))
subs = {x["name"]: x["course_id"] for sch in ok(c.get(f"{API}/schedules", params=T)) for x in sch["subjects"]}
assert subs["Cálculo 1"] is None and subs["Física I"] is not None

# --- Una materia del pénsum de otra carrera no se puede enlazar; otro usuario no ve el pénsum
other = ok(c.post(f"{API}/programs", json={"name": "Inglés"}), 201)
oc = ok(c.put(f"{API}/programs/{other['id']}/courses", params=T, json={"courses": [course("ING1", "Inglés 1", 2)]}))["courses"][0]
assert c.post(f"{API}/schedules/{p2['id']}/subjects", params=T, json={"name": "x", "course_id": oc["id"]}).status_code == 422
current["u"] = CurrentUser(id="ub", email="b@x.com", full_name="Beto")
assert c.get(URL, params=T).status_code == 404

print("OK: checks del pénsum pasaron")
