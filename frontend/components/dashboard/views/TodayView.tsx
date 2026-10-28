"use client";

import { useState } from "react";
import { AlertCircle, CalendarPlus, GraduationCap, Inbox, Loader2, Moon, Plus, Repeat, SlidersHorizontal, Sun, Trophy } from "lucide-react";
import TaskRow from "../TaskRow";
import { ChallengeRow, ClassRow, HabitRow, KindIcon } from "../ItemRows";
import { useDash } from "../DashContext";
import { Bone, Loading, RowBones } from "../Skeleton";
import { useLoad } from "../useLoad";
import { addDays, Agenda, api, dayScore, formatDay, STATUS_META, Task, todayISO } from "@/lib/tasks";

const ORDER: Task["status"][] = ["done", "partial", "not_done", "postponed"];

export function byTime<T extends { time: string | null }>(a: T, b: T) {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return 0;
}

/** Cuántas cosas de días anteriores quedaron sin marcar (tareas, hábitos y retos). */
export function unmarkedIn(a: Agenda | null): { count: number; oldest?: string } {
  if (!a) return { count: 0 };
  const dates = [
    ...a.tasks.filter((t) => t.status === "pending").map((t) => t.date!),
    ...a.habit_entries.filter((e) => !e.status).map((e) => e.date),
    ...a.challenges.filter((c) => c.status === "pending").map((c) => c.date),
    ...(a.classes ?? []).filter((c) => !c.attendance).map((c) => c.date),
  ].sort();
  return { count: dates.length, oldest: dates[0] };
}

function Meter({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-zinc-950 tabular-nums">{value}</div>
      <div className="text-[10px] text-zinc-400">{sub}</div>
    </div>
  );
}

/** Forma de la tarjeta "Tareas de hoy" mientras carga. */
function ScoreBone() {
  return (
    <Loading label="Cargando resumen del día…" className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Bone className="h-3 w-20" />
          <Bone className="h-8 w-16" />
        </div>
        <Bone className="h-3 w-24" />
      </div>
      <Bone className="mt-3 h-2.5 w-full rounded-full" />
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {ORDER.map((s) => <Bone key={s} className="h-3 w-14" />)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60 space-y-1.5">
            <Bone className="h-2.5 w-12" />
            <Bone className="h-5 w-10" />
            <Bone className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Filas de la bandeja "Sin fecha" mientras carga. */
function InboxBones() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-2 p-2.5 rounded-2xl border border-zinc-200/80">
          <Bone className="w-2 h-2 rounded-full shrink-0" />
          <Bone className="h-3.5 flex-1" />
          <Bone className="h-6 w-11 rounded-lg" />
        </div>
      ))}
    </>
  );
}

function SectionTitle({ icon, title, count, action }: { icon: React.ReactNode; title: string; count: number | null; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900">{icon} {title} {count !== null && <span className="text-zinc-400 font-semibold">· {count}</span>}</h2>
      {action}
    </div>
  );
}

