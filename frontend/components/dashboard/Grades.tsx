"use client";

import { useState } from "react";
import { Award, Loader2 } from "lucide-react";
import { useDash } from "./DashContext";
import { api, letterFor, Schedule, todayISO } from "@/lib/tasks";

export const statusBadge = (passed: boolean | null) =>
  passed === null ? null : passed ? (
    <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-green-50 text-green-700 border-green-200">✓ Aprobada</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-rose-50 text-rose-700 border-rose-200">✗ Reprobada</span>
  );

/** Carrera por promedio: una sola nota final para todo el periodo. */
function PeriodGrade({ s, pass }: { s: Schedule; pass: number }) {
  const { onError, reloadSchedules, programs } = useDash();
  const scale = programs.find((p) => p.id === s.program_id)?.scale ?? [];
  const [raw, setRaw] = useState(s.final_grade?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const value = raw.trim() === "" ? null : Number(raw);
  const valid = value !== null && !Number.isNaN(value) && value >= 0 && value <= 100;
  const save = async () => {
    if (value !== null && !valid) return onError("La nota va de 0 a 100.");
    if (value === s.final_grade) return;
    setSaving(true);
    try {
      await api.setScheduleGrade(s.id, value);
      reloadSchedules();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900"><Award className="w-4 h-4 text-amber-600" /> Nota final del periodo</h2>
        <p className="text-[11px] text-zinc-500">{todayISO() > s.end_date && s.final_grade === null ? "Terminó el periodo: registra su nota para tu promedio." : "Esta carrera se califica por promedio: una nota por periodo."}</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="decimal" min={0} max={100} step={0.1} value={raw} placeholder="—" aria-label={`Nota final de ${s.name}`}
          onChange={(e) => setRaw(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="w-24 px-2 py-1.5 rounded-xl border border-zinc-200 text-base text-right tabular-nums" />
        <span className="w-8 text-center text-sm font-bold text-zinc-900">{valid && scale.length ? letterFor(value!, scale).letter : ""}</span>
        <span className="w-24">{saving ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : statusBadge(valid ? value! >= pass : null)}</span>
      </div>
    </section>
  );
}

/** Notas del periodo: una nota final por materia; letra y estado salen de la escala. */
export function GradesPanel({ s }: { s: Schedule }) {
  const { onError, reloadSchedules, programs } = useDash();
  const settings = programs.find((p) => p.id === s.program_id) ?? null;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const finished = todayISO() > s.end_date;
  const missing = s.subjects.filter((m) => m.final_grade === null).length;

  const save = async (id: string, raw: string, current: number | null) => {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 100)) return onError("La nota va de 0 a 100.");
    if (value === current) return;
    setSaving(id);
    try {
      await api.setGrade(id, value);
      reloadSchedules();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar la nota.");
    } finally {
      setSaving(null);
    }
  };

  if (settings?.grading === "average") return <PeriodGrade key={`${s.id}-${s.final_grade}`} s={s} pass={settings.pass_min} />;
  if (!s.subjects.length) return null;
  const g = s.grades;

  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900"><Award className="w-4 h-4 text-amber-600" /> Notas del periodo</h2>
        <div className="flex flex-wrap gap-4 text-center">
          {[["Índice", g.period_index?.toFixed(2) ?? "—"], ["Promedio", g.average?.toString() ?? "—"], ["Aprobadas", `${g.passed}/${g.graded}`]].map(([l, v]) => (
            <div key={l}>
              <div className="text-base font-bold text-zinc-950 tabular-nums">{v}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{l}</div>
            </div>
          ))}
        </div>
      </div>
      {finished && missing > 0 && (
        <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-xs text-amber-900">Terminó el periodo: registra la nota final de {missing} materia(s) para calcular tu índice.</p>
      )}
      {!finished && <p className="text-[11px] text-zinc-400">Registra la nota final de cada materia al terminar el periodo.</p>}
      <ul className="divide-y divide-zinc-100">
        {s.subjects.map((m) => {
          const raw = draft[m.id] ?? (m.final_grade?.toString() ?? "");
          const num = raw.trim() === "" ? null : Number(raw);
          const valid = num !== null && !Number.isNaN(num) && num >= 0 && num <= 100;
          const band = valid && settings ? letterFor(num, settings.scale) : null;
          const passed = valid && settings ? num >= settings.pass_min : null;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-900 truncate">{m.name}</div>
                <div className="text-[11px] text-zinc-500">{m.credits != null ? `${m.credits} créditos` : "Sin créditos (no cuenta en el índice)"}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.1}
                  value={raw}
                  aria-label={`Nota final de ${m.name}`}
                  placeholder="—"
                  onChange={(e) => setDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                  onBlur={(e) => save(m.id, e.target.value, m.final_grade)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  className="w-20 px-2 py-1.5 rounded-xl border border-zinc-200 text-sm text-right tabular-nums"
                />
                <span className="w-8 text-center text-sm font-bold text-zinc-900">{band?.letter ?? ""}</span>
                <span className="w-24">{saving === m.id ? <Loader2 className="w-4 h-4 animate-spin text-zinc-400" /> : statusBadge(passed)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
