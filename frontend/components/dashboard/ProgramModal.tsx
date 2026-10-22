"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Award, BookOpen, ClipboardPaste, GraduationCap, History, Landmark, Loader2, Plus, Target, Trash2, X } from "lucide-react";
import { fieldInput, fieldLabel } from "./TaskFormModal";
import { useDash } from "./DashContext";
import { api, Course, CourseStatus, GradeBand, HonorLevel, Program, todayISO } from "@/lib/tasks";

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const str = (x: number | null | undefined) => (x == null ? "" : String(x));
const codes = (v: string) => v.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

const DEFAULT_SCALE: GradeBand[] = [
  { letter: "A", min: 90, points: 4 }, { letter: "B", min: 80, points: 3 }, { letter: "C", min: 70, points: 2 }, { letter: "D", min: 60, points: 1 }, { letter: "F", min: 0, points: 0 },
];
const DEFAULT_HONORS: HonorLevel[] = [{ name: "Summa Cum Laude", min: 3.8 }, { name: "Magna Cum Laude", min: 3.5 }, { name: "Cum Laude", min: 3.2 }];

type Tab = "general" | "pensum" | "goals" | "rules" | "history" | "scale";
const TABS: { id: Tab; label: string; icon: typeof Award }[] = [
  { id: "general", label: "General", icon: GraduationCap },
  { id: "pensum", label: "Pénsum", icon: BookOpen },
  { id: "goals", label: "Metas", icon: Target },
  { id: "rules", label: "Institución", icon: Landmark },
  { id: "history", label: "Historial", icon: History },
  { id: "scale", label: "Escala de notas", icon: Award },
];

