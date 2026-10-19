"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckSquare, Clock, Flag, Hammer, Plus, Repeat, Trophy, X } from "lucide-react";
import { api, Category, Challenge, CHALLENGE_META, Habit, HabitEntry, HabitLogStatus, todayISO } from "@/lib/tasks";

/** Identidad visual de cada tipo (ícono + nombre, nunca solo color). */
export const KIND_META = {
  task: { label: "Tarea", icon: CheckSquare, className: "text-zinc-500" },
  habit: { label: "Hábito", icon: Repeat, className: "text-emerald-700" },
  challenge: { label: "Reto", icon: Trophy, className: "text-amber-600" },
} as const;
export type ItemKind = keyof typeof KIND_META;

export function KindIcon({ kind }: { kind: ItemKind }) {
  const M = KIND_META[kind];
  return <M.icon className={`w-3.5 h-3.5 shrink-0 ${M.className}`} aria-label={M.label} />;
}

/** Progreso corto de un hábito en construcción: "5/13 · faltan 9 días". */
export function habitProgressLabel(h: Habit): string | null {
  const s = h.stats;
  if (h.kind !== "building" || !s?.expected_total) return null;
  return `${s.done ?? 0}/${s.expected_total} · ${s.days_left ? `faltan ${s.days_left} días` : "último día"}`;
}

// ============ Hábito: Hecho / No hecho ============
export function HabitRow({
  habit,
  entry,
  category,
  compact = false,
  onChanged,
  onError,
  onOpen,
}: {
  habit: Habit;
  entry: HabitEntry;
  category?: Category;
  compact?: boolean;
  onChanged: () => void;
  onError: (m: string) => void;
  onOpen?: (h: Habit) => void;
}) {
  const [busy, setBusy] = useState(false);
  const future = entry.date > todayISO();
  const set = async (s: HabitLogStatus) => {
    setBusy(true);
    try {
      await api.logHabit(habit.id, entry.date, entry.status === s ? null : s);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo marcar.");
    } finally {
      setBusy(false);
    }
  };
  const progress = habitProgressLabel(habit);

  return (
    <div className={`rounded-2xl border bg-white ${compact ? "p-2.5" : "p-3 sm:p-3.5"} border-emerald-700/15 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      <div className={`flex items-start ${compact ? "gap-1.5" : "gap-2.5"}`}>
        <KindIcon kind="habit" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpen?.(habit)} className={`text-left w-full ${compact ? "text-[13px]" : "text-sm"} font-medium leading-snug break-words hyphens-auto cursor-pointer ${entry.status === "done" ? "line-through text-zinc-400" : "text-zinc-900"}`}>
            {habit.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
            {habit.time && <span className="inline-flex items-center gap-0.5 font-medium text-zinc-600"><Clock className="w-3 h-3" aria-hidden="true" /> {habit.time}</span>}
            {category && <span>{category.name}</span>}
            {habit.kind === "building" && (
              <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold"><Hammer className="w-3 h-3" aria-hidden="true" /> {compact ? "En construcción" : `Construyendo · ${progress}`}</span>
            )}
            {!compact && habit.stats && habit.stats.streak >= 2 && <span>🔥 {habit.stats.streak}</span>}
          </div>
        </div>
      </div>
      <div className={`mt-2.5 grid grid-cols-2 ${compact ? "gap-1" : "gap-1.5 text-[11px]"}`} role="group" aria-label={`Marcar ${habit.title}`}>
        {([
          { s: "done" as const, icon: Check, label: "Hecho", on: "bg-green-50 text-green-700 border-green-200" },
          { s: "not_done" as const, icon: X, label: "No hecho", on: "bg-rose-50 text-rose-700 border-rose-200" },
        ]).map(({ s, icon: Icon, label, on }) => (
          <button key={s} type="button" disabled={future} aria-pressed={entry.status === s} aria-label={label} title={future ? "Aún no llega el día" : label} onClick={() => set(s)}
            className={`flex items-center justify-center gap-1 ${compact ? "py-1 rounded-lg" : "py-1.5 rounded-xl"} border font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${entry.status === s ? on : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {!compact && <span>{label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ Reto: resultado con nota ============
export function ChallengeRow({
  challenge,
  category,
  compact = false,
  onResult,
  onEdit,
}: {
  challenge: Challenge;
  category?: Category;
  compact?: boolean;
  onResult: (c: Challenge) => void;
  onEdit: (c: Challenge) => void;
}) {
  const decided = challenge.status !== "pending";
  const meta = decided ? CHALLENGE_META[challenge.status as Exclude<typeof challenge.status, "pending">] : null;
  const canReport = challenge.date <= todayISO();
  return (
    <div className={`rounded-2xl border bg-white ${compact ? "p-2.5" : "p-3 sm:p-3.5"} border-amber-500/25`}>
      <div className={`flex items-start ${compact ? "gap-1.5" : "gap-2.5"}`}>
        <KindIcon kind="challenge" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onEdit(challenge)} className={`text-left w-full ${compact ? "text-[13px]" : "text-sm"} font-semibold leading-snug break-words hyphens-auto text-zinc-900 cursor-pointer`}>
            {challenge.title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
            {challenge.time && <span className="inline-flex items-center gap-0.5 font-medium text-zinc-600"><Clock className="w-3 h-3" aria-hidden="true" /> {challenge.time}</span>}
            {category && <span>{category.name}</span>}
            {meta && <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${meta.soft}`}>{meta.emoji} {meta.label}</span>}
          </div>
          {decided && challenge.result_note && !compact && <p className="mt-1.5 text-xs text-zinc-600 italic">“{challenge.result_note}”</p>}
        </div>
      </div>
      <button type="button" disabled={!canReport} onClick={() => onResult(challenge)} title={canReport ? undefined : "Aún no llega el día"}
        className={`mt-2.5 w-full flex items-center justify-center gap-1.5 ${compact ? "py-1 rounded-lg text-[10px]" : "py-1.5 rounded-xl text-[11px]"} border font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${decided ? "border-zinc-200 text-zinc-500 hover:bg-zinc-50" : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}>
        <Flag className="w-3.5 h-3.5" aria-hidden="true" /> {decided ? "Cambiar resultado" : "Registrar resultado"}
      </button>
    </div>
  );
}

// ============ "+ Agregar" con elección de tipo ============
export function AddMenu({ onPick, label = "Agregar", className = "", below = false }: { onPick: (k: ItemKind) => void; label?: string; className?: string; below?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold text-zinc-400 hover:text-zinc-800 hover:bg-white cursor-pointer">
        <Plus className="w-3.5 h-3.5" /> {label}
      </button>
      {open && (
        <div className={`absolute z-40 w-36 p-1 rounded-xl bg-white border border-zinc-200 shadow-lg text-xs ${below ? "right-0 top-full mt-1" : "left-1/2 -translate-x-1/2 bottom-full mb-1"}`}>
          {(Object.keys(KIND_META) as ItemKind[]).map((k) => (
            <button key={k} type="button" onClick={() => { setOpen(false); onPick(k); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 cursor-pointer">
              <KindIcon kind={k} /> {KIND_META[k].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
