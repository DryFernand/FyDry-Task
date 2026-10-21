"use client";

import { useState } from "react";
import { Award, Loader2, Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import { fieldInput, fieldLabel } from "./TaskFormModal";
import { useDash } from "./DashContext";
import { api, GradeBand, HonorLevel, letterFor, Program, Schedule, todayISO } from "@/lib/tasks";

export const statusBadge = (passed: boolean | null) =>
  passed === null ? null : passed ? (
    <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-green-50 text-green-700 border-green-200">✓ Aprobada</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-rose-50 text-rose-700 border-rose-200">✗ Reprobada</span>
  );

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
const str = (x: number | null | undefined) => (x == null ? "" : String(x));

const DEFAULT_SCALE: GradeBand[] = [
  { letter: "A", min: 90, points: 4 }, { letter: "B", min: 80, points: 3 }, { letter: "C", min: 70, points: 2 }, { letter: "D", min: 60, points: 1 }, { letter: "F", min: 0, points: 0 },
];
const DEFAULT_HONORS: HonorLevel[] = [{ name: "Summa Cum Laude", min: 3.8 }, { name: "Magna Cum Laude", min: 3.5 }, { name: "Cum Laude", min: 3.2 }];

/** Carrera: datos, pénsum, metas, requisitos de honores, historial previo y escala de notas. null = nueva. */
export function ProgramModal({ program, onClose }: { program: Program | null | undefined; onClose: () => void }) {
  if (program === undefined) return null;
  return <ProgramForm key={program?.id ?? "new"} program={program} onClose={onClose} />;
}

function ProgramForm({ program, onClose }: { program: Program | null; onClose: () => void }) {
  const { programs, onInfo, reloadSchedules } = useDash();
  const p = program;
  const [name, setName] = useState(p?.name ?? "");
  const [institution, setInstitution] = useState(p?.institution ?? "");
  const [scale, setScale] = useState<GradeBand[]>(p?.scale ?? DEFAULT_SCALE);
  const [passMin, setPassMin] = useState(str(p?.pass_min ?? 70));
  const [honors, setHonors] = useState<HonorLevel[]>(p?.honors ?? DEFAULT_HONORS);
  const [f, setF] = useState({
    total_credits: str(p?.total_credits), total_subjects: str(p?.total_subjects), transfer_credits: str(p?.transfer_credits),
    target_index: str(p?.target_index), probation_min: str(p ? p.probation_min : 2), max_periods: str(p?.max_periods),
    min_institution_pct: str(p ? p.min_institution_pct : 50), prior_periods: str(p?.prior_periods),
    prior_index: str(p?.prior_index), prior_credits: str(p?.prior_credits), prior_courses: str(p?.prior_courses), prior_passed: str(p?.prior_passed), prior_failed: str(p?.prior_failed),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isMain = !!p && programs[0]?.id === p.id;

  const setBand = (i: number, patch: Partial<GradeBand>) => setScale((l) => l.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const setHonor = (i: number, patch: Partial<HonorLevel>) => setHonors((l) => l.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setSaving(true);
    setError("");
    try {
      await fn();
      onInfo(ok);
      reloadSchedules();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!name.trim()) return setError("Ponle un nombre a la carrera, ej. \"Desarrollo de Software\".");
    const data = {
      name: name.trim(),
      institution: institution.trim() || null,
      scale: scale.map((b) => ({ letter: b.letter, min: Number(b.min), points: Number(b.points) })),
      pass_min: Number(passMin),
      honors: honors.filter((h) => h.name.trim()).map((h) => ({ name: h.name.trim(), min: Number(h.min) })),
      ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, num(v)])),
    };
    return run(() => (p ? api.updateProgram(p.id, data) : api.createProgram(data)), p ? "Carrera guardada." : "Carrera creada.");
  };

  const small = "w-full px-2.5 py-2 rounded-xl border border-zinc-200 text-sm tabular-nums";
  const numField = (k: keyof typeof f, label: string, step = "1", hint?: string) => (
    <label key={k} className="block">
      <span className={fieldLabel}>{label}</span>
      <input type="number" min={0} step={step} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={small} />
      {hint && <span className="block mt-0.5 text-[10px] text-zinc-400">{hint}</span>}
    </label>
  );

  return (
    <Modal open wide onClose={onClose} title={p ? `Carrera · ${p.name}` : "Nueva carrera"}
      footer={
        <div className="flex items-center justify-between gap-2">
          {p && !isMain ? (
            <button type="button" disabled={saving} onClick={() => window.confirm(`¿Eliminar la carrera "${p.name}"?`) && run(() => api.deleteProgram(p.id), "Carrera eliminada.")}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">Cancelar</button>
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
            </button>
          </div>
        </div>
      }>
      <div className="space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={fieldLabel}>Carrera</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ej. Desarrollo de Software" className={fieldInput} />
          </label>
          <label className="block">
            <span className={fieldLabel}>Institución (opcional)</span>
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={120} placeholder="Ej. ITLA, UASD, PUCMM" className={fieldInput} />
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-900">Pénsum</h3>
          <p className="text-[11px] text-zinc-500">Con los créditos totales se calcula lo que te falta y qué índice necesitas para tus metas.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {numField("total_credits", "Créditos de la carrera")}
            {numField("total_subjects", "Materias de la carrera")}
            {numField("transfer_credits", "Créditos convalidados", "1", "Avanzan el pénsum, no cuentan en el índice")}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900">Metas: honores e índice deseado</h3>
            <button type="button" onClick={() => setHonors((l) => [...l, { name: "", min: 3 }])} disabled={honors.length >= 8} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-40 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Honor</button>
          </div>
          {honors.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2 items-center">
              <input value={h.name} maxLength={40} aria-label="Nombre del honor" onChange={(e) => setHonor(i, { name: e.target.value })} className={small} />
              <input type="number" min={0} max={5} step={0.01} value={h.min} aria-label="Índice mínimo" onChange={(e) => setHonor(i, { min: Number(e.target.value) })} className={small} />
              <button type="button" onClick={() => setHonors((l) => l.filter((_, j) => j !== i))} aria-label="Quitar honor" className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_6rem_auto] gap-2 items-center">
            <span className="text-xs text-zinc-700 pl-1">Índice deseado (opcional, no requiere los requisitos de honores)</span>
            <input type="number" min={0} max={5} step={0.01} value={f.target_index} aria-label="Índice deseado" onChange={(e) => setF((x) => ({ ...x, target_index: e.target.value }))} className={small} />
            <span className="w-8" />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-900">Requisitos de honores</h3>
          <p className="text-[11px] text-zinc-500">Una materia reprobada en cualquier momento anula los honores, aunque la repitas y apruebes. Deja vacío lo que tu institución no exija.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {numField("probation_min", "Índice mínimo (prueba)", "0.01", "Por debajo = condición de prueba")}
            {numField("max_periods", "Permanencia máxima", "1", "En periodos")}
            {numField("prior_periods", "Periodos antes de la app", "1", "Para contar el tiempo")}
            {numField("min_institution_pct", "% mínimo en la institución", "1", "Del pénsum, sin convalidar")}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-zinc-900">Historial anterior (opcional)</h3>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Si no quieres registrar tus periodos pasados materia por materia, escribe aquí tu resumen. Tu índice acumulado combinará esto con las notas que registres en la app.
            Registrar los periodos anteriores (botón &quot;Periodo anterior&quot;) da un análisis más completo.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {numField("prior_index", "Índice actual", "0.01")}
            {numField("prior_credits", "Créditos cursados")}
            {numField("prior_courses", "Materias cursadas")}
            {numField("prior_passed", "Aprobadas")}
            {numField("prior_failed", "Reprobadas")}
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
    </Modal>
  );
}
