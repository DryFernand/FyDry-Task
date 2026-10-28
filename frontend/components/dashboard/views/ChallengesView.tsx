"use client";

import { useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import { ChallengeRow } from "../ItemRows";
import { useDash } from "../DashContext";
import { useLoad } from "../useLoad";
import { Bone, Loading, RowBones } from "../Skeleton";
import { addDays, api, Challenge, CHALLENGE_META, ChallengeStatus, formatDay, todayISO } from "@/lib/tasks";

type Filter = "all" | Exclude<ChallengeStatus, "pending">;

export default function ChallengesView() {
  const { catOf, refreshKey, onError, onInfo, actions } = useDash();
  const today = todayISO();
  const [filter, setFilter] = useState<Filter>("all");
  const { data, loading, reload } = useLoad(() => api.challenges(addDays(today, -89), addDays(today, 60)), [today], refreshKey, onError);
  const all = data ?? [];
  const upcoming = all.filter((c) => c.date >= today && c.status === "pending").sort((a, b) => a.date.localeCompare(b.date));
  const awaiting = all.filter((c) => c.date < today && c.status === "pending");
  const history = all.filter((c) => c.status !== "pending" && (filter === "all" || c.status === filter));
  const counts = { achieved: 0, partial: 0, failed: 0 } as Record<Exclude<ChallengeStatus, "pending">, number>;
  all.forEach((c) => c.status !== "pending" && counts[c.status]++);
  const decided = counts.achieved + counts.partial + counts.failed;

  const remove = async (c: Challenge) => {
    if (!window.confirm(`¿Eliminar el reto "${c.title}"?`)) return;
    try {
      await api.deleteChallenge(c.id);
      onInfo("Reto eliminado.");
      reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  const row = (c: Challenge) => (
    <div key={c.id} className="relative group">
      <ChallengeRow challenge={c} category={catOf(c.category_id)} onResult={actions.reportChallenge} onEdit={actions.editChallenge} />
      <button type="button" onClick={() => remove(c)} aria-label={`Eliminar ${c.title}`} className="absolute top-2.5 right-2.5 p-1 rounded-lg text-zinc-300 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const byDay = (list: Challenge[]) => {
    const groups = new Map<string, Challenge[]>();
    list.forEach((c) => groups.set(c.date, [...(groups.get(c.date) ?? []), c]));
    return [...groups.entries()];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 uppercase tracking-wider"><Trophy className="w-3.5 h-3.5" aria-hidden="true" /> Retos</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">Metas de un día</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Ponte un reto concreto y al final cuenta cómo te fue.</p>
        </div>
        <button type="button" onClick={() => actions.newChallenge(today)} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Nuevo reto
        </button>
      </div>

      {loading ? (
        <Loading label="Cargando retos…" className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
          <div className="xl:col-span-2 space-y-6">
            <section className="space-y-2">
              <Bone className="h-4 w-24" />
              <Bone className="h-2.5 w-16" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2"><RowBones count={2} /></div>
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Bone className="h-4 w-44" />
                <Bone className="h-9 w-72 max-w-full rounded-2xl" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2"><RowBones count={4} /></div>
            </section>
          </div>
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80 space-y-3">
            <Bone className="h-3 w-32" />
            <Bone className="h-8 w-16" />
            <Bone className="h-2.5 w-36" />
            <Bone className="h-3 rounded-full" />
            <div className="space-y-2">{[0, 1, 2].map((i) => <Bone key={i} className="h-3" />)}</div>
          </div>
        </Loading>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
          <div className="xl:col-span-2 space-y-6">
            {awaiting.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-bold text-amber-800">Esperan tu resultado · {awaiting.length}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{awaiting.map(row)}</div>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-zinc-900">Próximos · {upcoming.length}</h2>
              {upcoming.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
                  Sin retos por delante. Ej. &quot;Caminar 10k en 30 minutos&quot; o &quot;Leer 50 páginas&quot;.
                </div>
              ) : (
                byDay(upcoming).map(([d, list]) => (
                  <div key={d} className="space-y-2">
                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{d === today ? "Hoy" : formatDay(d)}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{list.map(row)}</div>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-zinc-900">Historial · últimos 90 días</h2>
                <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100" role="radiogroup" aria-label="Filtrar historial">
                  {(["all", "achieved", "partial", "failed"] as Filter[]).map((f) => (
                    <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${filter === f ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}>
                      {f === "all" ? "Todos" : `${CHALLENGE_META[f].emoji} ${CHALLENGE_META[f].label}`}
                    </button>
                  ))}
                </div>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-zinc-400">Aún no hay retos con resultado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{history.map(row)}</div>
              )}
            </section>
          </div>

          <aside className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80 xl:sticky xl:top-6 space-y-3">
            <h2 className="text-xs font-bold text-zinc-900">Tus resultados (90 días)</h2>
            <div className="text-3xl font-bold tabular-nums text-zinc-950">{decided ? `${Math.round(((counts.achieved + counts.partial * 0.5) / decided) * 100)}%` : "—"}</div>
            <p className="text-[11px] text-zinc-400 -mt-2">Logrado = 100%, Parcial = 50%</p>
            <div className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden bg-zinc-100" role="img" aria-label="Resultados de retos">
              {(Object.keys(CHALLENGE_META) as (keyof typeof CHALLENGE_META)[]).map((s) =>
                counts[s] ? <div key={s} title={`${CHALLENGE_META[s].label}: ${counts[s]}`} style={{ width: `${(counts[s] / decided) * 100}%`, background: CHALLENGE_META[s].color }} /> : null
              )}
            </div>
            <ul className="space-y-1.5 text-xs">
              {(Object.keys(CHALLENGE_META) as (keyof typeof CHALLENGE_META)[]).map((s) => (
                <li key={s} className="flex items-center gap-2 text-zinc-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHALLENGE_META[s].color }} aria-hidden="true" />
                  {CHALLENGE_META[s].emoji} {CHALLENGE_META[s].label}
                  <span className="ml-auto font-semibold text-zinc-900 tabular-nums">{counts[s]}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}
