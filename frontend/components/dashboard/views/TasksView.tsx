"use client";

import { useState } from "react";
import { AlertCircle, CheckSquare, ChevronLeft, ChevronRight, Inbox, Loader2, Plus } from "lucide-react";
import TaskRow from "../TaskRow";
import { useDash } from "../DashContext";
import { useLoad } from "../useLoad";
import { byTime } from "./TodayView";
import { addDays, api, dayScore, formatDay, todayISO, weekStart } from "@/lib/tasks";

export default function TasksView() {
  const { catOf, refreshKey, onError, actions } = useDash();
  const today = todayISO();
  const [start, setStart] = useState(weekStart(today));
  const end = addDays(start, 6);
  const week = useLoad(() => api.tasks(start, end), [start], refreshKey, onError);
  const overdue = useLoad(() => api.tasks(addDays(today, -30), addDays(today, -1)), [today], refreshKey, onError);
  const inbox = useLoad(() => api.inbox(), [], refreshKey, onError);
  const reload = () => {
    week.reload();
    overdue.reload();
    inbox.reload();
  };
  const rowProps = { onChanged: reload, onEdit: actions.editTask, onError };
  const tasks = week.data ?? [];
  const late = (overdue.data ?? []).filter((t) => t.status === "pending" && t.date! < start);
  const s = dayScore(tasks);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider"><CheckSquare className="w-3.5 h-3.5" aria-hidden="true" /> Tareas</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">Pendientes de la semana</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatDay(start, { day: "numeric", month: "short" })} – {formatDay(end, { day: "numeric", month: "short" })} · {tasks.length} tareas
            {s.rate !== null && ` · ${Math.round(s.rate * 100)}% cumplido`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-2xl border border-zinc-200 bg-white">
            <button type="button" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior" className="p-2.5 text-zinc-600 hover:text-zinc-950 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => setStart(weekStart(today))} className="px-2 text-xs font-semibold text-zinc-700 cursor-pointer">Hoy</button>
            <button type="button" onClick={() => setStart(addDays(start, 7))} aria-label="Semana siguiente" className="p-2.5 text-zinc-600 hover:text-zinc-950 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button type="button" onClick={() => actions.newTask(start <= today && today <= end ? today : start)} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Nueva tarea
          </button>
        </div>
      </div>

      {week.loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
          <div className="xl:col-span-2 space-y-5">
            {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
              const list = tasks.filter((t) => t.date === d).sort(byTime);
              return (
                <section key={d} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className={`text-xs font-bold ${d === today ? "text-emerald-700" : "text-zinc-900"}`}>{formatDay(d)}{d === today && " · Hoy"}</h2>
                    <button type="button" onClick={() => actions.newTask(d)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-900 cursor-pointer">+ Agregar</button>
                  </div>
                  {list.length === 0 ? <p className="text-[11px] text-zinc-300">Sin tareas</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{list.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}</div>}
                </section>
              );
            })}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            {late.length > 0 && (
              <section className="p-4 rounded-3xl bg-amber-50 border border-amber-200/70 space-y-2">
                <h2 className="flex items-center gap-1.5 text-xs font-bold text-amber-900"><AlertCircle className="w-4 h-4" /> Atrasadas sin marcar · {late.length}</h2>
                {late.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} compact {...rowProps} />)}
              </section>
            )}
            <section className="p-4 rounded-3xl bg-white border border-zinc-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-bold text-zinc-900"><Inbox className="w-4 h-4 text-zinc-400" /> Sin fecha · {inbox.data?.length ?? 0}</h2>
                <button type="button" onClick={() => actions.newTask(null)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-900 cursor-pointer">+ Agregar</button>
              </div>
              {(inbox.data ?? []).length === 0 && <p className="text-xs text-zinc-400">Nada en la bandeja.</p>}
              {(inbox.data ?? []).map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} compact {...rowProps} />)}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
