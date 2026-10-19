"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, X, ArrowRight, Loader2, Moon } from "lucide-react";
import Modal from "./Modal";
import { addDays, api, Category, formatDay, STATUS_META, Task } from "@/lib/tasks";

type Choice = "done" | "partial" | "not_done" | "postponed";
const OPTIONS: { value: Choice; icon: typeof Check }[] = [
  { value: "done", icon: Check },
  { value: "partial", icon: CircleDashed },
  { value: "not_done", icon: X },
  { value: "postponed", icon: ArrowRight },
];
const ENERGY = ["😩", "😕", "😐", "🙂", "🤩"];

/** Cierre del día: marca lo pendiente, energía y nota. Nada se mueve solo. */
interface Props {
  date: string | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export default function DayCloseModal(props: Props) {
  if (!props.date) return null;
  return <DayClose key={props.date} {...props} date={props.date} />;
}

function DayClose({ date, categories, onClose, onSaved }: Props & { date: string }) {
  const [pending, setPending] = useState<Task[]>([]);
  const [summary, setSummary] = useState({ total: 0, marked: 0 });
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.tasks(date, date), api.reviews(date, date)])
      .then(([tasks, reviews]) => {
        const p = tasks.filter((t) => t.status === "pending");
        setPending(p);
        setSummary({ total: tasks.length, marked: tasks.length - p.length });
        setEnergy(reviews[0]?.energy ?? null);
        setNote(reviews[0]?.note ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const tomorrow = addDays(date, 1);
  const catOf = (id: string | null) => categories.find((c) => c.id === id);
  const missing = pending.filter((t) => !choices[t.id]).length;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      for (const t of pending) {
        const c = choices[t.id];
        if (!c) continue;
        if (c === "postponed") await api.postpone(t.id, tomorrow);
        else await api.updateTask(t.id, { status: c });
      }
      await api.saveReview(date, energy, note.trim() || null);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cierre.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cierre del día · ${formatDay(date, { weekday: "long", day: "numeric", month: "short" })}`}
      wide
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-zinc-500">{missing > 0 ? `${missing} sin decidir (quedan pendientes)` : "Todo decidido"}</span>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Moon className="w-3.5 h-3.5" />}
            Cerrar el día
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-bold text-zinc-900">¿Qué pasó con lo que quedó pendiente?</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {summary.total === 0
                ? "No tenías tareas este día."
                : pending.length === 0
                  ? `Ya marcaste las ${summary.total} tareas del día. 👏`
                  : `Marcaste ${summary.marked} de ${summary.total}. "Pospuesta" la pasa a mañana.`}
            </p>
            <div className="mt-3 space-y-2">
              {pending.map((t) => (
                <div key={t.id} className="p-3 rounded-2xl border border-zinc-200">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catOf(t.category_id)?.color ?? "#d4d4d8" }} aria-hidden="true" />
                    <span className="truncate">{t.title}</span>
                    {t.time && <span className="text-[11px] text-zinc-400">{t.time}</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`Estado de ${t.title}`}>
                    {OPTIONS.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={choices[t.id] === value}
                        onClick={() => setChoices((c) => ({ ...c, [t.id]: value }))}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                          choices[t.id] === value ? STATUS_META[value].soft : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">{STATUS_META[value].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-zinc-900">¿Cómo estuvo tu energía hoy?</h3>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Energía del día">
              {ENERGY.map((e, i) => (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={energy === i + 1}
                  aria-label={`Energía ${i + 1} de 5`}
                  onClick={() => setEnergy(energy === i + 1 ? null : i + 1)}
                  className={`flex-1 py-2 rounded-xl border text-xl cursor-pointer ${energy === i + 1 ? "border-emerald-700 bg-emerald-50" : "border-zinc-200 hover:bg-zinc-50"}`}
                >
                  {e}
                  <span className="block text-[10px] font-semibold text-zinc-500">{i + 1}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="day-note" className="text-xs font-bold text-zinc-900">Nota del día (opcional)</label>
            <textarea
              id="day-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="¿Qué te ayudó o qué te frenó?"
              className="mt-2 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-zinc-900"
            />
          </section>
          {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
