"use client";

import { useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Copy, GraduationCap, MapPin, MoreHorizontal, Pencil, Plus, Trash2, User } from "lucide-react";
import { useDash } from "../DashContext";
import { api, formatDay, hoursLabel, PERIOD_META, Schedule, Subject, todayISO, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/tasks";

const HOUR_PX = 52;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function statusOf(s: Schedule, today: string): { label: string; className: string } {
  if (s.is_archived) return { label: "Archivado", className: "bg-zinc-100 text-zinc-500" };
  if (today < s.start_date) return { label: "Próximo", className: "bg-sky-50 text-sky-700" };
  if (today > s.end_date) return { label: "Finalizado", className: "bg-zinc-100 text-zinc-600" };
  return { label: "En curso", className: "bg-green-50 text-green-700" };
}

function ScheduleMenu({ s }: { s: Schedule }) {
  const { actions, onError, onInfo, reloadSchedules } = useDash();
  const [open, setOpen] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setOpen(false);
    try {
      await fn();
      onInfo(ok);
      reloadSchedules();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Algo salió mal.");
    }
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-label="Opciones del horario" aria-expanded={open} className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 cursor-pointer">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-48 p-1 rounded-xl bg-white border border-zinc-200 shadow-lg text-xs">
          <button type="button" onClick={() => { setOpen(false); actions.editSchedule(s); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 cursor-pointer"><Pencil className="w-3.5 h-3.5" /> Editar periodo</button>
          <button type="button" onClick={() => { setOpen(false); actions.duplicateSchedule(s); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 cursor-pointer"><Copy className="w-3.5 h-3.5" /> Duplicar para otro periodo</button>
          <button type="button" onClick={() => run(() => api.updateSchedule(s.id, { is_archived: !s.is_archived }), s.is_archived ? "Horario restaurado." : "Horario archivado.")} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 cursor-pointer">
            {s.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} {s.is_archived ? "Restaurar" : "Archivar"}
          </button>
          <button type="button" onClick={() => window.confirm(`¿Eliminar "${s.name}" con sus ${s.subjects.length} materias? Las tareas se conservan sin materia.`) && run(() => api.deleteSchedule(s.id), "Horario eliminado.")} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

type Block = { m: Subject; x: Subject["sessions"][number] };

/** Clases que se cruzan en un día se reparten en columnas para que no se tapen. */
function layoutDay(list: Block[]): (Block & { col: number; cols: number })[] {
  const sorted = [...list].sort((a, b) => a.x.start_time.localeCompare(b.x.start_time));
  const out: (Block & { col: number; cols: number })[] = [];
  let group: (Block & { col: number; cols: number })[] = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => (g.cols = cols));
    out.push(...group);
    group = [];
  };
  for (const b of sorted) {
    if (group.length && toMin(b.x.start_time) >= groupEnd) flush();
    const used = new Set(group.filter((g) => toMin(g.x.end_time) > toMin(b.x.start_time)).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ ...b, col, cols: 1 });
    groupEnd = Math.max(groupEnd, toMin(b.x.end_time));
  }
  flush();
  return out;
}

/** Grilla semanal tipo calendario (escritorio). */
function WeekGrid({ s }: { s: Schedule }) {
  const { actions } = useDash();
  const blocks = s.subjects.flatMap((m) => m.sessions.map((x) => ({ m, x })));
  if (!blocks.length) return null;
  const usedDays = [0, 1, 2, 3, 4, ...[5, 6].filter((d) => blocks.some((b) => b.x.weekday === d))];
  const startH = Math.floor(Math.min(...blocks.map((b) => toMin(b.x.start_time))) / 60);
  const endH = Math.ceil(Math.max(...blocks.map((b) => toMin(b.x.end_time))) / 60);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const today = todayISO();
  const todayW = (new Date().getDay() + 6) % 7;
  const inPeriod = s.start_date <= today && today <= s.end_date;

  return (
    <div className="hidden md:block rounded-3xl border border-zinc-200/80 bg-white p-3 overflow-x-auto">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `3rem repeat(${usedDays.length}, minmax(0, 1fr))` }}>
        <div />
        {usedDays.map((d) => (
          <div key={d} className={`text-center text-xs font-bold pb-2 ${inPeriod && d === todayW ? "text-emerald-700" : "text-zinc-700"}`}>{WEEKDAY_SHORT[d]}</div>
        ))}
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <div key={h} className="absolute right-2 text-[10px] text-zinc-400 tabular-nums" style={{ top: i * HOUR_PX - 6 }}>{String(h).padStart(2, "0")}:00</div>
          ))}
        </div>
        {usedDays.map((d) => (
          <div key={d} className={`relative border-l border-zinc-100 ${inPeriod && d === todayW ? "bg-emerald-50/40" : ""}`} style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => <div key={h} className="absolute inset-x-0 border-t border-zinc-100" style={{ top: i * HOUR_PX }} />)}
            {layoutDay(blocks.filter((b) => b.x.weekday === d)).map(({ m, x, col, cols }) => {
              const top = ((toMin(x.start_time) - startH * 60) / 60) * HOUR_PX;
              const height = Math.max(((toMin(x.end_time) - toMin(x.start_time)) / 60) * HOUR_PX - 3, 22);
              const clash = x.conflicts.length > 0;
              return (
                <button key={x.id} type="button" onClick={() => actions.openSubject(m)}
                  title={`${m.name} · ${x.start_time}–${x.end_time}${clash ? " · choca con otra clase" : ""}`}
                  className={`absolute rounded-xl px-2 py-1 text-left text-white overflow-hidden cursor-pointer hover:brightness-110 ${clash ? "ring-2 ring-amber-400" : ""}`}
                  style={{ top: top + 1, height, background: m.color, left: `calc(${(col / cols) * 100}% + 4px)`, width: `calc(${100 / cols}% - 8px)` }}>
                  <div className="text-[11px] font-bold leading-tight truncate">{clash && "⚠️ "}{m.name}</div>
                  <div className="text-[10px] opacity-90 tabular-nums">{x.start_time}–{x.end_time}</div>
                  {height > 44 && (x.location || m.location) && <div className="text-[10px] opacity-90 truncate">{x.location || m.location}</div>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista por día (teléfono). */
function DayList({ s }: { s: Schedule }) {
  const { actions } = useDash();
  const todayW = (new Date().getDay() + 6) % 7;
  const order = [0, 1, 2, 3, 4, 5, 6].sort((a, b) => ((a - todayW + 7) % 7) - ((b - todayW + 7) % 7));
  return (
    <div className="md:hidden space-y-3">
      {order.map((d) => {
        const list = s.subjects.flatMap((m) => m.sessions.filter((x) => x.weekday === d).map((x) => ({ m, x }))).sort((a, b) => a.x.start_time.localeCompare(b.x.start_time));
        if (!list.length) return null;
        return (
          <section key={d} className="space-y-1.5">
            <h3 className={`text-xs font-bold ${d === todayW ? "text-emerald-700" : "text-zinc-900"}`}>{WEEKDAY_LONG[d]}{d === todayW && " · Hoy"}</h3>
            {list.map(({ m, x }) => (
              <button key={x.id} type="button" onClick={() => actions.openSubject(m)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-200/80 border-l-4 text-left cursor-pointer" style={{ borderLeftColor: m.color }}>
                <span className="text-xs font-semibold tabular-nums text-zinc-700 w-24 shrink-0">{x.start_time}–{x.end_time}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900 truncate">{x.conflicts.length > 0 && "⚠️ "}{m.name}</span>
                  {(x.location || m.location) && <span className="block text-[11px] text-zinc-500 truncate">{x.location || m.location}</span>}
                </span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function SubjectCard({ m }: { m: Subject }) {
  const { actions } = useDash();
  const a = m.assignments;
  return (
    <button type="button" onClick={() => actions.openSubject(m)} className="text-left p-4 rounded-3xl bg-white border border-zinc-200/80 hover:border-zinc-300 space-y-2 cursor-pointer">
      <div className="flex items-start gap-2.5">
        <span className="w-3 h-10 rounded-full shrink-0" style={{ background: m.color }} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 break-words">{m.name}</h3>
          <p className="text-[11px] text-zinc-500">
            {[m.code, m.credits != null ? `${m.credits} créditos` : null, hoursLabel(m.weekly_minutes) + "/sem"].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {m.teacher && <p className="flex items-center gap-1 text-[11px] text-zinc-500"><User className="w-3 h-3" /> {m.teacher}</p>}
      <p className="text-[11px] text-zinc-600">
        {m.sessions.length ? m.sessions.map((x) => `${WEEKDAY_SHORT[x.weekday]} ${x.start_time}`).join(" · ") : "Sin clases semanales"}
        {m.sessions.some((x) => x.conflicts.length) && <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700 font-semibold"><AlertTriangle className="w-3 h-3" /> choque</span>}
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-semibold">{a.pending} pendiente(s)</span>
        {a.overdue > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">{a.overdue} atrasada(s)</span>}
        {a.next_exam && <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">🧪 Examen {formatDay(a.next_exam, { day: "numeric", month: "short" })}</span>}
      </div>
    </button>
  );
}

export default function ScheduleView() {
  const { schedules, actions } = useDash();
  const today = todayISO();
  const visible = schedules.filter((s) => !s.is_archived);
  const archived = schedules.filter((s) => s.is_archived);
  const [selected, setSelected] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const current = schedules.find((s) => s.id === selected) ?? visible.find((s) => s.start_date <= today && today <= s.end_date) ?? visible[0] ?? archived[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 uppercase tracking-wider"><GraduationCap className="w-3.5 h-3.5" aria-hidden="true" /> Horario</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">Tus clases</h1>
        </div>
        <button type="button" onClick={actions.newSchedule} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Nuevo horario
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <GraduationCap className="w-9 h-9 mx-auto text-sky-700" aria-hidden="true" />
          <h2 className="mt-3 text-base font-bold text-zinc-900">Crea tu primer horario</h2>
          <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">Elige el tipo de periodo (cuatrimestral, semestral…), agrega tus materias con sus días y horas, y asocia tus tareas a cada materia.</p>
        </div>
      ) : (
        <>
          {(visible.length > 1 || archived.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Horarios">
              {visible.map((s) => (
                <button key={s.id} type="button" role="tab" aria-selected={current?.id === s.id} onClick={() => setSelected(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${current?.id === s.id ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                  {s.name}
                </button>
              ))}
              {archived.length > 0 && (
                <button type="button" onClick={() => setShowArchived(!showArchived)} aria-expanded={showArchived} className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-800 cursor-pointer">
                  Archivados · {archived.length} {showArchived ? "▲" : "▼"}
                </button>
              )}
              {showArchived && archived.map((s) => (
                <button key={s.id} type="button" role="tab" aria-selected={current?.id === s.id} onClick={() => setSelected(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${current?.id === s.id ? "bg-zinc-600 border-zinc-600 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-500"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {current && (
            <>
              <section className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-950">{current.name}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusOf(current, today).className}`}>{statusOf(current, today).label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {[current.institution, PERIOD_META[current.period_type].label, `${formatDay(current.start_date, { day: "numeric", month: "short", year: "numeric" })} – ${formatDay(current.end_date, { day: "numeric", month: "short", year: "numeric" })}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {[["Materias", String(current.subjects.length)], ["Clase/semana", hoursLabel(current.weekly_minutes)], ["Créditos", String(current.credits)]].map(([l, v]) => (
                    <div key={l} className="text-center">
                      <div className="text-lg font-bold text-zinc-950 tabular-nums">{v}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{l}</div>
                    </div>
                  ))}
                  <ScheduleMenu s={current} />
                </div>
              </section>

              <WeekGrid s={current} />
              <DayList s={current} />

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-zinc-900">Materias · {current.subjects.length}</h2>
                  {!current.is_archived && (
                    <button type="button" onClick={() => actions.newSubject(current.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"><Plus className="w-3.5 h-3.5" /> Materia</button>
                  )}
                </div>
                {current.subjects.length === 0 ? (
                  <p className="text-xs text-zinc-400 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Agrega tus materias con sus días, horas y aula.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">{current.subjects.map((m) => <SubjectCard key={m.id} m={m} />)}</div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
