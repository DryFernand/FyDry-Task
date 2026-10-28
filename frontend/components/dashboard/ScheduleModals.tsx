"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, ExternalLink, Loader2, MapPin, Plus, Trash2, User } from "lucide-react";
import Modal from "./Modal";
import TaskRow from "./TaskRow";
import { fieldInput, fieldLabel } from "./TaskFormModal";
import { useDash } from "./DashContext";
import { Bone, Loading, RowBones } from "./Skeleton";
import {
  api, Course, hoursLabel, Modality, PERIOD_META, PeriodType, Schedule, SessionInput, Subject, suggestedEnd, Task, todayISO, WEEKDAY_LONG,
} from "@/lib/tasks";

const SUBJECT_COLORS = ["#6e2234", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#52525b"];

const SaveFooter = ({ onClose, onSave, saving, label = "Guardar", extra }: { onClose: () => void; onSave: () => void; saving: boolean; label?: string; extra?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <div>{extra}</div>
    <div className="flex items-center gap-2">
      <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">Cancelar</button>
      <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {label}
      </button>
    </div>
  </div>
);

// ============ Horario (periodo) ============
export type ScheduleFormTarget = { kind: "new"; programId?: string } | { kind: "edit"; schedule: Schedule } | { kind: "duplicate"; schedule: Schedule };

export function ScheduleFormModal({ target, onClose, onSaved }: { target: ScheduleFormTarget | null; onClose: () => void; onSaved: () => void }) {
  if (!target) return null;
  return <ScheduleForm target={target} onClose={onClose} onSaved={onSaved} />;
}

function ScheduleForm({ target, onClose, onSaved }: { target: ScheduleFormTarget; onClose: () => void; onSaved: () => void }) {
  const src = target.kind === "new" ? null : target.schedule;
  const dup = target.kind === "duplicate";
  const firstStart = dup ? todayISO() : src?.start_date ?? todayISO();
  const [name, setName] = useState(dup ? "" : src?.name ?? "");
  const { programs } = useDash();
  const [programId, setProgramId] = useState(src?.program_id ?? (target.kind === "new" ? target.programId : undefined) ?? programs[0]?.id ?? "");
  const programType = (id: string) => programs.find((x) => x.id === id)?.period_type ?? "cuatrimestral";
  // Horario nuevo o duplicado: el tipo sale de la carrera
  const [type, setType] = useState<PeriodType>(src && !dup ? src.period_type : programType(programId));
  const [pickType, setPickType] = useState(false);
  const [start, setStart] = useState(firstStart);
  const [end, setEnd] = useState(src && !dup ? src.end_date : suggestedEnd(firstStart, type) ?? firstStart);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Al cambiar tipo o inicio se recalcula el fin (salvo personalizado)
  const recalc = (t: PeriodType, s: string) => {
    const e = suggestedEnd(s, t);
    if (e) setEnd(e);
  };

  const save = async () => {
    if (!name.trim()) return setError("Ponle un nombre, ej. \"Cuatrimestre sep–dic 2026\".");
    if (end < start) return setError("La fecha de fin debe ser posterior al inicio.");
    setSaving(true);
    setError("");
    const data = { name: name.trim(), program_id: programId || null, period_type: type, start_date: start, end_date: end };
    try {
      if (target.kind === "edit") await api.updateSchedule(target.schedule.id, data);
      else if (dup) await api.duplicateSchedule(target.schedule.id, data);
      else await api.createSchedule(data);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open wide onClose={onClose} title={dup ? `Duplicar “${src!.name}” para otro periodo` : src ? "Editar horario" : "Nuevo horario"}
      footer={<SaveFooter onClose={onClose} onSave={save} saving={saving} label={dup ? "Duplicar" : "Guardar"} />}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {dup && <p className="text-xs text-zinc-600 bg-zinc-50 rounded-xl p-2.5">Se copian las {src!.subjects.length} materias con sus clases. La asistencia empieza de cero.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="sch-name" className={fieldLabel}>Nombre</label>
            <input id="sch-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ej. Cuatrimestre sep–dic 2026" className={fieldInput} />
          </div>
          <div>
            <label htmlFor="sch-prog" className={fieldLabel}>Carrera</label>
            <select id="sch-prog" value={programId} onChange={(e) => { setProgramId(e.target.value); if (!pickType) { const t = programType(e.target.value); setType(t); recalc(t, start); } }} className={fieldInput}>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.institution ? ` · ${p.institution}` : ""}</option>)}
            </select>
          </div>
        </div>
        <div>
          <span className={fieldLabel}>Tipo de periodo</span>
          {!pickType && type === programType(programId) ? (
            <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white font-semibold">{PERIOD_META[type].label}{PERIOD_META[type].months ? ` · ${PERIOD_META[type].months} m` : ""}</span>
              <span className="text-zinc-400">el de la carrera</span>
              <button type="button" onClick={() => setPickType(true)} className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer">Cambiar (verano, personalizado…)</button>
            </p>
          ) : (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de periodo">
            {(Object.keys(PERIOD_META) as PeriodType[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => { setType(t); recalc(t, start); }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${type === t ? "bg-emerald-700 border-emerald-700 text-white" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                {PERIOD_META[t].label}{PERIOD_META[t].months ? ` · ${PERIOD_META[t].months} m` : ""}
              </button>
            ))}
          </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sch-start" className={fieldLabel}>Inicio</label>
            <input id="sch-start" type="date" value={start} onChange={(e) => { if (!e.target.value) return; setStart(e.target.value); recalc(type, e.target.value); }} className={fieldInput} />
          </div>
          <div>
            <label htmlFor="sch-end" className={fieldLabel}>Fin</label>
            <input id="sch-end" type="date" value={end} min={start} onChange={(e) => e.target.value && setEnd(e.target.value)} className={fieldInput} />
          </div>
        </div>
        {!src && end < todayISO() && (
          <p className="text-[11px] text-zinc-600 bg-amber-50 border border-amber-200/70 rounded-xl p-2.5">Es un periodo pasado: agrega sus materias con créditos (las clases semanales son opcionales) y registra cada nota final en &quot;Notas del periodo&quot;.</p>
        )}
        {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// ============ Materia con sus clases ============
export type SubjectFormTarget = { kind: "new"; scheduleId: string } | { kind: "edit"; subject: Subject };

export function SubjectFormModal({ target, onClose, onSaved }: { target: SubjectFormTarget | null; onClose: () => void; onSaved: () => void }) {
  if (!target) return null;
  return <SubjectForm target={target} onClose={onClose} onSaved={onSaved} />;
}

function SubjectForm({ target, onClose, onSaved }: { target: SubjectFormTarget; onClose: () => void; onSaved: () => void }) {
  const { onInfo, schedules } = useDash();
  const src = target.kind === "edit" ? target.subject : null;
  const programId = schedules.find((x) => x.id === (src ? src.schedule_id : target.kind === "new" ? target.scheduleId : ""))?.program_id;
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string | null>(src?.course_id ?? null);
  const [name, setName] = useState(src?.name ?? "");
  const [code, setCode] = useState(src?.code ?? "");
  const [teacher, setTeacher] = useState(src?.teacher ?? "");
  const [color, setColor] = useState(src?.color ?? SUBJECT_COLORS[1]);
  const [credits, setCredits] = useState<string>(src?.credits != null ? String(src.credits) : "");
  const [modality, setModality] = useState<Modality>(src?.modality ?? "presencial");
  const [location, setLocation] = useState(src?.location ?? "");
  const [link, setLink] = useState(src?.link ?? "");
  const [sessions, setSessions] = useState<SessionInput[]>(
    src?.sessions.map((s) => ({ id: s.id, weekday: s.weekday, start_time: s.start_time, end_time: s.end_time, location: s.location })) ?? [{ weekday: 0, start_time: "08:00", end_time: "10:00", location: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (programId) api.courses(programId).then((r) => setCourses(r.courses)).catch(() => setCourses([]));
  }, [programId]);

  const course = courses.find((c) => c.id === courseId);
  const open = courses.filter((c) => c.status === "disponible" || c.id === courseId);
  const locked = courses.filter((c) => c.status === "bloqueada" && c.id !== courseId);
  const byCode = (code: string) => courses.find((c) => c.code === code);
  const pick = (id: string) => {
    const c = courses.find((x) => x.id === id);
    setCourseId(c?.id ?? null);
    if (!c) return;
    setName(c.name);
    setCode(c.code);
    setCredits(c.credits != null ? String(c.credits) : "");
  };

  const setSession = (i: number, patch: Partial<SessionInput>) => setSessions((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const save = async () => {
    if (!name.trim()) return setError("Escribe el nombre de la materia.");
    const bad = sessions.find((s) => s.end_time <= s.start_time);
    if (bad) return setError(`La clase del ${WEEKDAY_LONG[bad.weekday].toLowerCase()} debe terminar después de empezar.`);
    setSaving(true);
    setError("");
    const data = {
      name: name.trim(), code: code.trim() || null, teacher: teacher.trim() || null, color, credits: credits ? Number(credits) : null,
      modality, location: location.trim() || null, link: link.trim() || null, course_id: courseId,
      sessions: sessions.map((s) => ({ ...s, location: (s.location || "").trim() || null })),
    };
    try {
      const sch = src ? await api.updateSubject(src.id, data) : await api.createSubject(target.kind === "new" ? target.scheduleId : "", data);
      const saved = src ? sch.subjects.find((m) => m.id === src.id) : sch.subjects[sch.subjects.length - 1];
      const clashes = saved?.sessions.filter((s) => s.conflicts.length).length ?? 0;
      if (clashes) onInfo(`⚠️ ${clashes} clase(s) de ${data.name} chocan con otra materia.`);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open wide onClose={onClose} title={src ? `Editar ${src.name}` : "Nueva materia"} footer={<SaveFooter onClose={onClose} onSave={save} saving={saving} />}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {courses.length > 0 && (
          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
            <label htmlFor="sub-course" className={fieldLabel}>Del pénsum · {open.length} disponible(s)</label>
            <select id="sub-course" value={courseId ?? ""} onChange={(e) => pick(e.target.value)} className={fieldInput}>
              <option value="">Otra materia (fuera del pénsum)</option>
              <optgroup label="Disponibles: tienes los prerrequisitos">
                {open.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}{c.credits != null ? ` · ${c.credits} cr` : ""}{c.term ? ` · periodo ${c.term}` : ""}{c.failed_before ? " · repetir" : ""}</option>)}
              </optgroup>
              {locked.length > 0 && (
                <optgroup label="Bloqueadas: faltan prerrequisitos">
                  {locked.map((c) => <option key={c.id} value={c.id} disabled>{c.code} · {c.name} — falta {c.missing_prereqs.join(", ")}</option>)}
                </optgroup>
              )}
            </select>
            {course && course.pending_coreqs.length > 0 && (
              <p className="text-[11px] text-amber-800">Llévala en el mismo periodo que: {course.pending_coreqs.map((x) => `${x}${byCode(x) ? ` (${byCode(x)!.name})` : ""}`).join(", ")}.</p>
            )}
            {course?.failed_before && <p className="text-[11px] text-zinc-600">La reprobaste antes: esta vez cuenta como repetida y las dos notas entran en el índice.</p>}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="sub-name" className={fieldLabel}>Materia</label>
            <input id="sub-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={150} placeholder="Ej. Cálculo Integral" className={fieldInput} />
          </div>
          <div>
            <label htmlFor="sub-code" className={fieldLabel}>Código (opcional)</label>
            <input id="sub-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} placeholder="MAT-251" className={fieldInput} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="sub-teacher" className={fieldLabel}>Profesor (opcional)</label>
            <input id="sub-teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)} maxLength={120} className={fieldInput} />
          </div>
          <div>
            <label htmlFor="sub-credits" className={fieldLabel}>Créditos (opcional)</label>
            <input id="sub-credits" type="number" min={0} max={60} value={credits} onChange={(e) => setCredits(e.target.value)} className={fieldInput} />
          </div>
        </div>
        <div>
          <span className={fieldLabel}>Color</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de la materia">
            {SUBJECT_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${c}`} onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-xl cursor-pointer ring-offset-2 ${color === c ? "ring-2 ring-zinc-900" : ""}`} style={{ background: c }} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Otro color" className="w-8 h-8 rounded-xl border border-zinc-200 cursor-pointer p-0.5 bg-white" />
          </div>
        </div>
        <div>
          <span className={fieldLabel}>Modalidad</span>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-zinc-100 max-w-sm" role="radiogroup" aria-label="Modalidad">
            {(["presencial", "virtual", "mixta"] as Modality[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={modality === m} onClick={() => setModality(m)}
                className={`py-1.5 rounded-lg text-[11px] font-semibold capitalize cursor-pointer ${modality === m ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modality !== "virtual" && (
            <div>
              <label htmlFor="sub-loc" className={fieldLabel}>Aula (opcional)</label>
              <input id="sub-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="Ej. Aula 204" className={fieldInput} />
            </div>
          )}
          {modality !== "presencial" && (
            <div>
              <label htmlFor="sub-link" className={fieldLabel}>Enlace de la clase (opcional)</label>
              <input id="sub-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="https://meet…" className={fieldInput} />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900">Clases de la semana</span>
            <button type="button" onClick={() => setSessions((l) => [...l, { weekday: l.length ? (l[l.length - 1].weekday + 2) % 7 : 0, start_time: "08:00", end_time: "10:00", location: "" }])}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 cursor-pointer"><Plus className="w-3.5 h-3.5" /> Agregar clase</button>
          </div>
          {sessions.length === 0 && <p className="text-[11px] text-zinc-400">Sin clases semanales (por ejemplo, una materia solo con entregas).</p>}
          {sessions.map((s, i) => (
            <div key={s.id ?? `new-${i}`} className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[8rem_auto_auto_1fr_auto] gap-2 items-center">
              <select value={s.weekday} onChange={(e) => setSession(i, { weekday: Number(e.target.value) })} aria-label="Día" className="px-2 py-2 rounded-xl border border-zinc-200 bg-white text-sm">
                {WEEKDAY_LONG.map((d, j) => <option key={d} value={j}>{d}</option>)}
              </select>
              <input type="time" value={s.start_time} onChange={(e) => e.target.value && setSession(i, { start_time: e.target.value })} aria-label="Empieza" className="px-2 py-2 rounded-xl border border-zinc-200 text-sm" />
              <input type="time" value={s.end_time} onChange={(e) => e.target.value && setSession(i, { end_time: e.target.value })} aria-label="Termina" className="px-2 py-2 rounded-xl border border-zinc-200 text-sm" />
              <input value={s.location ?? ""} onChange={(e) => setSession(i, { location: e.target.value })} maxLength={120} placeholder="Aula (si cambia)" aria-label="Aula de esta clase" className="col-span-3 sm:col-span-1 order-last sm:order-none px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
              <button type="button" onClick={() => setSessions((l) => l.filter((_, j) => j !== i))} aria-label="Quitar clase" className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// ============ Detalle de la materia: clases y asignaciones ============
export function SubjectDetailModal({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  if (!subject) return null;
  return <SubjectDetail key={subject.id} subject={subject} onClose={onClose} />;
}

function SubjectDetail({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { catOf, refreshKey, onError, actions, schedules } = useDash();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [version, setVersion] = useState(0);
  const today = todayISO();
  const clashNames = (ids: string[]) =>
    schedules.flatMap((sc) => sc.subjects).filter((m) => m.sessions.some((s) => ids.includes(s.id))).map((m) => m.name).join(", ");

  useEffect(() => {
    let alive = true;
    api.subjectAssignments(subject.id).then((t) => alive && setTasks(t)).catch((e) => onError(e.message));
    return () => { alive = false; };
  }, [subject.id, refreshKey, version, onError]);

  const list = (tasks ?? []).filter((t) => t.status !== "postponed");
  const overdue = list.filter((t) => t.status === "pending" && t.date && t.date < today);
  const upcoming = list.filter((t) => t.status === "pending" && (!t.date || t.date >= today));
  const finished = list.filter((t) => t.status !== "pending");
  const doneRate = finished.length ? finished.reduce((s, t) => s + (t.status === "done" ? 1 : t.status === "partial" ? 0.5 : 0), 0) / finished.length : null;
  const rowProps = { onChanged: () => setVersion((v) => v + 1), onEdit: actions.editTask, onError, compact: true };

  return (
    <Modal open wide onClose={onClose} title={subject.name}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => { onClose(); actions.editSubject(subject); }} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer">Editar materia</button>
          <button type="button" onClick={() => { onClose(); actions.newTask(today); }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold cursor-pointer"><Plus className="w-3.5 h-3.5" /> Nueva asignación</button>
        </div>
      }>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: subject.color }} aria-hidden="true" />{subject.code || "Sin código"}</span>
          {subject.teacher && <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> {subject.teacher}</span>}
          {subject.credits != null && <span>{subject.credits} créditos</span>}
          <span className="capitalize">{subject.modality}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {hoursLabel(subject.weekly_minutes)} por semana</span>
          {subject.link && <a href={subject.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><ExternalLink className="w-3.5 h-3.5" /> Enlace</a>}
        </div>

        <section>
          <h3 className="text-xs font-bold text-zinc-900 mb-2">Clases</h3>
          {subject.sessions.length === 0 ? <p className="text-xs text-zinc-400">Sin clases semanales.</p> : (
            <ul className="space-y-1.5">
              {subject.sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-800">
                  <span className="font-semibold w-24">{WEEKDAY_LONG[s.weekday]}</span>
                  <span className="tabular-nums">{s.start_time}–{s.end_time}</span>
                  {(s.location || subject.location) && <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><MapPin className="w-3.5 h-3.5" />{s.location || subject.location}</span>}
                  {s.conflicts.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> Choca con {clashNames(s.conflicts)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-zinc-900">Asignaciones{tasks !== null && ` · ${list.length}`}</h3>
            {tasks === null ? <Bone className="h-3 w-24" /> : <span className="text-[11px] text-zinc-500">{doneRate === null ? "Sin entregas marcadas" : `${Math.round(doneRate * 100)}% cumplido`}</span>}
          </div>
          {tasks === null ? (
            <Loading label="Cargando asignaciones…" className="space-y-1.5">
              <Bone className="h-2.5 w-20" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><RowBones count={2} compact /></div>
            </Loading>
          ) : list.length === 0 ? (
            <p className="text-xs text-zinc-400">Aún no hay asignaciones. Crea una tarea con categoría académica y elige esta materia.</p>
          ) : (
            <div className="space-y-4">
              {overdue.length > 0 && <Group title={`Atrasadas · ${overdue.length}`} tone="text-rose-700">{overdue.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}</Group>}
              {upcoming.length > 0 && <Group title={`Próximas · ${upcoming.length}`}>{upcoming.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}</Group>}
              {finished.length > 0 && <Group title={`Completadas · ${finished.length}`}>{finished.map((t) => <TaskRow key={t.id} task={t} category={catOf(t.category_id)} {...rowProps} />)}</Group>}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Group({ title, tone = "text-zinc-400", children }: { title: string; tone?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${tone}`}>{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}