export const COURSE_STATUS: Record<CourseStatus, { label: string; className: string }> = {
  aprobada: { label: "Aprobada", className: "bg-green-50 text-green-700 border-green-200" },
  cursando: { label: "Cursando", className: "bg-sky-50 text-sky-700 border-sky-200" },
  disponible: { label: "Disponible", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  bloqueada: { label: "Bloqueada", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

type Row = { code: string; name: string; credits: string; term: string; prereqs: string; coreqs: string; done: boolean };
const toRow = (c: Course): Row => ({ code: c.code, name: c.name, credits: str(c.credits), term: str(c.term), prereqs: c.prereqs.join(", "), coreqs: c.coreqs.join(", "), done: c.done });
const EMPTY_ROW: Row = { code: "", name: "", credits: "", term: "", prereqs: "", coreqs: "", done: false };

/** Pega filas de Excel o texto: código, materia, créditos, periodo, prerrequisitos, correquisitos (tab, ; o |). */
function parsePaste(text: string): Row[] {
  return text.split(/\r?\n/).map((line) => line.split(/\t|;|\|/).map((x) => x.trim())).filter((c) => c[0] && c[1])
    .map(([code, name, credits = "", term = "", pre = "", co = ""]) => ({
      code: code.toUpperCase(), name, credits: credits.replace(/\D/g, ""), term: term.replace(/\D/g, ""), prereqs: codes(pre).join(", "), coreqs: codes(co).join(", "), done: false,
    }));
}

/** Carrera: datos, pénsum, metas, reglas de la institución, historial previo y escala. null = nueva. */
export default function ProgramModal({ program, onClose }: { program: Program | null | undefined; onClose: () => void }) {
  return (
    <AnimatePresence>
      {program !== undefined && <ProgramForm key={program?.id ?? "new"} program={program} onClose={onClose} />}
    </AnimatePresence>
  );
}

function ProgramForm({ program, onClose }: { program: Program | null; onClose: () => void }) {
  const { programs, onInfo, reloadSchedules } = useDash();
  const p = program;
  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState(p?.name ?? "");
  const [institution, setInstitution] = useState(p?.institution ?? "");
  const [scale, setScale] = useState<GradeBand[]>(p?.scale ?? DEFAULT_SCALE);
  const [passMin, setPassMin] = useState(str(p?.pass_min ?? 70));
  const [honors, setHonors] = useState<HonorLevel[]>(p?.honors ?? DEFAULT_HONORS);
  const [f, setF] = useState({
    total_credits: str(p?.total_credits), total_subjects: str(p?.total_subjects), transfer_credits: str(p?.transfer_credits),
    plan_periods: str(p?.plan_periods), max_credits_per_period: str(p?.max_credits_per_period),
    target_index: str(p?.target_index), probation_min: str(p ? p.probation_min : 2), max_periods: str(p?.max_periods),
    min_institution_pct: str(p ? p.min_institution_pct : 50), prior_periods: str(p?.prior_periods),
    prior_index: str(p?.prior_index), prior_credits: str(p?.prior_credits), prior_courses: str(p?.prior_courses), prior_passed: str(p?.prior_passed), prior_failed: str(p?.prior_failed),
  });
  const [goalDate, setGoalDate] = useState(p?.goal_end_date ?? "");
  const [rows, setRows] = useState<Row[] | null>(p ? null : []);
  const [status, setStatus] = useState<Record<string, Course>>({});
  const [pensumDirty, setPensumDirty] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isMain = !!p && programs[0]?.id === p.id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!p) return;
    api.courses(p.id).then((r) => {
      setRows(r.courses.map(toRow));
      setStatus(Object.fromEntries(r.courses.map((c) => [c.code, c])));
    }).catch((e) => setError(e.message));
  }, [p]);

  const setBand = (i: number, patch: Partial<GradeBand>) => setScale((l) => l.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const setHonor = (i: number, patch: Partial<HonorLevel>) => setHonors((l) => l.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const editRows = (fn: (l: Row[]) => Row[]) => { setRows((l) => fn(l ?? [])); setPensumDirty(true); };
  const setRow = (i: number, patch: Partial<Row>) => editRows((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)));

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
    if (!name.trim()) {
      setTab("general");
      return setError("Ponle un nombre a la carrera, ej. \"Desarrollo de Software\".");
    }
    const filled = (rows ?? []).filter((r) => r.code.trim() || r.name.trim());
    const bad = filled.find((r) => !r.code.trim() || !r.name.trim());
    if (bad) {
      setTab("pensum");
      return setError("Cada materia del pénsum necesita código y nombre.");
    }
    const data = {
      name: name.trim(),
      institution: institution.trim() || null,
      scale: scale.map((b) => ({ letter: b.letter, min: Number(b.min), points: Number(b.points) })),
      pass_min: Number(passMin),
      honors: honors.filter((h) => h.name.trim()).map((h) => ({ name: h.name.trim(), min: Number(h.min) })),
      ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, num(v)])),
      goal_end_date: goalDate || null,
    };
    const courses = filled.map((r) => ({ code: r.code.trim(), name: r.name.trim(), credits: num(r.credits), term: num(r.term), prereqs: codes(r.prereqs), coreqs: codes(r.coreqs), done: r.done }));
    return run(async () => {
      const saved = p ? await api.updateProgram(p.id, data) : await api.createProgram(data);
      if (pensumDirty) await api.saveCourses(saved.id, courses);
    }, p ? "Carrera guardada." : "Carrera creada.");
  };

  const small = "w-full px-2.5 py-2 rounded-xl border border-zinc-200 text-sm tabular-nums";
  const numField = (k: keyof typeof f, label: string, step = "1", hint?: string) => (
    <label key={k} className="block">
      <span className={fieldLabel}>{label}</span>
      <input type="number" min={0} step={step} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={small} />
      {hint && <span className="block mt-0.5 text-[10px] text-zinc-400">{hint}</span>}
    </label>
  );
  const hint = (text: React.ReactNode) => <p className="text-xs text-zinc-500 leading-relaxed">{text}</p>;
  const current = TABS.find((t) => t.id === tab)!;
  const pensumCredits = (rows ?? []).reduce((a, r) => a + (Number(r.credits) || 0), 0);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div role="dialog" aria-modal="true" aria-label={p ? `Carrera ${p.name}` : "Nueva carrera"}
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90dvh] md:h-[min(680px,90vh)]">
        {/* Pestañas como en Configuración: a la izquierda en escritorio, arriba con scroll en el teléfono */}
        <div className="w-full md:w-56 bg-zinc-50 border-b md:border-b-0 md:border-r border-zinc-200/80 p-2.5 md:p-4 shrink-0 flex flex-col justify-between">
          <div className="space-y-0 md:space-y-4">
            <div className="hidden md:block px-2 pt-1">
              <div className="font-bold text-sm text-zinc-950 truncate">{p ? p.name : "Nueva carrera"}</div>
              {p?.institution && <div className="text-[11px] text-zinc-500 truncate">{p.institution}</div>}
            </div>
            <nav className="overflow-x-auto scrollbar-none flex flex-row md:flex-col gap-1.5 pb-1 md:pb-0" aria-label="Secciones de la carrera">
              {TABS.map((t) => (
                <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}
                  className={`w-auto md:w-full shrink-0 md:shrink whitespace-nowrap flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${tab === t.id ? "bg-emerald-700 text-white" : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"}`}>
                  <t.icon className="w-4 h-4 shrink-0" />
                  <span>{t.label}</span>
                  {t.id === "pensum" && rows && rows.length > 0 && <span className={`ml-auto text-[10px] tabular-nums ${tab === t.id ? "text-white/80" : "text-zinc-400"}`}>{rows.length}</span>}
                </button>
              ))}
            </nav>
          </div>
          {p && !isMain && (
            <button type="button" disabled={saving} onClick={() => window.confirm(`¿Eliminar la carrera "${p.name}"?`) && run(() => api.deleteProgram(p.id), "Carrera eliminada.")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Eliminar carrera</button>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-zinc-100">
            <h3 className="text-base font-bold text-zinc-950">{current.label}</h3>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
            {tab === "general" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className={fieldLabel}>Carrera</span>
                    <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ej. Desarrollo de Software" className={fieldInput} />
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>Institución (opcional)</span>
                    <input value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={120} placeholder="Ej. ITLA, UASD, PUCMM" className={fieldInput} />
                  </label>
                </div>
                {hint("Con los créditos totales se calcula lo que te falta y qué índice necesitas para tus metas. Si cargas el pénsum y dejas vacíos créditos y materias, se toman de ahí.")}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {numField("total_credits", "Créditos de la carrera", "1", rows?.length ? `Pénsum: ${pensumCredits}` : undefined)}
                  {numField("total_subjects", "Materias de la carrera", "1", rows?.length ? `Pénsum: ${rows.length}` : undefined)}
                  {numField("plan_periods", "Duración (periodos)", "1", "Ej. 7 cuatrimestres")}
                  {numField("transfer_credits", "Créditos convalidados", "1", "Avanzan el pénsum, no el índice")}
                </div>
              </>
            )}

            {tab === "pensum" && (
              rows === null ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> : (
                <>
                  {hint("Todas las materias de la carrera con su código. Prerrequisitos y correquisitos van por código, separados por coma. Al agregar una materia a un horario podrás elegir las que tienes disponibles.")}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => editRows((l) => [...l, { ...EMPTY_ROW, term: l.at(-1)?.term ?? "" }])} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"><Plus className="w-3.5 h-3.5" /> Materia</button>
                    <button type="button" onClick={() => setPaste(paste === null ? "" : null)} aria-expanded={paste !== null} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"><ClipboardPaste className="w-3.5 h-3.5" /> Pegar desde Excel</button>
                    {rows.length > 0 && <span className="ml-auto text-[11px] text-zinc-500 tabular-nums">{rows.length} materias · {pensumCredits} créditos</span>}
                  </div>
                  {paste !== null && (
                    <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2">
                      <p className="text-[11px] text-zinc-600">Una materia por línea con columnas: <b>código · materia · créditos · periodo · prerrequisitos · correquisitos</b>. Copia las filas desde Excel o sepáralas con <code>;</code>. Las que ya existan (mismo código) se reemplazan.</p>
                      <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder={"MAT-101; Precálculo; 5; 1\nMAT-201; Cálculo Diferencial; 5; 2; MAT-101"} className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-mono" />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setPaste(null)} className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">Cancelar</button>
                        <button type="button" disabled={!parsePaste(paste).length} onClick={() => {
                          const add = parsePaste(paste);
                          const byCode = new Map(add.map((r) => [r.code, r]));
                          editRows((l) => [...l.map((r) => byCode.get(r.code.toUpperCase()) ?? r), ...add.filter((r) => !l.some((x) => x.code.toUpperCase() === r.code))]);
                          setPaste(null);
                        }} className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-[11px] font-semibold disabled:opacity-40 cursor-pointer">Agregar {parsePaste(paste).length || ""}</button>
                      </div>
                    </div>
                  )}
                  {rows.length === 0 ? (
                    <p className="py-6 text-center text-xs text-zinc-400">Aún no hay materias en el pénsum.</p>
                  ) : (
                    <ul className="space-y-2">
                      {rows.map((r, i) => {
                        const s = !pensumDirty ? status[r.code.toUpperCase()] : undefined;
                        return (
                          <li key={i} className="p-2.5 rounded-2xl border border-zinc-200/80 space-y-2">
                            <div className="grid grid-cols-[5.5rem_1fr_3.5rem_3.5rem_auto] gap-2 items-center">
                              <input value={r.code} maxLength={30} aria-label="Código" placeholder="Código" onChange={(e) => setRow(i, { code: e.target.value.toUpperCase() })} className={`${small} font-semibold`} />
                              <input value={r.name} maxLength={150} aria-label="Materia" placeholder="Materia" onChange={(e) => setRow(i, { name: e.target.value })} className={small} />
                              <input type="number" min={0} max={60} value={r.credits} aria-label="Créditos" placeholder="Cr" title="Créditos" onChange={(e) => setRow(i, { credits: e.target.value })} className={small} />
                              <input type="number" min={1} max={60} value={r.term} aria-label="Periodo del pénsum" placeholder="Per." title="Periodo del pénsum" onChange={(e) => setRow(i, { term: e.target.value })} className={small} />
                              <button type="button" onClick={() => editRows((l) => l.filter((_, j) => j !== i))} aria-label={`Quitar ${r.name || r.code}`} className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                              <input value={r.prereqs} aria-label="Prerrequisitos" placeholder="Prerrequisitos (códigos)" onChange={(e) => setRow(i, { prereqs: e.target.value.toUpperCase() })} className={`${small} text-xs`} />
                              <input value={r.coreqs} aria-label="Correquisitos" placeholder="Correquisitos (códigos)" onChange={(e) => setRow(i, { coreqs: e.target.value.toUpperCase() })} className={`${small} text-xs`} />
                              <div className="flex items-center gap-2 justify-end">
                                {s && <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${COURSE_STATUS[s.status].className}`} title={s.missing_prereqs.length ? `Falta: ${s.missing_prereqs.join(", ")}` : undefined}>{COURSE_STATUS[s.status].label}</span>}
                                <label className="flex items-center gap-1 text-[11px] text-zinc-600 whitespace-nowrap cursor-pointer" title="Aprobada antes de usar la app o convalidada">
                                  <input type="checkbox" checked={r.done} onChange={(e) => setRow(i, { done: e.target.checked })} className="accent-emerald-700" /> Ya aprobada
                                </label>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="text-[11px] text-zinc-400">Las materias de tus horarios cuentan como aprobadas si tienen el mismo código o las elegiste del pénsum. Marca &quot;Ya aprobada&quot; solo las que no registraste en la app.</p>
                </>
              )
            )}

            {tab === "goals" && (
              <>
                {hint("Tus honores, un índice propio y una fecha para terminar. En Análisis → Notas y carrera verás si es posible y qué necesitas.")}
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900">Honores</h4>
                  <button type="button" onClick={() => setHonors((l) => [...l, { name: "", min: 3 }])} disabled={honors.length >= 8} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 disabled:opacity-40 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Honor</button>
                </div>
                {honors.map((h, i) => (
                  <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2 items-center">
                    <input value={h.name} maxLength={40} aria-label="Nombre del honor" onChange={(e) => setHonor(i, { name: e.target.value })} className={small} />
                    <input type="number" min={0} max={5} step={0.01} value={h.min} aria-label="Índice mínimo" onChange={(e) => setHonor(i, { min: Number(e.target.value) })} className={small} />
                    <button type="button" onClick={() => setHonors((l) => l.filter((_, j) => j !== i))} aria-label="Quitar honor" className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <label className="block">
                    <span className={fieldLabel}>Índice deseado (opcional)</span>
                    <input type="number" min={0} max={5} step={0.01} value={f.target_index} onChange={(e) => setF((x) => ({ ...x, target_index: e.target.value }))} className={small} />
                    <span className="block mt-0.5 text-[10px] text-zinc-400">Mismo cálculo que los honores, sin sus requisitos</span>
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>Terminar la carrera para (opcional)</span>
                    <input type="date" value={goalDate} min={todayISO()} onChange={(e) => setGoalDate(e.target.value)} className={small} />
                    <span className="flex flex-wrap gap-1 mt-1">
                      {[6, 12, 18, 24].map((mo) => (
                        <button key={mo} type="button" onClick={() => setGoalDate(addMonths(todayISO(), mo))} className="px-2 py-0.5 rounded-lg border border-zinc-200 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer">{mo} meses</button>
                      ))}
                      {goalDate && <button type="button" onClick={() => setGoalDate("")} className="px-2 py-0.5 text-[10px] font-semibold text-zinc-400 hover:text-rose-600 cursor-pointer">Quitar</button>}
                    </span>
                  </label>
                </div>
              </>
            )}

            {tab === "rules" && (
              <>
                {hint("Reglas de tu institución. Para honores, una materia reprobada en cualquier momento los anula, aunque la repitas y apruebes. Deja vacío lo que no aplique.")}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {numField("max_credits_per_period", "Límite de créditos por periodo", "1", "Lo máximo que puedes inscribir")}
                  {numField("probation_min", "Índice mínimo (condición de prueba)", "0.01", "Por debajo = en prueba")}
                  {numField("max_periods", "Permanencia máxima", "1", "En periodos")}
                  {numField("min_institution_pct", "% mínimo cursado en la institución", "1", "Para honores, sin convalidar")}
                </div>
              </>
            )}

            {tab === "history" && (
              <>
                {hint(<>Si no quieres registrar tus periodos pasados materia por materia, escribe aquí tu resumen; tu índice acumulado lo combinará con las notas de la app. Registrar los periodos (botón &quot;Periodo anterior&quot;) da un análisis más completo. <b>No repitas aquí lo que ya está como horario.</b></>)}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {numField("prior_periods", "Periodos", "1", "Solo los que no están como horario")}
                  {numField("prior_index", "Índice de esos periodos", "0.01")}
                  {numField("prior_credits", "Créditos cursados")}
                  {numField("prior_courses", "Materias cursadas")}
                  {numField("prior_passed", "Aprobadas")}
                  {numField("prior_failed", "Reprobadas")}
                </div>
              </>
            )}

            {tab === "scale" && (
              <>
                <div className="flex items-center justify-between gap-3">
                  {hint("Cada letra empieza en una nota mínima y vale ciertos puntos para el índice. La escala típica es A 90 · B 80 · C 70 · D 60 · F 0.")}
                  <button type="button" onClick={() => setScale((l) => [...l, { letter: "", min: 0, points: 0 }])} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Tramo</button>
                </div>
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
              </>
            )}
          </div>

          <div className="px-5 sm:px-6 py-4 border-t border-zinc-100 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-xs text-rose-600 font-medium min-w-0" role="alert">{error}</p>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">Cancelar</button>
              <button type="button" onClick={save} disabled={saving || rows === null} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