export default function TodayView() {
  const { catOf, refreshKey, onError, actions } = useDash();
  const today = todayISO();
  const [quick, setQuick] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInbox, setShowInbox] = useState(false);

  const day = useLoad(() => api.agenda(today, today), [today], refreshKey, onError);
  const past = useLoad(() => api.agenda(addDays(today, -7), addDays(today, -1)), [today], refreshKey, onError);
  const inbox = useLoad(() => api.inbox(), [], refreshKey, onError);

  const a = day.data;
  const tasks = a?.tasks ?? [];
  const habitById = new Map((a?.habits ?? []).map((h) => [h.id, h]));
  const entries = (a?.habit_entries ?? []).filter((e) => habitById.has(e.habit_id)).sort((x, y) => byTime(habitById.get(x.habit_id)!, habitById.get(y.habit_id)!));
  const challenges = [...(a?.challenges ?? [])].sort(byTime);
  const classes = a?.classes ?? [];
  const pendingTasks = tasks.filter((t) => t.status === "pending").sort(byTime);
  const markedTasks = tasks.filter((t) => t.status !== "pending").sort(byTime);
  const score = dayScore(tasks);
  const unmarked = unmarkedIn(past.data);
  const reloadAll = () => {
    day.reload();
    past.reload();
    inbox.reload();
  };

  const addQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quick.trim()) return;
    setAdding(true);
    try {
      await api.createTask({ title: quick.trim(), date: today });
      setQuick("");
      day.reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setAdding(false);
    }
  };

  const planToday = async (t: Task) => {
    try {
      await api.updateTask(t.id, { date: today });
      reloadAll();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo mover.");
    }
  };

  const rowProps = { onChanged: reloadAll, onEdit: actions.editTask, onError };
  const habitsDone = entries.filter((e) => e.status === "done").length;
  const challengesDone = challenges.filter((c) => c.status !== "pending").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            <Sun className="w-3.5 h-3.5" aria-hidden="true" /> Mi día
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">{formatDay(today)}</h1>
        </div>
        <button type="button" onClick={() => actions.openClose(today)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer">
          <Moon className="w-3.5 h-3.5" /> Cierre del día
        </button>
      </div>

      {unmarked.oldest && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/70">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Tienes <strong>{unmarked.count}</strong> {unmarked.count === 1 ? "cosa" : "cosas"} sin marcar de días anteriores (tareas, hábitos, retos o clases).</span>
          </div>
          <button type="button" onClick={() => actions.openClose(unmarked.oldest!)} className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold cursor-pointer hover:bg-amber-100">
            Revisar {formatDay(unmarked.oldest, { weekday: "short", day: "numeric" })}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
          {/* ===== Clases (informativas, con asistencia) ===== */}
          {classes.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900"><GraduationCap className="w-3.5 h-3.5 text-sky-700" aria-hidden="true" /> Clases de hoy <span className="text-zinc-400 font-semibold">· {classes.length}</span></h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {classes.map((o) => <ClassRow key={`${o.session_id}-${o.date}`} occ={o} onChanged={reloadAll} onError={onError} />)}
              </div>
            </section>
          )}

          {/* ===== Tareas ===== */}
          <section className="space-y-3">
            <SectionTitle icon={<KindIcon kind="task" />} title="Tareas" count={day.loading ? null : tasks.length} />
            <form onSubmit={addQuick} className="flex gap-2">
              <label htmlFor="quick-add" className="sr-only">Nueva tarea para hoy</label>
              <input id="quick-add" value={quick} onChange={(e) => setQuick(e.target.value)} maxLength={200} placeholder="Agregar tarea para hoy y pulsa Enter"
                className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
              <button type="submit" disabled={adding} aria-label="Agregar" className="px-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer disabled:opacity-60">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
              <button type="button" onClick={() => actions.newTask(today)} aria-label="Nueva tarea con opciones" title="Más opciones" className="px-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 cursor-pointer">
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </form>
            {day.loading ? (
              <Loading label="Cargando tareas…" className="space-y-2"><RowBones count={3} /></Loading>
            ) : tasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-6 text-center">
                <CalendarPlus className="w-7 h-7 mx-auto text-emerald-700" aria-hidden="true" />
                <p className="mt-2 text-sm text-zinc-500">Sin tareas hoy. Agrega una o tráela de tu bandeja &quot;Sin fecha&quot;.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}
                {markedTasks.length > 0 && <div className="pt-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Marcadas · {markedTasks.length}</div>}
                {markedTasks.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}
              </div>
            )}
          </section>

          {/* ===== Hábitos ===== */}
          <section className="space-y-3">
            <SectionTitle
              icon={<KindIcon kind="habit" />}
              title="Hábitos de hoy"
              count={day.loading ? null : entries.length}
              action={<button type="button" onClick={() => actions.newHabit("building", today)} className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer">+ Hábito</button>}
            />
            {day.loading ? (
              <Loading label="Cargando hábitos…" className="grid grid-cols-1 xl:grid-cols-2 gap-2"><RowBones count={2} /></Loading>
            ) : entries.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-5 text-center text-sm text-zinc-500">
                <Repeat className="w-6 h-6 mx-auto text-emerald-700 mb-1.5" aria-hidden="true" />
                Hoy no te toca ningún hábito.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {entries.map((e) => (
                  <HabitRow key={`${e.habit_id}-${e.date}`} habit={habitById.get(e.habit_id)!} entry={e} category={catOf(habitById.get(e.habit_id)!.category_id)} onChanged={reloadAll} onError={onError} onOpen={actions.editHabit} />
                ))}
              </div>
            )}
          </section>

          {/* ===== Retos ===== */}
          <section className="space-y-3">
            <SectionTitle
              icon={<KindIcon kind="challenge" />}
              title="Retos de hoy"
              count={day.loading ? null : challenges.length}
              action={<button type="button" onClick={() => actions.newChallenge(today)} className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 cursor-pointer">+ Reto</button>}
            />
            {day.loading ? (
              <Loading label="Cargando retos…" className="grid grid-cols-1 xl:grid-cols-2 gap-2"><RowBones count={2} /></Loading>
            ) : challenges.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-5 text-center text-sm text-zinc-500">
                <Trophy className="w-6 h-6 mx-auto text-amber-600 mb-1.5" aria-hidden="true" />
                ¿Te pones un reto hoy? Ej. &quot;Caminar 10k en 30 minutos&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {challenges.map((c) => <ChallengeRow key={c.id} challenge={c} category={catOf(c.category_id)} onResult={actions.reportChallenge} onEdit={actions.editChallenge} />)}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 order-1 lg:order-2 lg:sticky lg:top-6">
          {day.loading ? <ScoreBone /> : (
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-zinc-500 font-medium">Tareas de hoy</div>
                <div className="text-3xl font-bold tracking-tight text-zinc-950 tabular-nums">{score.rate === null ? "—" : `${Math.round(score.rate * 100)}%`}</div>
              </div>
              <div className="text-xs text-zinc-500 text-right"><span className="font-semibold text-zinc-900">{score.marked}</span> de {score.total} marcadas</div>
            </div>
            <div className="mt-3 flex h-2.5 w-full gap-[2px] rounded-full overflow-hidden bg-zinc-100" role="img" aria-label="Tareas por estado">
              {ORDER.map((s) => {
                const n = tasks.filter((t) => t.status === s).length;
                const meta = STATUS_META[s as keyof typeof STATUS_META];
                return n ? <div key={s} style={{ width: `${(n / Math.max(score.total, 1)) * 100}%`, background: meta.color }} title={`${meta.label}: ${n}`} /> : null;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
              {ORDER.map((s) => {
                const meta = STATUS_META[s as keyof typeof STATUS_META];
                return (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
                    {meta.label} <span className="font-semibold text-zinc-800">{tasks.filter((t) => t.status === s).length}</span>
                  </span>
                );
              })}
            </div>
            <div className={`mt-4 grid gap-2 ${classes.length ? "grid-cols-3" : "grid-cols-2"}`}>
              <Meter label="Hábitos" value={`${habitsDone}/${entries.length}`} sub="hechos hoy" />
              <Meter label="Retos" value={`${challengesDone}/${challenges.length}`} sub="con resultado" />
              {classes.length > 0 && <Meter label="Clases" value={`${classes.filter((c) => c.attendance === "attended").length}/${classes.length}`} sub="asistidas" />}
            </div>
          </div>
          )}

          <section className="rounded-3xl border border-zinc-200/80 bg-white">
            <button type="button" onClick={() => setShowInbox(!showInbox)} aria-expanded={showInbox} className="w-full flex items-center justify-between p-4 text-xs font-semibold text-zinc-700 cursor-pointer lg:cursor-default">
              <span className="inline-flex items-center gap-2"><Inbox className="w-4 h-4 text-zinc-400" /> Sin fecha{!inbox.loading && ` · ${inbox.data?.length ?? 0}`}</span>
              <span className="text-zinc-400 lg:hidden">{showInbox ? "Ocultar" : "Ver"}</span>
            </button>
            <div className={`px-4 pb-4 space-y-2 ${showInbox ? "" : "hidden lg:block"}`}>
              {inbox.loading && <Loading label="Cargando bandeja…" className="space-y-2"><InboxBones /></Loading>}
              {!inbox.loading && (inbox.data ?? []).length === 0 && <p className="text-xs text-zinc-400">Nada en la bandeja.</p>}
              {(inbox.data ?? []).map((t) => (
                <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-2xl border border-zinc-200/80">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catOf(t.category_id)?.color ?? "#d4d4d8" }} aria-hidden="true" />
                  <button type="button" onClick={() => actions.editTask(t)} className="flex-1 min-w-0 text-left text-sm text-zinc-800 truncate cursor-pointer">{t.title}</button>
                  <button type="button" onClick={() => planToday(t)} className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold cursor-pointer hover:bg-emerald-100">Hoy</button>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
