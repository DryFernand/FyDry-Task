"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, X, ArrowRight, GraduationCap, Loader2, Moon } from "lucide-react";
import Modal from "./Modal";
import { KindIcon } from "./ItemRows";
import { ResultChoices } from "./ChallengeModals";
import { addDays, api, AttendanceStatus, Category, Challenge, ChallengeStatus, ClassOccurrence, formatDay, Habit, HabitLogStatus, STATUS_META, Task } from "@/lib/tasks";

type Choice = "done" | "partial" | "not_done" | "postponed";
const OPTIONS: { value: Choice; icon: typeof Check }[] = [
  { value: "done", icon: Check },
  { value: "partial", icon: CircleDashed },
  { value: "not_done", icon: X },
  { value: "postponed", icon: ArrowRight },
];
const ENERGY = ["😩", "😕", "😐", "🙂", "🤩"];

/** Cierre del día: tareas, hábitos y retos pendientes, energía y nota. Nada se mueve solo. */
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

function Item({ kind, title, time, color, children }: { kind: "task" | "habit" | "challenge"; title: string; time: string | null; color?: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-2xl border border-zinc-200">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        <KindIcon kind={kind} />
        {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />}
        <span className="truncate">{title}</span>
        {time && <span className="text-[11px] text-zinc-400">{time}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function DayClose({ date, categories, onClose, onSaved }: Props & { date: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [classes, setClasses] = useState<ClassOccurrence[]>([]);
  const [attChoice, setAttChoice] = useState<Record<string, AttendanceStatus>>({});
  const [total, setTotal] = useState(0);
  const [taskChoice, setTaskChoice] = useState<Record<string, Choice>>({});
  const [habitChoice, setHabitChoice] = useState<Record<string, HabitLogStatus>>({});
  const [chResult, setChResult] = useState<Record<string, Exclude<ChallengeStatus, "pending">>>({});
  const [chNote, setChNote] = useState<Record<string, string>>({});
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.agenda(date, date), api.reviews(date, date)])
      .then(([a, reviews]) => {
        const pendingHabitIds = new Set(a.habit_entries.filter((e) => !e.status).map((e) => e.habit_id));
        setTasks(a.tasks.filter((t) => t.status === "pending"));
        setHabits(a.habits.filter((h) => pendingHabitIds.has(h.id)));
        setChallenges(a.challenges.filter((c) => c.status === "pending"));
        setClasses((a.classes ?? []).filter((c) => !c.attendance));
        setTotal(a.tasks.length + a.habit_entries.length + a.challenges.length + (a.classes ?? []).length);
        setEnergy(reviews[0]?.energy ?? null);
        setNote(reviews[0]?.note ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const tomorrow = addDays(date, 1);
  const catOf = (id: string | null) => categories.find((c) => c.id === id);
  const pendingCount = tasks.length + habits.length + challenges.length + classes.length;
  const missing =
    classes.filter((c) => !attChoice[c.session_id]).length +
    tasks.filter((t) => !taskChoice[t.id]).length +
    habits.filter((h) => !habitChoice[h.id]).length +
    challenges.filter((c) => !chResult[c.id]).length;

  const save = async () => {
    const noNote = challenges.find((c) => chResult[c.id] && (chNote[c.id] ?? "").trim().length < 3);
    if (noNote) return setError(`Cuenta cómo te fue en el reto “${noNote.title}”: la nota es obligatoria.`);
    setSaving(true);
    setError("");
    try {
      for (const t of tasks) {
        const c = taskChoice[t.id];
        if (!c) continue;
        if (c === "postponed") await api.postpone(t.id, tomorrow);
        else await api.updateTask(t.id, { status: c });
      }
      for (const h of habits) if (habitChoice[h.id]) await api.logHabit(h.id, date, habitChoice[h.id]);
      for (const c of challenges) if (chResult[c.id]) await api.challengeResult(c.id, chResult[c.id], chNote[c.id].trim());
      for (const o of classes) if (attChoice[o.session_id]) await api.markAttendance(o.session_id, date, attChoice[o.session_id]);
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
          <button type="button" onClick={save} disabled={saving || loading} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
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
              {total === 0 ? "No tenías nada este día." : pendingCount === 0 ? `Ya marcaste todo (${total}). 👏` : `Te quedan ${pendingCount} de ${total}. En tareas, "Pospuesta" la pasa a mañana.`}
            </p>
            <div className="mt-3 space-y-2">
              {classes.map((o) => (
                <div key={o.session_id} className="p-3 rounded-2xl border border-zinc-200 border-l-4" style={{ borderLeftColor: o.color }}>
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                    <GraduationCap className="w-3.5 h-3.5 text-sky-700 shrink-0" aria-label="Clase" />
                    <span className="truncate">{o.subject}</span>
                    <span className="text-[11px] text-zinc-400">{o.start_time}–{o.end_time}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={`Asistencia a ${o.subject}`}>
                    {([["attended", "Asistí", Check, "bg-green-50 text-green-700 border-green-200"], ["absent", "No asistí", X, "bg-rose-50 text-rose-700 border-rose-200"]] as const).map(([v, label, Icon, on]) => (
                      <button key={v} type="button" role="radio" aria-checked={attChoice[o.session_id] === v} onClick={() => setAttChoice((c) => ({ ...c, [o.session_id]: v }))}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${attChoice[o.session_id] === v ? on : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {tasks.map((t) => (
                <Item key={t.id} kind="task" title={t.title} time={t.time} color={catOf(t.category_id)?.color}>
                  <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`Estado de ${t.title}`}>
                    {OPTIONS.map(({ value, icon: Icon }) => (
                      <button key={value} type="button" role="radio" aria-checked={taskChoice[t.id] === value} onClick={() => setTaskChoice((c) => ({ ...c, [t.id]: value }))}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${taskChoice[t.id] === value ? STATUS_META[value].soft : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">{STATUS_META[value].label}</span>
                      </button>
                    ))}
                  </div>
                </Item>
              ))}
              {habits.map((h) => (
                <Item key={h.id} kind="habit" title={h.title} time={h.time} color={catOf(h.category_id)?.color}>
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={`Estado de ${h.title}`}>
                    {([["done", "Hecho", Check, "bg-green-50 text-green-700 border-green-200"], ["not_done", "No hecho", X, "bg-rose-50 text-rose-700 border-rose-200"]] as const).map(([v, label, Icon, on]) => (
                      <button key={v} type="button" role="radio" aria-checked={habitChoice[h.id] === v} onClick={() => setHabitChoice((c) => ({ ...c, [h.id]: v }))}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${habitChoice[h.id] === v ? on : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
                      </button>
                    ))}
                  </div>
                </Item>
              ))}
              {challenges.map((c) => (
                <Item key={c.id} kind="challenge" title={c.title} time={c.time} color={catOf(c.category_id)?.color}>
                  <ResultChoices value={chResult[c.id] ?? null} onChange={(s) => setChResult((r) => ({ ...r, [c.id]: s }))} name={c.title} />
                  {chResult[c.id] && (
                    <textarea value={chNote[c.id] ?? ""} onChange={(e) => setChNote((n) => ({ ...n, [c.id]: e.target.value }))} maxLength={1000} rows={2}
                      aria-label={`Resultado de ${c.title}`} placeholder="¿Cómo te fue? (obligatorio) Ej. Corrí 10k pero en 40 minutos"
                      className="mt-2 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm outline-none focus:border-zinc-900" />
                  )}
                </Item>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-zinc-900">¿Cómo estuvo tu energía hoy?</h3>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Energía del día">
              {ENERGY.map((e, i) => (
                <button key={e} type="button" role="radio" aria-checked={energy === i + 1} aria-label={`Energía ${i + 1} de 5`} onClick={() => setEnergy(energy === i + 1 ? null : i + 1)}
                  className={`flex-1 py-2 rounded-xl border text-xl cursor-pointer ${energy === i + 1 ? "border-emerald-700 bg-emerald-50" : "border-zinc-200 hover:bg-zinc-50"}`}>
                  {e}
                  <span className="block text-[10px] font-semibold text-zinc-500">{i + 1}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="day-note" className="text-xs font-bold text-zinc-900">Nota del día (opcional)</label>
            <textarea id="day-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="¿Qué te ayudó o qué te frenó?"
              className="mt-2 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm outline-none focus:border-zinc-900" />
          </section>
          {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
