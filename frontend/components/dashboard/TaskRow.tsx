"use client";

import { useState } from "react";
import { Check, CircleDashed, X, ArrowRight, MoreHorizontal, Pencil, Trash2, Repeat, Clock, Flag } from "lucide-react";
import { api, addDays, ASSIGNMENT_META, Category, formatDay, PRIORITY_META, STATUS_META, Task, TaskStatus } from "@/lib/tasks";
import { useDash } from "./DashContext";

const STATUS_ICONS = { done: Check, partial: CircleDashed, not_done: X, postponed: ArrowRight } as const;
type Marked = Exclude<TaskStatus, "pending">;

export function StatusBadge({ status }: { status: Marked }) {
  const Icon = STATUS_ICONS[status];
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${meta.soft}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function TaskRow({
  task,
  category,
  onChanged,
  onEdit,
  onError,
  compact = false,
  draggable = false,
}: {
  task: Task;
  category?: Category;
  onChanged: () => void;
  onEdit: (t: Task) => void;
  onError: (msg: string) => void;
  compact?: boolean;
  draggable?: boolean;
}) {
  const { subjectOf } = useDash();
  const subject = subjectOf(task.subject_id);
  const assignment = task.assignment_type ? ASSIGNMENT_META[task.assignment_type] : null;
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<"none" | "postpone" | "more">("none");
  const [customDate, setCustomDate] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMenu("none");
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Algo salió mal.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (s: Exclude<Marked, "postponed">) =>
    run(() => api.updateTask(task.id, { status: task.status === s ? "pending" : s }));

  const postponeTo = (date: string | null) => run(() => api.postpone(task.id, date));

  const isPostponed = task.status === "postponed";
  const base = task.date ?? "";

  return (
    <div
      draggable={draggable && !isPostponed}
      onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
      className={`group relative rounded-2xl border bg-white transition-colors ${
        isPostponed ? "border-zinc-100 opacity-60" : "border-zinc-200/80 hover:border-zinc-300"
      } ${compact ? "p-2.5" : "p-3 sm:p-3.5"} ${busy ? "opacity-60 pointer-events-none" : ""}`}
    >
      <div className={`flex items-start ${compact ? "gap-1.5" : "gap-2.5"}`}>
        <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: category?.color ?? "#d4d4d8" }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => !isPostponed && onEdit(task)}
            className={`text-left w-full ${compact ? "text-[13px]" : "text-sm"} font-medium leading-snug break-words hyphens-auto cursor-pointer ${
              task.status === "done" ? "line-through text-zinc-400" : isPostponed ? "text-zinc-400" : "text-zinc-900"
            }`}
          >
            {task.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
            {task.time && (
              <span className="inline-flex items-center gap-0.5 font-medium text-zinc-600">
                <Clock className="w-3 h-3" aria-hidden="true" /> {task.time}
              </span>
            )}
            {assignment && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-md border text-[10px] font-semibold ${assignment.className}`}>{assignment.emoji} {assignment.label}</span>
            )}
            {subject ? (
              <span className="inline-flex items-center gap-1 font-medium text-zinc-600"><span className="w-1.5 h-1.5 rounded-full" style={{ background: subject.color }} aria-hidden="true" />{subject.name}</span>
            ) : (
              category && <span>{category.name}</span>
            )}
            {task.priority === "high" && (
              <span className={`inline-flex items-center gap-0.5 ${PRIORITY_META.high.className}`}>
                <Flag className="w-3 h-3" aria-hidden="true" /> Alta
              </span>
            )}
            {task.recurrence_id && <Repeat className="w-3 h-3" aria-label="Recurrente" />}
            {task.postpone_count > 0 && <span className="text-sky-600">Pospuesta {task.postpone_count}×</span>}
            {task.status !== "pending" && (!compact || isPostponed) && <StatusBadge status={task.status as Marked} />}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenu(menu === "more" ? "none" : "more")}
          aria-label="Más opciones"
          className="p-1 rounded-lg text-zinc-300 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Checklist: 4 estados. Tocar el estado activo lo devuelve a pendiente. */}
      {!isPostponed && task.date && (
        <div className={`mt-2.5 grid grid-cols-4 ${compact ? "gap-1" : "gap-1.5 text-[11px]"}`} role="group" aria-label="Marcar estado">
          {(["done", "partial", "not_done", "postponed"] as Marked[]).map((s) => {
            const Icon = STATUS_ICONS[s];
            const active = task.status === s || (s === "postponed" && menu === "postpone");
            return (
              <button
                key={s}
                type="button"
                aria-pressed={task.status === s}
                aria-label={STATUS_META[s].label}
                title={STATUS_META[s].label}
                onClick={() => (s === "postponed" ? setMenu(menu === "postpone" ? "none" : "postpone") : setStatus(s))}
                className={`flex items-center justify-center gap-1 ${compact ? "py-1 rounded-lg" : "py-1.5 rounded-xl"} border font-semibold transition-colors cursor-pointer ${
                  active ? STATUS_META[s].soft : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {!compact && <span className="truncate">{STATUS_META[s].label}</span>}
              </button>
            );
          })}
        </div>
      )}

      {menu === "postpone" && (
        <div className="mt-2 p-2.5 rounded-xl bg-sky-50/60 border border-sky-100 space-y-2">
          <div className="text-[11px] font-semibold text-sky-800">¿Para cuándo la pasas?</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => postponeTo(addDays(base, 1))} className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-medium text-sky-800 cursor-pointer hover:bg-sky-100">
              Mañana
            </button>
            <button type="button" onClick={() => postponeTo(addDays(base, 7))} className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-medium text-sky-800 cursor-pointer hover:bg-sky-100">
              En una semana
            </button>
            <button type="button" onClick={() => postponeTo(null)} className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-[11px] font-medium text-sky-800 cursor-pointer hover:bg-sky-100">
              Sin fecha
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              min={addDays(base, 1)}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              aria-label="Otro día"
              className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-sky-200 bg-white text-xs"
            />
            <button
              type="button"
              disabled={!customDate}
              onClick={() => postponeTo(customDate)}
              className="px-2.5 py-1 rounded-lg bg-sky-700 text-white text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
            >
              Mover
            </button>
          </div>
        </div>
      )}

      {menu === "more" && (
        <div className="absolute right-2 top-9 z-20 w-40 p-1 rounded-xl bg-white border border-zinc-200 shadow-lg text-xs">
          {!isPostponed && (
            <button type="button" onClick={() => { setMenu("none"); onEdit(task); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 cursor-pointer">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
          {isPostponed && task.date && (
            <div className="px-2.5 py-2 text-[11px] text-zinc-500">Pospuesta desde el {formatDay(task.date, { day: "numeric", month: "short" })}</div>
          )}
          <button type="button" onClick={() => run(() => api.deleteTask(task.id))} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
