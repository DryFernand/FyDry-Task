"use client";

import { useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import Modal from "./Modal";
import { api, ASSIGNMENT_META, AssignmentType, Category, Priority, PRIORITY_META, Schedule, Task, todayISO } from "@/lib/tasks";

export type TaskFormTarget = { kind: "new"; date: string | null } | { kind: "edit"; task: Task };

interface Props {
  target: TaskFormTarget | null;
  categories: Category[];
  /** Para elegir materia en tareas académicas (horarios no archivados). */
  schedules?: Schedule[];
  onClose: () => void;
  onSaved: () => void;
  /** Lo que se repite va como hábito: abre ese formulario con el día ya elegido. */
  onSwitchToHabit?: (date: string) => void;
}

export const fieldLabel = "block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5";
export const fieldInput = "w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none";

/** Se monta de nuevo en cada apertura, así el estado inicial sale del objetivo. */
export default function TaskFormModal(props: Props) {
  if (!props.target) return null;
  return <TaskForm {...props} target={props.target} />;
}

function TaskForm({ target, categories, schedules = [], onClose, onSaved, onSwitchToHabit }: Props & { target: TaskFormTarget }) {
  const src = target.kind === "edit" ? target.task : null;
  const initialDate = target.kind === "new" ? target.date : target.task.date;

  const [title, setTitle] = useState(src?.title ?? "");
  const [categoryId, setCategoryId] = useState<string>(src?.category_id ?? "");
  const [priority, setPriority] = useState<Priority>(src?.priority ?? "medium");
  const [date, setDate] = useState<string>(initialDate ?? todayISO());
  const [noDate, setNoDate] = useState(initialDate === null);
  const [time, setTime] = useState(src?.time ?? "");
  const [subjectId, setSubjectId] = useState(src?.subject_id ?? "");
  const [assignment, setAssignment] = useState<AssignmentType | "">(src?.assignment_type ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const academic = !!categories.find((c) => c.id === categoryId)?.is_academic;
  const activeSchedules = schedules.filter((s) => !s.is_archived && s.subjects.length);

  const save = async () => {
    if (!title.trim()) return setError("Escribe un título.");
    setSaving(true);
    setError("");
    const data = {
      title: title.trim(), category_id: categoryId || null, priority, time: time || null, date: noDate ? null : date,
      subject_id: academic ? subjectId || null : null,
      assignment_type: academic ? assignment || null : null,
    };
    try {
      if (target.kind === "edit") await api.updateTask(target.task.id, data);
      else await api.createTask(data);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={target.kind === "edit" ? "Editar tarea" : "Nueva tarea"}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar
          </button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div>
          <label htmlFor="task-title" className={fieldLabel}>Tarea</label>
          <input id="task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ej. Enviar propuesta al cliente" className={fieldInput} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-cat" className={fieldLabel}>Categoría</label>
            <select id="task-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldInput}>
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <span className={fieldLabel}>Prioridad</span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100" role="radiogroup" aria-label="Prioridad">
              {(["high", "medium", "low"] as Priority[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={priority === p} onClick={() => setPriority(p)}
                  className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${priority === p ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}>
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {academic && (
          <div className="rounded-2xl border border-zinc-200 p-3 space-y-3">
            <div>
              <label htmlFor="task-subject" className={fieldLabel}>🎓 Materia</label>
              <select id="task-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={fieldInput}>
                <option value="">Sin materia</option>
                {activeSchedules.map((s) => (
                  <optgroup key={s.id} label={s.name}>
                    {s.subjects.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                ))}
              </select>
              {activeSchedules.length === 0 && <p className="mt-1 text-[11px] text-zinc-400">Crea tu horario en &quot;Horario&quot; para asociar materias.</p>}
            </div>
            <div>
              <span className={fieldLabel}>Tipo de asignación</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de asignación">
                {(Object.keys(ASSIGNMENT_META) as AssignmentType[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={assignment === k} onClick={() => setAssignment(assignment === k ? "" : k)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${assignment === k ? ASSIGNMENT_META[k].className : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    {ASSIGNMENT_META[k].emoji} {ASSIGNMENT_META[k].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">El día de la tarea es su fecha de entrega.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-date" className={fieldLabel}>{academic ? "Entrega" : "Día"}</label>
            <input id="task-date" type="date" value={date} disabled={noDate} onChange={(e) => setDate(e.target.value)} className={`${fieldInput} disabled:opacity-40`} />
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer">
              <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} /> Sin fecha
            </label>
          </div>
          <div>
            <label htmlFor="task-time" className={fieldLabel}>Hora (opcional)</label>
            <input id="task-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={fieldInput} />
          </div>
        </div>

        {target.kind === "new" && onSwitchToHabit && (
          <button type="button" onClick={() => onSwitchToHabit(noDate ? todayISO() : date)} className="w-full flex items-center gap-2 p-3 rounded-2xl border border-dashed border-zinc-300 text-left text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer">
            <Repeat className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>¿Se repite cada semana? <strong className="text-zinc-900">Créalo como hábito</strong></span>
          </button>
        )}

        {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
