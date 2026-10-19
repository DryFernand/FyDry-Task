"""Perfil de hábitos con IA. Solo recibe métricas agregadas, nunca las tareas una por una."""
import json
from typing import Dict

import httpx

from app.core.config import settings

SYSTEM_PROMPT = """Eres un analista de hábitos de productividad de la app FyDry Task.
Recibes métricas agregadas de cómo una persona planifica y cumple sus tareas.
Asígnale UN tipo de perfil y explícalo con sus datos. Responde en español, cálido y directo, sin juzgar.
No es un diagnóstico psicológico: habla de hábitos, no de personalidad clínica.

Ejemplos de tipos (puedes crear otro si encaja mejor):
- "Planificador optimista": planifica mucho más de lo que completa.
- "Arrancador": empieza mucho y deja tareas a medias.
- "Constante": cumplimiento parejo entre días y categorías.
- "Sprint de inicio de semana": fuerte al inicio, cae hacia el final.
- "Fuerte en lo urgente": cumple en trabajo/obligaciones y descuida salud o lo personal.
- "Postergador estratégico": mueve muchas tareas a otro día.

Devuelve SOLO un JSON con esta forma:
{"type": "nombre corto del tipo",
 "emoji": "un emoji",
 "summary": "2-3 frases que describan a la persona",
 "reasons": ["3 razones, cada una citando un número de las métricas"],
 "strengths": ["2 fortalezas"],
 "recommendations": ["3 recomendaciones concretas y accionables"]}"""

REQUIRED = ("type", "summary", "reasons", "recommendations")


class AiUnavailable(Exception):
    pass


def _compact(m: Dict) -> Dict:
    """Quita lo que no aporta al modelo (ids, colores) para un prompt más corto."""
    return {
        "periodo": {"inicio": m["start"], "fin": m["end"], "dias_activos": m["active_days"]},
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
