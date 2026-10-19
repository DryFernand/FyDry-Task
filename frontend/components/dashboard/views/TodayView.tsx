"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CalendarPlus, Inbox, Loader2, Moon, Plus, SlidersHorizontal, Sun } from "lucide-react";
import TaskRow from "../TaskRow";
import { TaskFormTarget } from "../TaskFormModal";
import { useLoad } from "../useLoad";
import { addDays, api, Category, dayScore, formatDay, STATUS_META, Task, todayISO } from "@/lib/tasks";

const ORDER: Task["status"][] = ["done", "partial", "not_done", "postponed"];

function byTime(a: Task, b: Task) {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.position - b.position;
}

export default function TodayView({
  categories,
  refreshKey,
  onError,
  openForm,
  openClose,
}: {
  categories: Category[];
  refreshKey: number;
  onError: (m: string) => void;
  openForm: (t: TaskFormTarget) => void;
  openClose: (date: string) => void;
}) {
  const today = todayISO();
  const [quick, setQuick] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInbox, setShowInbox] = useState(false);

  const day = useLoad(() => api.tasks(today, today), [today], refreshKey, onError);
  const past = useLoad(() => api.tasks(addDays(today, -7), addDays(today, -1)), [today], refreshKey, onError);
  const inbox = useLoad(() => api.inbox(), [], refreshKey, onError);

  const tasks = useMemo(() => day.data ?? [], [day.data]);
  const pendingList = tasks.filter((t) => t.status === "pending").sort(byTime);
  const markedList = tasks.filter((t) => t.status !== "pending").sort(byTime);
  const score = dayScore(tasks);
  const unmarkedPast = (past.data ?? []).filter((t) => t.status === "pending");
  const oldestUnmarked = unmarkedPast.map((t) => t.date!).sort()[0];
  const catOf = (id: string | null) => categories.find((c) => c.id === id);
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

  const rowProps = { onChanged: reloadAll, onEdit: (t: Task) => openForm({ kind: "edit", task: t }), onError };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            <Sun className="w-3.5 h-3.5" aria-hidden="true" /> Mi día
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">{formatDay(today)}</h1>
        </div>
        <button
          type="button"
          onClick={() => openClose(today)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer"
        >
          <Moon className="w-3.5 h-3.5" /> Cierre del día
        </button>
      </div>

      {oldestUnmarked && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200/70">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Tienes <strong>{unmarkedPast.length}</strong> {unmarkedPast.length === 1 ? "tarea" : "tareas"} sin marcar de días anteriores.
            </span>
          </div>
          <button type="button" onClick={() => openClose(oldestUnmarked)} className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold cursor-pointer hover:bg-amber-100">
            Revisar {formatDay(oldestUnmarked, { weekday: "short", day: "numeric" })}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5 order-2 lg:order-1">
          <form onSubmit={addQuick} className="flex gap-2">
            <label htmlFor="quick-add" className="sr-only">Nueva tarea para hoy</label>
            <input
              id="quick-add"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              maxLength={200}
              placeholder="Agregar tarea para hoy y pulsa Enter"
              className="flex-1 min-w-0 px-4 py-3 rounded-2xl border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
            <button type="submit" disabled={adding} aria-label="Agregar" className="px-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer disabled:opacity-60">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => openForm({ kind: "new", date: today })} aria-label="Nueva tarea con opciones" title="Más opciones" className="px-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 cursor-pointer">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </form>

          {day.loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
          ) : tasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center">
              <CalendarPlus className="w-8 h-8 mx-auto text-emerald-700" aria-hidden="true" />
              <h2 className="mt-3 text-base font-bold text-zinc-900">Tu día está libre</h2>
              <p className="mt-1 text-sm text-zinc-500">Agrega lo que harás hoy o tráelo de tu bandeja &quot;Sin fecha&quot;.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {pendingList.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Por hacer · {pendingList.length}</h2>
                  {pendingList.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}
                </section>
              )}
              {markedList.length > 0 && (
                <section className="space-y-2">
                  <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Marcadas · {markedList.length}</h2>
                  {markedList.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}
                </section>
              )}
            </div>
          )}

        </div>
        <aside className="space-y-5 order-1 lg:order-2 lg:sticky lg:top-6">
          {/* Progreso del día: barra apilada por estado, con leyenda en texto */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] text-zinc-500 font-medium">Cumplimiento de hoy</div>
                <div className="text-3xl font-bold tracking-tight text-zinc-950 tabular-nums">
                  {score.rate === null ? "—" : `${Math.round(score.rate * 100)}%`}
                </div>
              </div>
              <div className="text-xs text-zinc-500 text-right">
                <span className="font-semibold text-zinc-900">{score.marked}</span> de {score.total} marcadas
              </div>
            </div>
            <div className="mt-3 flex h-2.5 w-full gap-[2px] rounded-full overflow-hidden bg-zinc-100" role="img" aria-label="Tareas por estado">
              {ORDER.map((s) => {
                const n = tasks.filter((t) => t.status === s).length;
                return n ? <div key={s} style={{ width: `${(n / Math.max(score.total, 1)) * 100}%`, background: STATUS_META[s as keyof typeof STATUS_META].color }} title={`${STATUS_META[s as keyof typeof STATUS_META].label}: ${n}`} /> : null;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
              {ORDER.map((s) => {
                const n = tasks.filter((t) => t.status === s).length;
                const meta = STATUS_META[s as keyof typeof STATUS_META];
                return (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
                    {meta.label} <span className="font-semibold text-zinc-800">{n}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <section className="rounded-3xl border border-zinc-200/80 bg-white">
            <button type="button" onClick={() => setShowInbox(!showInbox)} aria-expanded={showInbox} className="w-full flex items-center justify-between p-4 text-xs font-semibold text-zinc-700 cursor-pointer lg:cursor-default">
              <span className="inline-flex items-center gap-2"><Inbox className="w-4 h-4 text-zinc-400" /> Sin fecha · {inbox.data?.length ?? 0}</span>
              <span className="text-zinc-400 lg:hidden">{showInbox ? "Ocultar" : "Ver"}</span>
            </button>
            {(
              <div className={`px-4 pb-4 space-y-2 ${showInbox ? "" : "hidden lg:block"}`}>
                {(inbox.data ?? []).length === 0 && <p className="text-xs text-zinc-400">Nada en la bandeja.</p>}
                {(inbox.data ?? []).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-2xl border border-zinc-200/80">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catOf(t.category_id)?.color ?? "#d4d4d8" }} aria-hidden="true" />
                    <button type="button" onClick={() => openForm({ kind: "edit", task: t })} className="flex-1 min-w-0 text-left text-sm text-zinc-800 truncate cursor-pointer">{t.title}</button>
                    <button type="button" onClick={() => planToday(t)} className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold cursor-pointer hover:bg-emerald-100">
                      Hoy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
