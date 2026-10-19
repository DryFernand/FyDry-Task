"use client";

import { useState } from "react";
import { BrainCircuit, CheckCircle2, Info, Loader2, RefreshCw, Sparkles, Star } from "lucide-react";
import { useLoad } from "../useLoad";
import { AiProfile, api, formatDay } from "@/lib/tasks";

const p100 = (r: number | null | undefined) => (r == null ? "—" : `${Math.round(r * 100)}%`);

/** Línea de contexto del perfil. Los perfiles anteriores solo tenían métricas de tareas. */
function periodSummary(m: AiProfile["metrics"]): string {
  if (!m.overview) {
    const old = m as unknown as { evaluated?: number; completion_rate?: number | null };
    return `${old.evaluated ?? 0} tareas · ${p100(old.completion_rate)} de cumplimiento`;
  }
  return `Tareas ${p100(m.overview.tasks_rate)} · Hábitos ${p100(m.overview.habits_rate)} · Retos ${p100(m.overview.challenges_rate)}`;
}

export default function ProfileView({ refreshKey, onError }: { refreshKey: number; onError: (m: string) => void }) {
  const { data, loading, reload } = useLoad<AiProfile | null>(() => api.profile(), [], refreshKey, onError);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  const generate = async () => {
    setGenerating(true);
    setNotice("");
    try {
      await api.generateProfile();
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo generar el perfil.");
    } finally {
      setGenerating(false);
    }
  };

  const p = data?.profile;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            <BrainCircuit className="w-3.5 h-3.5" aria-hidden="true" /> Perfil con IA
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">¿Qué tipo de persona eres?</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Analiza tus tareas, hábitos y retos de las últimas 4 semanas. Se recomienda actualizarlo cada semana.</p>
        </div>
        <button type="button" onClick={generate} disabled={generating} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-60">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? "Analizando…" : p ? "Actualizar perfil" : "Generar mi perfil"}
        </button>
      </div>

      {notice && (
        <div className="flex gap-2 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/70 text-xs text-amber-900" role="status">
          <Info className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : !p ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <BrainCircuit className="w-9 h-9 mx-auto text-emerald-700" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-zinc-900">Aún no tienes perfil</h2>
          <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">
            Cuando lleves al menos 2 semanas marcando tus tareas, hábitos y retos, la IA revisará tus métricas y te dirá qué tipo de persona eres y por qué.
          </p>
        </div>
      ) : (
        <>
          <section className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-emerald-700 text-white">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="relative">
              <div className="text-4xl" aria-hidden="true">{p.emoji ?? "✨"}</div>
              <div className="mt-2 text-[11px] uppercase tracking-wider text-emerald-100 font-semibold">Tu perfil</div>
              <h2 className="text-2xl sm:text-3xl font-bold">{p.type}</h2>
              <p className="mt-3 text-sm sm:text-base text-emerald-50 leading-relaxed max-w-3xl">{p.summary}</p>
              <p className="mt-4 text-[11px] text-emerald-200">
                Basado en {formatDay(data!.period_start, { day: "numeric", month: "short" })} – {formatDay(data!.period_end, { day: "numeric", month: "short" })} ·{" "}
                {periodSummary(data!.metrics)}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <section className="p-5 rounded-3xl bg-white border border-zinc-200/80">
              <h3 className="text-xs font-bold text-zinc-900 mb-3">¿Por qué?</h3>
              <ul className="space-y-2.5">
                {p.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
            </section>
            {!!p.strengths?.length && (
              <section className="p-5 rounded-3xl bg-white border border-zinc-200/80">
                <h3 className="text-xs font-bold text-zinc-900 mb-3">Tus fortalezas</h3>
                <ul className="space-y-2.5">
                  {p.strengths.map((r) => (
                    <li key={r} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
                      <Star className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" /> {r}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="p-5 rounded-3xl bg-white border border-zinc-200/80 md:col-span-2 xl:col-span-1">
              <h3 className="text-xs font-bold text-zinc-900 mb-3">Recomendaciones</h3>
              <ul className="space-y-2.5">
                {p.recommendations.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}

      <p className="flex gap-1.5 text-[11px] text-zinc-400 leading-relaxed">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
        Es un perfil de hábitos generado por IA a partir de métricas agregadas (no de tus tareas una por una). No es un diagnóstico psicológico.
      </p>
    </div>
  );
}
