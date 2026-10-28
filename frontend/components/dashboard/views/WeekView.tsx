"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, GraduationCap, Inbox, Loader2, Plus } from "lucide-react";
import TaskRow from "../TaskRow";
import { AddMenu, ChallengeRow, ClassRow, HabitRow, ItemKind, KIND_META, KindIcon } from "../ItemRows";
import { useDash } from "../DashContext";
import { Bone, Loading, RowBones } from "../Skeleton";
import { useLoad } from "../useLoad";
import { byTime } from "./TodayView";
import { addDays, api, dayScore, formatDay, todayISO, WEEKDAY_SHORT, weekStart } from "@/lib/tasks";

type Filter = "all" | ItemKind | "class";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todo" },
  { key: "task", label: "Tareas" },
  { key: "habit", label: "Hábitos" },
  { key: "challenge", label: "Retos" },
  { key: "class", label: "Clases" },
];

export default function WeekView() {
  const { catOf, refreshKey, onError, onInfo, actions } = useDash();
  const today = todayISO();
  const [start, setStart] = useState(weekStart(today));
  const [filter, setFilter] = useState<Filter>("all");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const week = useLoad(() => api.agenda(start, end), [start], refreshKey, onError);
  const inbox = useLoad(() => api.inbox(), [], refreshKey, onError);
  const reload = () => {
    week.reload();
    inbox.reload();
  };
  const a = week.data;
  const tasks = a?.tasks ?? [];
  const habitById = new Map((a?.habits ?? []).map((h) => [h.id, h]));
  const show = (k: ItemKind | "class") => filter === "all" || filter === k;
  const totals = {
    task: tasks.length,
    habit: (a?.habit_entries ?? []).length,
    challenge: (a?.challenges ?? []).length,
    class: (a?.classes ?? []).length,
  };
  const weekScore = dayScore(tasks);

  const moveTo = async (taskId: string, date: string | null) => {
    setDropTarget(null);
    const t = [...tasks, ...(inbox.data ?? [])].find((x) => x.id === taskId);
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
    if (!window.confirm("¿Copiar a esta semana las tareas de la semana anterior? Los hábitos ya aparecen solos.")) return;
    setCopying(true);
    try {
      const created = await api.copyWeek(addDays(start, -7), start);
      onInfo(created.length ? `Se copiaron ${created.length} tareas.` : "La semana anterior no tenía tareas para copiar.");
      reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo copiar.");
    } finally {
      setCopying(false);
    }
  };

  const taskProps = { onChanged: reload, onEdit: actions.editTask, onError, compact: true, draggable: true };

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
          {week.loading ? <Bone className="mt-1.5 h-3 w-64 max-w-full" /> : <p className="text-xs text-zinc-500 mt-0.5">
            {totals.task} tareas · {totals.habit} hábitos · {totals.challenge} retos{totals.class ? ` · ${totals.class} clases` : ""}
            {weekScore.rate !== null && ` · tareas ${Math.round(weekScore.rate * 100)}% cumplidas`}
          </p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-2xl border border-zinc-200 bg-white">
            <button type="button" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior" className="p-2.5 text-zinc-600 hover:text-zinc-950 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => setStart(weekStart(today))} className="px-2 text-xs font-semibold text-zinc-700 cursor-pointer">Hoy</button>
            <button type="button" onClick={() => setStart(addDays(start, 7))} aria-label="Semana siguiente" className="p-2.5 text-zinc-600 hover:text-zinc-950 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button type="button" onClick={copyPrevious} disabled={copying} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-60">
            {copying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Copiar tareas de la semana anterior
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100 w-fit" role="radiogroup" aria-label="Mostrar">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="radio" aria-checked={filter === f.key} onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${filter === f.key ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}>
            {f.key === "class" ? <GraduationCap className="w-3.5 h-3.5 text-sky-700" /> : f.key !== "all" && <KindIcon kind={f.key} />} {f.label}
          </button>
        ))}
      </div>

      {week.loading ? (
        <Loading label="Cargando semana…" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {days.map((d, i) => (
            <div key={d} className={`flex flex-col rounded-3xl border p-2.5 min-h-40 ${d === today ? "border-emerald-700/40 bg-white" : "border-zinc-200/80 bg-zinc-50/50"}`}>
              <div className="flex items-baseline gap-1.5 px-1.5 pb-2">
                <span className={`text-xs font-bold ${d === today ? "text-emerald-700" : "text-zinc-900"}`}>{WEEKDAY_SHORT[i]}</span>
                <span className="text-[11px] text-zinc-400">{formatDay(d, { day: "numeric" })}</span>
              </div>
              <div className="space-y-1.5 flex-1"><RowBones count={i % 3 === 0 ? 2 : 1} compact /></div>
              <Bone className="mt-2 h-8 rounded-xl" />
            </div>
          ))}
        </Loading>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {days.map((d, i) => {
            const dayTasks = tasks.filter((t) => t.date === d).sort(byTime);
            const dayHabits = (a?.habit_entries ?? []).filter((e) => e.date === d && habitById.has(e.habit_id)).sort((x, y) => byTime(habitById.get(x.habit_id)!, habitById.get(y.habit_id)!));
            const dayChallenges = (a?.challenges ?? []).filter((c) => c.date === d).sort(byTime);
            const dayClasses = (a?.classes ?? []).filter((c) => c.date === d);
            const s = dayScore(dayTasks);
            const isToday = d === today;
            const empty = !(show("task") && dayTasks.length) && !(show("habit") && dayHabits.length) && !(show("challenge") && dayChallenges.length) && !(show("class") && dayClasses.length);
            return (
              <section key={d} aria-label={formatDay(d)} {...dropProps(d, d)}
                className={`flex flex-col rounded-3xl border p-2.5 min-h-40 transition-colors ${dropTarget === d ? "border-emerald-500 bg-emerald-50/50" : isToday ? "border-emerald-700/40 bg-white" : "border-zinc-200/80 bg-zinc-50/50"}`}>
                <header className="flex items-center justify-between px-1.5 pb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-xs font-bold ${isToday ? "text-emerald-700" : "text-zinc-900"}`}>{WEEKDAY_SHORT[i]}</span>
                    <span className="text-[11px] text-zinc-400">{formatDay(d, { day: "numeric" })}</span>
                    {isToday && <span className="text-[9px] font-bold uppercase text-emerald-700">Hoy</span>}
                  </div>
                  {s.rate !== null && <span className="text-[10px] font-semibold text-zinc-500 tabular-nums" title="Cumplimiento de tareas">{Math.round(s.rate * 100)}%</span>}
                </header>
                <div className="space-y-1.5 flex-1">
                  {show("class") && dayClasses.map((o) => <ClassRow key={`${o.session_id}-${o.date}`} occ={o} compact onChanged={reload} onError={onError} />)}
                  {show("challenge") && dayChallenges.map((c) => <ChallengeRow key={c.id} challenge={c} category={catOf(c.category_id)} compact onResult={actions.reportChallenge} onEdit={actions.editChallenge} />)}
                  {show("habit") && dayHabits.map((e) => (
                    <HabitRow key={`${e.habit_id}-${e.date}`} habit={habitById.get(e.habit_id)!} entry={e} category={catOf(habitById.get(e.habit_id)!.category_id)} compact onChanged={reload} onError={onError} onOpen={actions.editHabit} />
                  ))}
                  {show("task") && dayTasks.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...taskProps} />)}
                  {empty && <p className="px-1.5 text-[11px] text-zinc-300">Libre</p>}
                </div>
                <AddMenu className="mt-2" onPick={(k) => actions.create(k, d)} />
              </section>
            );
          })}
        </div>
      )}

      {show("task") && (
        <section {...dropProps("inbox", null)} className={`rounded-3xl border p-4 transition-colors ${dropTarget === "inbox" ? "border-emerald-500 bg-emerald-50/50" : "border-zinc-200/80 bg-white"}`}>
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-xs font-bold text-zinc-900"><Inbox className="w-4 h-4 text-zinc-400" /> Tareas sin fecha{!inbox.loading && ` · ${inbox.data?.length ?? 0}`}</h2>
            <button type="button" onClick={() => actions.newTask(null)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Agregar</button>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">Arrastra una tarea a un día para planificarla (en el teléfono, ábrela y elige el día).</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" aria-busy={inbox.loading}>
            {inbox.loading && <RowBones count={3} compact />}
            {(inbox.data ?? []).map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...taskProps} />)}
          </div>
        </section>
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
        {(Object.keys(KIND_META) as ItemKind[]).map((k) => <span key={k} className="inline-flex items-center gap-1"><KindIcon kind={k} /> {KIND_META[k].label}</span>)}
        <span className="inline-flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5 text-sky-700" /> Clase</span>
      </p>
    </div>
  );
}
