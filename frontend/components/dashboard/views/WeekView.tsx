"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Inbox, Loader2, Plus } from "lucide-react";
import TaskRow from "../TaskRow";
import { TaskFormTarget } from "../TaskFormModal";
import { useLoad } from "../useLoad";
import { addDays, api, Category, dayScore, formatDay, Task, todayISO, WEEKDAY_SHORT, weekStart } from "@/lib/tasks";

function byTime(a: Task, b: Task) {
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.position - b.position;
}

export default function WeekView({
  categories,
  refreshKey,
  onError,
  onInfo,
  openForm,
}: {
  categories: Category[];
  refreshKey: number;
  onError: (m: string) => void;
  onInfo: (m: string) => void;
  openForm: (t: TaskFormTarget) => void;
}) {
  const today = todayISO();
  const [start, setStart] = useState(weekStart(today));
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const week = useLoad(() => api.tasks(start, end), [start], refreshKey, onError);
  const inbox = useLoad(() => api.inbox(), [], refreshKey, onError);
  const reload = () => {
    week.reload();
    inbox.reload();
  };
  const catOf = (id: string | null) => categories.find((c) => c.id === id);
  const all = week.data ?? [];
  const weekScore = dayScore(all);

  const moveTo = async (taskId: string, date: string | null) => {
    setDropTarget(null);
    const t = [...all, ...(inbox.data ?? [])].find((x) => x.id === taskId);
    if (!t || t.date === date) return;
    try {
      await api.updateTask(taskId, { date });
      reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo mover.");
    }
  };

  const dropProps = (key: string, date: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((k) => (k === key ? null : k)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/task-id");
      if (id) moveTo(id, date);
    },
  });

  const copyPrevious = async () => {
    if (!window.confirm("¿Copiar a esta semana las tareas sueltas de la semana anterior? Las recurrentes ya aparecen solas.")) return;
    setCopying(true);
    try {
      const created = await api.copyWeek(addDays(start, -7), start);
      onInfo(created.length ? `Se copiaron ${created.length} tareas.` : "La semana anterior no tenía tareas sueltas para copiar.");
      reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo copiar.");
    } finally {
      setCopying(false);
    }
  };

  const rowProps = { onChanged: reload, onEdit: (t: Task) => openForm({ kind: "edit", task: t }), onError, compact: true, draggable: true };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> Semana
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
            {formatDay(start, { day: "numeric", month: "short" })} – {formatDay(end, { day: "numeric", month: "short" })}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {all.length} tareas · {weekScore.rate === null ? "sin marcar aún" : `${Math.round(weekScore.rate * 100)}% cumplido`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-2xl border border-zinc-200 bg-white">
            <button type="button" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior" className="p-2.5 text-zinc-600 hover:text-zinc-950 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => setStart(weekStart(today))} className="px-2 text-xs font-semibold text-zinc-700 cursor-pointer">Hoy</button>
            <button type="button" onClick={() => setStart(addDays(start, 7))} aria-label="Semana siguiente" className="p-2.5 text-zinc-600 hover:text-zinc-950 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button type="button" onClick={copyPrevious} disabled={copying} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-60">
            {copying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Copiar semana anterior
          </button>
          <button type="button" onClick={() => openForm({ kind: "new", date: start <= today && today <= end ? today : start })} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Nueva tarea
          </button>
        </div>
      </div>

      {week.loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {days.map((d, i) => {
            const list = all.filter((t) => t.date === d).sort(byTime);
            const s = dayScore(list);
            const isToday = d === today;
            return (
              <section
                key={d}
                aria-label={formatDay(d)}
                {...dropProps(d, d)}
                className={`flex flex-col rounded-3xl border p-2.5 min-h-40 transition-colors ${
                  dropTarget === d ? "border-emerald-500 bg-emerald-50/50" : isToday ? "border-emerald-700/40 bg-white" : "border-zinc-200/80 bg-zinc-50/50"
                }`}
              >
                <header className="flex items-center justify-between px-1.5 pb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-xs font-bold ${isToday ? "text-emerald-700" : "text-zinc-900"}`}>{WEEKDAY_SHORT[i]}</span>
                    <span className="text-[11px] text-zinc-400">{formatDay(d, { day: "numeric" })}</span>
                    {isToday && <span className="text-[9px] font-bold uppercase text-emerald-700">Hoy</span>}
                  </div>
                  {s.rate !== null && <span className="text-[10px] font-semibold text-zinc-500 tabular-nums">{Math.round(s.rate * 100)}%</span>}
                </header>
                <div className="space-y-1.5 flex-1">
                  {list.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}
                </div>
                <button type="button" onClick={() => openForm({ kind: "new", date: d })} className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold text-zinc-400 hover:text-zinc-800 hover:bg-white cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </section>
            );
          })}
        </div>
      )}

      <section
        {...dropProps("inbox", null)}
        className={`rounded-3xl border p-4 transition-colors ${dropTarget === "inbox" ? "border-emerald-500 bg-emerald-50/50" : "border-zinc-200/80 bg-white"}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-xs font-bold text-zinc-900"><Inbox className="w-4 h-4 text-zinc-400" /> Sin fecha · {inbox.data?.length ?? 0}</h2>
          <button type="button" onClick={() => openForm({ kind: "new", date: null })} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer">+ Agregar</button>
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5">Arrastra una tarea a un día para planificarla (en el teléfono, ábrela y elige el día).</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(inbox.data ?? []).map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}
        </div>
      </section>
    </div>
  );
}
