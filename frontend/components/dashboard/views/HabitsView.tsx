"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Hammer, Loader2, MoreHorizontal, Pencil, PartyPopper, Plus, Repeat, RotateCcw, Timer, Trash2 } from "lucide-react";
import { useDash } from "../DashContext";
import { useLoad } from "../useLoad";
import { addDays, api, formatDay, Habit, todayISO, WEEKDAY_SHORT } from "@/lib/tasks";

const pct = (r: number | null | undefined) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const daysLabel = (w: number[]) => (w.length === 7 ? "Todos los días" : w.map((d) => WEEKDAY_SHORT[d]).join(", "));

function Menu({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const { actions, onError, onInfo } = useDash();
  const [open, setOpen] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setOpen(false);
    try {
      await fn();
      onInfo(ok);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Algo salió mal.");
    }
  };
  const archived = habit.status === "archived";
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-label="Opciones del hábito" aria-expanded={open} className="p-1 rounded-lg text-zinc-300 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-40 p-1 rounded-xl bg-white border border-zinc-200 shadow-lg text-xs">
          {!archived && (
            <button type="button" onClick={() => { setOpen(false); actions.editHabit(habit); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 cursor-pointer"><Pencil className="w-3.5 h-3.5" /> Editar</button>
          )}
          <button type="button" onClick={() => run(() => api.updateHabit(habit.id, { status: archived ? "active" : "archived" }), archived ? "Hábito restaurado." : "Hábito archivado.")} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 cursor-pointer">
            {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} {archived ? "Restaurar" : "Archivar"}
          </button>
          <button type="button" onClick={() => window.confirm(`¿Eliminar "${habit.title}" y todo su historial?`) && run(() => api.deleteHabit(habit.id), "Hábito eliminado.")} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

/** Barra del periodo de adaptación con la marca de la meta. */
function BuildProgress({ h }: { h: Habit }) {
  const s = h.stats!;
  const total = s.expected_total || 1;
  return (
    <div>
      <div className="relative h-3 rounded-full bg-zinc-100 overflow-hidden" role="img" aria-label={`${s.done} de ${s.expected_total} repeticiones; meta ${s.needed}`}>
        <div className="h-full rounded-r-[4px] bg-emerald-700" style={{ width: `${Math.min(100, ((s.done ?? 0) / total) * 100)}%` }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-900" style={{ left: `${((s.needed ?? 0) / total) * 100}%` }} title={`Meta: ${s.needed}`} />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[11px] text-zinc-500">
        <span><strong className="text-zinc-900">{s.done}</strong> de {s.expected_total} hechas · meta {s.needed} ({Math.round(h.target_rate * 100)}%)</span>
        <span>{s.days_left ? `Faltan ${s.days_left} días` : "Último día"}</span>
      </div>
    </div>
  );
}

function HabitCard({ h, onDone }: { h: Habit; onDone: () => void }) {
  const { catOf } = useDash();
  const s = h.stats;
  const cat = catOf(h.category_id);
  return (
    <article className="p-4 rounded-3xl bg-white border border-zinc-200/80 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 break-words">{h.title}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {daysLabel(h.weekdays)}{h.time ? ` · ${h.time}` : ""}{cat ? ` · ${cat.name}` : ""}
          </p>
        </div>
        <Menu habit={h} onDone={onDone} />
      </div>
      {h.kind === "building" && s?.expected_total ? (
        <>
          <BuildProgress h={h} />
          <p className={`text-[11px] font-medium ${s.on_track ? "text-green-700" : "text-amber-700"}`}>
            {s.on_track ? `✅ Vas en camino · ${pct(s.rate_so_far)} hasta hoy` : `⚠️ Aunque cumplas lo que queda, no llegas a la meta · ${pct(s.rate_so_far)} hasta hoy`}
            {h.adjustments > 0 && <span className="text-zinc-400 font-normal"> · reajustado {h.adjustments}×</span>}
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          <span>Últimos 30 días: <strong className="text-zinc-900">{pct(s?.rate_30d)}</strong> ({s?.done_30d ?? 0}/{s?.expected_30d ?? 0})</span>
          {h.consolidated_on && <span className="text-emerald-700 font-semibold">🏅 Construido el {formatDay(h.consolidated_on, { day: "numeric", month: "short" })}</span>}
        </div>
      )}
      {s && s.streak >= 2 && <p className="text-[11px] text-zinc-500">🔥 Racha de {s.streak} seguidas</p>}
    </article>
  );
}

function AdjustCard({ h, onDone }: { h: Habit; onDone: () => void }) {
  const { onError, onInfo } = useDash();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      onInfo(ok);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Algo salió mal.");
    } finally {
      setBusy(false);
    }
  };
  const extra = Math.max(7, Math.round((h.period_days ?? 30) / 2));
  return (
    <article className={`p-4 rounded-3xl bg-amber-50 border border-amber-200/80 space-y-3 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      <div>
        <h3 className="text-sm font-bold text-amber-950">💪 “{h.title}” aún no es un hábito</h3>
        <p className="text-xs text-amber-900 mt-1">
          En {h.period_days} días cumpliste el <strong>{pct(h.last_rate)}</strong> y la meta era {Math.round(h.target_rate * 100)}%. Te recomendamos darte más tiempo para adaptarte.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => run(() => api.extendHabit(h.id, extra), `Periodo extendido ${extra} días.`)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer">
          <Timer className="w-3.5 h-3.5" /> Extender {extra} días
        </button>
        <button type="button" onClick={() => run(() => api.restartHabit(h.id, todayISO(), h.period_days ?? 30), "Empezaste de nuevo.")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-white text-amber-900 text-xs font-semibold cursor-pointer">
          <RotateCcw className="w-3.5 h-3.5" /> Reiniciar desde hoy
        </button>
        <button type="button" onClick={() => run(() => api.updateHabit(h.id, { status: "archived" }), "Hábito archivado.")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-amber-900 text-xs font-semibold hover:bg-amber-100 cursor-pointer">
          <Archive className="w-3.5 h-3.5" /> Archivar
        </button>
      </div>
    </article>
  );
}

export default function HabitsView() {
  const { refreshKey, onError, actions } = useDash();
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, reload } = useLoad(() => api.habits(true), [], refreshKey, onError);
  const all = data ?? [];
  const today = todayISO();
  const adjust = all.filter((h) => h.status === "needs_adjust");
  const fresh = all.filter((h) => h.consolidated_on && h.consolidated_on >= addDays(today, -14) && h.status !== "archived");
  const building = all.filter((h) => h.kind === "building" && h.status === "active");
  const established = all.filter((h) => h.kind === "established" && h.status === "active");
  const archived = all.filter((h) => h.status === "archived");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider"><Repeat className="w-3.5 h-3.5" aria-hidden="true" /> Hábitos</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">Lo que haces una y otra vez</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Construye hábitos nuevos con un periodo de adaptación, o guarda los que ya tienes como recordatorio.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => actions.newHabit("established")} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Hábito que ya tengo
          </button>
          <button type="button" onClick={() => actions.newHabit("building")} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
            <Hammer className="w-3.5 h-3.5" /> Construir hábito
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : all.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <Repeat className="w-9 h-9 mx-auto text-emerald-700" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-zinc-900">Aún no tienes hábitos</h2>
          <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">Empieza por uno pequeño, como &quot;Arreglar la cama&quot;, o construye uno nuevo con un periodo de 21 o 30 días.</p>
        </div>
      ) : (
        <>
          {(adjust.length > 0 || fresh.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {adjust.map((h) => <AdjustCard key={h.id} h={h} onDone={reload} />)}
              {fresh.map((h) => (
                <article key={h.id} className="p-4 rounded-3xl bg-emerald-700 text-white">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold"><PartyPopper className="w-4 h-4" /> “{h.title}” ya es un hábito</h3>
                  <p className="text-xs text-emerald-50 mt-1">Lo cumpliste el {pct(h.last_rate)} durante su periodo de adaptación. Ahora queda en &quot;Mis hábitos&quot; como recordatorio.</p>
                </article>
              ))}
            </div>
          )}

          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900"><Hammer className="w-4 h-4 text-emerald-700" /> En construcción · {building.length}</h2>
            {building.length === 0 ? (
              <p className="text-xs text-zinc-400">Ningún hábito en construcción ahora mismo.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">{building.map((h) => <HabitCard key={h.id} h={h} onDone={reload} />)}</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900"><Repeat className="w-4 h-4 text-emerald-700" /> Mis hábitos · {established.length}</h2>
            {established.length === 0 ? (
              <p className="text-xs text-zinc-400">Aquí quedan los hábitos que ya tienes y los que construyas.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">{established.map((h) => <HabitCard key={h.id} h={h} onDone={reload} />)}</div>
            )}
          </section>

          {archived.length > 0 && (
            <section className="space-y-3">
              <button type="button" onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer">
                <Archive className="w-4 h-4" /> Archivados · {archived.length} {showArchived ? "▲" : "▼"}
              </button>
              {showArchived && <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 opacity-70">{archived.map((h) => <HabitCard key={h.id} h={h} onDone={reload} />)}</div>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
