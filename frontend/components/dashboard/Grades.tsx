"use client";

import { useEffect, useState } from "react";
import { Award, Loader2, Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { fieldLabel } from "./TaskFormModal";
import { useDash } from "./DashContext";
import { AcademicSettings, api, GradeBand, letterFor, Schedule, todayISO } from "@/lib/tasks";

export const statusBadge = (passed: boolean | null) =>
  passed === null ? null : passed ? (
    <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-green-50 text-green-700 border-green-200">✓ Aprobada</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-rose-50 text-rose-700 border-rose-200">✗ Reprobada</span>
  );

/** Notas del periodo: una nota final por materia; letra y estado salen de la escala. */
export function GradesPanel({ s }: { s: Schedule }) {
  const { onError, reloadSchedules } = useDash();
  const [settings, setSettings] = useState<AcademicSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const finished = todayISO() > s.end_date;
  const missing = s.subjects.filter((m) => m.final_grade === null).length;

  useEffect(() => {
    api.academicSettings().then(setSettings).catch((e) => onError(e.message));
  }, [onError]);

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

const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Escala de notas, nota mínima para aprobar e historial previo (resumen manual). */
export function AcademicModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <AcademicForm onClose={onClose} />;
}

function AcademicForm({ onClose }: { onClose: () => void }) {
  const { onError, onInfo, reloadSchedules } = useDash();
  const [loaded, setLoaded] = useState<AcademicSettings | null>(null);
  const [scale, setScale] = useState<GradeBand[]>([]);
  const [passMin, setPassMin] = useState("70");
  const [prior, setPrior] = useState({ index: "", credits: "", courses: "", passed: "", failed: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.academicSettings().then((st) => {
      setLoaded(st);
      setScale(st.scale);
      setPassMin(String(st.pass_min));
      const v = (x: number | null) => (x == null ? "" : String(x));
      setPrior({ index: v(st.prior_index), credits: v(st.prior_credits), courses: v(st.prior_courses), passed: v(st.prior_passed), failed: v(st.prior_failed) });
    }).catch((e) => onError(e.message));
  }, [onError]);

  const setBand = (i: number, patch: Partial<GradeBand>) => setScale((l) => l.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.saveAcademicSettings({
        scale: scale.map((b) => ({ letter: b.letter, min: Number(b.min), points: Number(b.points) })),
        pass_min: Number(passMin),
        prior_index: num(prior.index),
        prior_credits: num(prior.credits),
        prior_courses: num(prior.courses),
        prior_passed: num(prior.passed),
        prior_failed: num(prior.failed),
      });
      onInfo("Configuración académica guardada.");
      reloadSchedules();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const small = "w-full px-2.5 py-2 rounded-xl border border-zinc-200 text-sm tabular-nums";
  return (
    <Modal open wide onClose={onClose} title="Historial académico y escala de notas"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">Cancelar</button>
          <button type="button" onClick={save} disabled={saving || !loaded} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
          </button>
        </div>
      }>
      {!loaded ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-900">Historial anterior (opcional)</h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Si no quieres registrar tus periodos pasados materia por materia, escribe aquí tu resumen. Tu índice acumulado combinará esto con las notas que registres en la app.
              Registrar los periodos anteriores (botón &quot;Periodo anterior&quot;) da un análisis más completo.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {([["index", "Índice actual", "0.01"], ["credits", "Créditos cursados", "1"], ["courses", "Materias cursadas", "1"], ["passed", "Aprobadas", "1"], ["failed", "Reprobadas", "1"]] as const).map(([k, l, step]) => (
                <label key={k} className="block">
                  <span className={fieldLabel}>{l}</span>
                  <input type="number" min={0} step={step} value={prior[k]} onChange={(e) => setPrior((p) => ({ ...p, [k]: e.target.value }))} className={small} />
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900">Escala de notas</h3>
              <button type="button" onClick={() => setScale((l) => [...l, { letter: "", min: 0, points: 0 }])} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Tramo</button>
            </div>
            <p className="text-[11px] text-zinc-500">Cada letra empieza en una nota mínima y vale ciertos puntos para el índice. La escala típica es A 90 · B 80 · C 70 · D 60 · F 0.</p>
            <div className="grid grid-cols-[4rem_1fr_1fr_auto] gap-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              <span>Letra</span><span>Desde (nota)</span><span>Puntos</span><span />
            </div>
            {scale.map((b, i) => (
              <div key={i} className="grid grid-cols-[4rem_1fr_1fr_auto] gap-2 items-center">
                <input value={b.letter} maxLength={3} aria-label="Letra" onChange={(e) => setBand(i, { letter: e.target.value.toUpperCase() })} className={small} />
                <input type="number" min={0} max={100} value={b.min} aria-label="Nota mínima" onChange={(e) => setBand(i, { min: Number(e.target.value) })} className={small} />
                <input type="number" min={0} max={5} step={0.1} value={b.points} aria-label="Puntos" onChange={(e) => setBand(i, { points: Number(e.target.value) })} className={small} />
                <button type="button" onClick={() => setScale((l) => l.filter((_, j) => j !== i))} disabled={scale.length <= 2} aria-label="Quitar tramo" className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <label className="flex items-center gap-2 pt-2 text-xs text-zinc-700">
              Se aprueba con
              <input type="number" min={0} max={100} value={passMin} onChange={(e) => setPassMin(e.target.value)} aria-label="Nota mínima para aprobar" className="w-20 px-2.5 py-1.5 rounded-xl border border-zinc-200 text-sm tabular-nums" />
              o más
            </label>
            <p className="text-[11px] text-zinc-400">Las materias reprobadas y las repetidas cuentan en el índice con sus créditos.</p>
          </section>
          {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

