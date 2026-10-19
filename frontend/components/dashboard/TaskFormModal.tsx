"use client";

import { useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import Modal from "./Modal";
import { api, Category, Priority, PRIORITY_META, Recurrence, Task, todayISO, WEEKDAY_SHORT, weekdayOf } from "@/lib/tasks";

export type TaskFormTarget =
  | { kind: "new"; date: string | null }
  | { kind: "edit"; task: Task }
  | { kind: "new-recurrence" }
  | { kind: "edit-recurrence"; rec: Recurrence };

interface Props {
  target: TaskFormTarget | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

/** Se monta de nuevo en cada apertura, así el estado inicial sale del objetivo. */
export default function TaskFormModal(props: Props) {
  if (!props.target) return null;
  return <TaskForm {...props} target={props.target} />;
}

function TaskForm({ target, categories, onClose, onSaved }: Props & { target: TaskFormTarget }) {
  const src = target.kind === "edit" ? target.task : target.kind === "edit-recurrence" ? target.rec : null;
  const isRecTarget = target.kind === "new-recurrence" || target.kind === "edit-recurrence";
  const initialDate = target.kind === "new" ? target.date : target.kind === "edit" ? target.task.date : todayISO();

  const [title, setTitle] = useState(src?.title ?? "");
  const [categoryId, setCategoryId] = useState<string>(src?.category_id ?? "");
  const [priority, setPriority] = useState<Priority>(src?.priority ?? "medium");
  const [date, setDate] = useState<string>(initialDate ?? todayISO());
  const [noDate, setNoDate] = useState(!isRecTarget && initialDate === null);
  const [time, setTime] = useState(src?.time ?? "");
  const [repeat, setRepeat] = useState(isRecTarget);
  const [weekdays, setWeekdays] = useState<number[]>(
    target.kind === "edit-recurrence" ? target.rec.weekdays : initialDate ? [weekdayOf(initialDate)] : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = target.kind === "edit" || target.kind === "edit-recurrence";
  const canRepeat = target.kind === "new" || isRecTarget;

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  const save = async () => {
    if (!title.trim()) return setError("Escribe un título.");
    if (repeat && weekdays.length === 0) return setError("Elige al menos un día para repetir.");
    setSaving(true);
    setError("");
    const common = { title: title.trim(), category_id: categoryId || null, priority, time: time || null };
    try {
      if (target.kind === "edit-recurrence") {
        await api.updateRecurrence(target.rec.id, { ...common, weekdays });
      } else if (repeat) {
        await api.createRecurrence({ ...common, weekdays, start_date: noDate ? todayISO() : date });
      } else if (target.kind === "edit") {
        await api.updateTask(target.task.id, { ...common, date: noDate ? null : date });
      } else {
        await api.createTask({ ...common, date: noDate ? null : date });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const label = "block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5";
  const input = "w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none";

  return (
    <Modal
      open
      onClose={onClose}
      title={isRecTarget ? (isEdit ? "Editar tarea recurrente" : "Nueva tarea recurrente") : isEdit ? "Editar tarea" : "Nueva tarea"}
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
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <label htmlFor="task-title" className={label}>Tarea</label>
          <input id="task-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ej. Enviar propuesta al cliente" className={input} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-cat" className={label}>Categoría</label>
            <select id="task-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <span className={label}>Prioridad</span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100" role="radiogroup" aria-label="Prioridad">
              {(["high", "medium", "low"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
                  className={`py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${priority === p ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!repeat && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-date" className={label}>Día</label>
              <input id="task-date" type="date" value={date} disabled={noDate} onChange={(e) => setDate(e.target.value)} className={`${input} disabled:opacity-40`} />
              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer">
                <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} /> Sin fecha
              </label>
            </div>
            <div>
              <label htmlFor="task-time" className={label}>Hora (opcional)</label>
              <input id="task-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
            </div>
          </div>
        )}

        {canRepeat && (
          <div className="rounded-2xl border border-zinc-200 p-3 space-y-3">
            {!isRecTarget && (
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
                <Repeat className="w-3.5 h-3.5" /> Repetir cada semana
              </label>
            )}
            {repeat && (
              <>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días que se repite">
                  {WEEKDAY_SHORT.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={weekdays.includes(i)}
                      onClick={() => toggleDay(i)}
                      className={`w-11 py-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer ${
                        weekdays.includes(i) ? "bg-emerald-700 border-emerald-700 text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <div>
                  <label htmlFor="rec-time" className={label}>Hora (opcional)</label>
                  <input id="rec-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
                </div>
                {target.kind === "edit-recurrence" && (
                  <p className="text-[11px] text-zinc-500">Los cambios aplican a las próximas tareas pendientes; el historial no cambia.</p>
                )}
              </>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
