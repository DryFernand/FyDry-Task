"""Perfil de hábitos con IA. Solo recibe métricas agregadas, nunca las tareas una por una."""
import json
from typing import Dict

import httpx

from app.core.config import settings

SYSTEM_PROMPT = """Eres un analista de hábitos de productividad de la app FyDry Task.
Recibes métricas agregadas de 3 áreas de una persona: TAREAS (pendientes agendados), HÁBITOS (rutinas en días fijos;
algunos en construcción con un periodo de adaptación) y RETOS (metas de un día con resultado logrado/parcial/no logrado).
Considera las 3 áreas y cómo se relacionan (p. ej. cumple tareas pero no sostiene hábitos, o se pone retos muy altos).
Asígnale UN tipo de perfil y explícalo con sus datos. Responde en español, cálido y directo, sin juzgar.
No es un diagnóstico psicológico: habla de hábitos, no de personalidad clínica.

Ejemplos de tipos (puedes crear otro si encaja mejor):
- "Planificador optimista": planifica mucho más de lo que completa.
- "Arrancador": empieza mucho y deja tareas a medias.
- "Constante": cumplimiento parejo entre días y categorías.
- "Sprint de inicio de semana": fuerte al inicio, cae hacia el final.
- "Fuerte en lo urgente": cumple en trabajo/obligaciones y descuida salud o lo personal.
- "Postergador estratégico": mueve muchas tareas a otro día.
- "Constructor de hábitos": sostiene sus rutinas y consolida hábitos nuevos.
- "Retador ambicioso": se pone retos altos y muchos quedan en parcial.

Devuelve SOLO un JSON con esta forma:
{"type": "nombre corto del tipo",
 "emoji": "un emoji",
 "summary": "2-3 frases que describan a la persona",
 "reasons": ["3 razones, cada una citando un número de las métricas (idealmente de áreas distintas)"],
 "strengths": ["2 fortalezas"],
 "recommendations": ["3 recomendaciones concretas y accionables"]}"""

REQUIRED = ("type", "summary", "reasons", "recommendations")


class AiUnavailable(Exception):
    pass


def _compact(all_m: Dict) -> Dict:
    """Quita lo que no aporta al modelo (ids, colores) para un prompt más corto. Nunca envía notas de retos."""
    m, h, c = all_m["tasks"], all_m["habits"], all_m["challenges"]
    return {
        "periodo": {"inicio": all_m["start"], "fin": all_m["end"], "dias_activos": all_m["overview"]["active_days"]},
        "tareas": {
            "cumplimiento_total": m["completion_rate"],
            "conteos": m["counts"],
            "promedio_planificadas_por_dia": m["avg_planned_per_day"],
            "promedio_completadas_por_dia": m["avg_done_per_day"],
            "racha_actual": m["streak"],
            "mejor_racha": m["best_streak"],
            "por_dia_semana": [{"dia": r["name"], "tareas": r["count"], "cumplimiento": r["rate"]} for r in m["by_weekday"]],
            "por_categoria": [{"categoria": r["name"], "tareas": r["count"], "cumplimiento": r["rate"]} for r in m["by_category"]],
            "por_semana": m["by_week"],
            "por_franja": m["by_time_slot"],
            "energia_vs_cumplimiento": m["by_energy"],
            "mas_pospuestas": m["top_postponed"],
            "mas_a_medias": m["top_partial"],
        },
        "habitos": {
            "cumplimiento_total": h["rate"],
            "en_construccion": h["building"],
            "consolidados_en_periodo": h["consolidated_in_period"],
            "necesitan_reajuste": h["needs_adjust"],
            "ya_establecidos": h["established"],
            "por_habito": [
                {"habito": r["title"], "tipo": "en construcción" if r["kind"] == "building" else "establecido",
                 "veces_que_tocaba": r["expected"], "hechas": r["done"], "cumplimiento": r["rate"], "racha": r["streak"]}
                for r in h["habits"]
            ],
            "por_dia_semana": [{"dia": r["name"], "cumplimiento": r["rate"]} for r in h["by_weekday"]],
        },
        "retos": {
            "cumplimiento_total": c["rate"],
            "conteos": {"logrados": c["counts"]["achieved"], "parciales": c["counts"]["partial"], "no_logrados": c["counts"]["failed"]},
            "por_categoria": [{"categoria": r["name"], "retos": r["count"], "cumplimiento": r["rate"]} for r in c["by_category"]],
            "recientes": [{"reto": r["title"], "resultado": r["status"]} for r in c["recent"]],
        },
    }


def generate(metrics: Dict) -> Dict:
    if not settings.AI_API_KEY:
        raise AiUnavailable("El perfil con IA no está configurado (falta AI_API_KEY).")
    try:
        res = httpx.post(
            f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.AI_API_KEY}"},
            json={
                "model": settings.AI_MODEL,
                "temperature": 0.7,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(_compact(metrics), ensure_ascii=False)},
                ],
            },
            timeout=45.0,
        )
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"]
        profile = json.loads(content)
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        raise AiUnavailable(f"No se pudo generar el perfil: {exc.__class__.__name__}") from exc
    if not all(k in profile for k in REQUIRED):
        raise AiUnavailable("La IA devolvió un perfil incompleto. Intenta de nuevo.")
    for k in ("reasons", "strengths", "recommendations"):
        profile[k] = [str(x) for x in profile.get(k, [])][:5]
    return profile
