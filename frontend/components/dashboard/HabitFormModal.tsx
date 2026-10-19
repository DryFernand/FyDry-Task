"use client";

import { useState } from "react";
import { Hammer, Loader2, RotateCcw } from "lucide-react";
import Modal from "./Modal";
import { fieldInput, fieldLabel } from "./TaskFormModal";
import { api, Category, Habit, HabitKind, todayISO, WEEKDAY_SHORT, weekdayOf } from "@/lib/tasks";

export type HabitFormTarget = { kind: "new"; mode: HabitKind; date?: string } | { kind: "edit"; habit: Habit };

const PERIODS = [21, 30, 66];

interface Props {
  target: HabitFormTarget | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export default function HabitFormModal(props: Props) {
  if (!props.target) return null;
  return <HabitForm {...props} target={props.target} />;
}

function HabitForm({ target, categories, onClose, onSaved }: Props & { target: HabitFormTarget }) {
  const src = target.kind === "edit" ? target.habit : null;
  const startDay = target.kind === "new" ? target.date ?? todayISO() : src!.start_date;
  const [mode, setMode] = useState<HabitKind>(src?.kind ?? (target.kind === "new" ? target.mode : "established"));
  const [title, setTitle] = useState(src?.title ?? "");
  const [categoryId, setCategoryId] = useState(src?.category_id ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(src?.weekdays ?? [weekdayOf(startDay)]);
  const [time, setTime] = useState(src?.time ?? "");
  const [startDate, setStartDate] = useState(startDay);
  const [period, setPeriod] = useState<number>(src?.period_days ?? 30);
  const [target80, setTarget80] = useState<number>(Math.round((src?.target_rate ?? 0.8) * 100));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = target.kind === "edit";
  const building = mode === "building";

  // Repeticiones esperadas en el periodo (lo que el sistema evaluará)
  const expected = (() => {
    if (!building) return 0;
    let n = 0;
    const d = new Date(startDate + "T00:00:00");
    for (let i = 0; i < period; i++) {
      if (weekdays.includes((d.getDay() + 6) % 7)) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  })();

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  const save = async () => {
    if (!title.trim()) return setError("Escribe el hábito.");
    if (weekdays.length === 0) return setError("Elige al menos un día.");
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await api.updateHabit(src!.id, { title: title.trim(), category_id: categoryId || null, time: time || null, weekdays, target_rate: target80 / 100 });
      } else {
        await api.createHabit({
          title: title.trim(), category_id: categoryId || null, time: time || null, weekdays, kind: mode,
          start_date: startDate, period_days: building ? period : null, target_rate: target80 / 100,
        });
      }
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
      wide
      onClose={onClose}
      title={isEdit ? "Editar hábito" : building ? "Construir un hábito nuevo" : "Agregar un hábito que ya tienes"}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
          </button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {!isEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de hábito">
            {([
              { v: "building", icon: Hammer, t: "Construir uno nuevo", d: "Un hábito que aún no tienes. Se evalúa al terminar el periodo de adaptación." },
              { v: "established", icon: RotateCcw, t: "Ya lo tengo", d: "Solo como recordatorio en sus días, por si se te olvida." },
            ] as const).map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={mode === o.v} onClick={() => setMode(o.v)}
                className={`text-left p-3 rounded-2xl border cursor-pointer transition-colors ${mode === o.v ? "border-emerald-700 bg-emerald-50/60" : "border-zinc-200 hover:bg-zinc-50"}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900"><o.icon className="w-4 h-4 text-emerald-700" /> {o.t}</div>
                <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{o.d}</p>
              </button>
            ))}
          </div>
        )}

        <div>
          <label htmlFor="habit-title" className={fieldLabel}>Hábito</label>
          <input id="habit-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={building ? "Ej. Ir al gimnasio" : "Ej. Arreglar la cama"} className={fieldInput} />
        </div>

        <div>
          <span className={fieldLabel}>Días</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días del hábito">
            {WEEKDAY_SHORT.map((d, i) => (
              <button key={d} type="button" aria-pressed={weekdays.includes(i)} onClick={() => toggleDay(i)}
                className={`w-11 py-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer ${weekdays.includes(i) ? "bg-emerald-700 border-emerald-700 text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                {d}
              </button>
            ))}
            <button type="button" onClick={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])} className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 cursor-pointer">Todos</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="habit-cat" className={fieldLabel}>Categoría</label>
            <select id="habit-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldInput}>
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="habit-time" className={fieldLabel}>Hora (opcional)</label>
            <input id="habit-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={fieldInput} />
          </div>
        </div>

        {!isEdit && (
          <div>
            <label htmlFor="habit-start" className={fieldLabel}>Empieza</label>
            <input id="habit-start" type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className={fieldInput} />
          </div>
        )}

        {building && (
          <div className="rounded-2xl border border-zinc-200 p-3.5 space-y-3">
            {!isEdit && (
              <div>
                <span className={fieldLabel}>Periodo de adaptación</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PERIODS.map((p) => (
                    <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${period === p ? "bg-emerald-700 border-emerald-700 text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                      {p} días
                    </button>
                  ))}
                  <input type="number" min={7} max={365} value={period} aria-label="Días del periodo" onChange={(e) => setPeriod(Math.min(365, Math.max(7, Number(e.target.value) || 7)))} className="w-20 px-2 py-1.5 rounded-xl border border-zinc-200 text-xs" />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="habit-target" className={fieldLabel}>Meta para considerarlo hábito: {target80}%</label>
              <input id="habit-target" type="range" min={50} max={100} step={5} value={target80} onChange={(e) => setTarget80(Number(e.target.value))} className="w-full accent-emerald-700" />
            </div>
            {!isEdit && (
              <p className="text-[11px] text-zinc-600 leading-relaxed bg-zinc-50 rounded-xl p-2.5">
                En {period} días te toca <strong>{expected} veces</strong>. Para convertirlo en hábito necesitas cumplir al menos{" "}
                <strong>{Math.ceil((target80 / 100) * expected)}</strong>. Al terminar te avisamos si ya es un hábito o si conviene reajustar el tiempo.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
