"use client";

import { useState } from "react";
import { ArrowLeft, Award, BarChart3, ChevronRight, Flag, Flame, GraduationCap, Lightbulb, ListChecks, Loader2, Repeat, Repeat2, ShieldCheck, Target, Trophy } from "lucide-react";
import { useDash } from "../DashContext";
import { statusBadge } from "../Grades";
import { useLoad } from "../useLoad";
import { addDays, Analytics, api, CHALLENGE_META, ChallengeAnalytics, ClassAnalytics, formatDay, GradesAnalytics, GradesPlan, HabitAnalytics, PlanTarget, STATUS_META, TargetStatus, todayISO, weekStart } from "@/lib/tasks";

const BRAND = "#6e2234";
const SLOT_LABEL = { manana: "Mañana (antes de 12)", tarde: "Tarde (12–18)", noche: "Noche (desde 18)", sin_hora: "Sin hora" } as const;
const ENERGY_LABEL = ["", "😩 1", "😕 2", "😐 3", "🙂 4", "🤩 5"];

type RangeKey = "this_week" | "last_week" | "4_weeks" | "3_months";
function rangeOf(k: RangeKey): [string, string] {
  const t = todayISO();
  const ws = weekStart(t);
  if (k === "this_week") return [ws, addDays(ws, 6)];
  if (k === "last_week") return [addDays(ws, -7), addDays(ws, -1)];
  if (k === "4_weeks") return [addDays(t, -27), t];
  return [addDays(t, -89), t];
}
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_week", label: "Esta semana" },
  { key: "last_week", label: "Semana pasada" },
  { key: "4_weeks", label: "4 semanas" },
  { key: "3_months", label: "3 meses" },
];

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

/** Barra horizontal: 0–100% de cumplimiento. El valor siempre va en texto (no solo color). */
function BarRow({ label, rate, count, color = BRAND, unit = "tareas" }: { label: string; rate: number | null; count: number; color?: string; unit?: string }) {
  return (
    <div className="group grid grid-cols-[minmax(0,7.5rem)_1fr_3rem] sm:grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 py-1" title={`${label}: ${pct(rate)} · ${count} ${unit}`}>
      <span className="text-xs text-zinc-700 truncate">{label}</span>
      <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
        {rate !== null && <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(rate * 100, 2)}%`, background: color }} />}
      </div>
      <span className="text-xs font-semibold text-zinc-900 tabular-nums text-right">
        {pct(rate)}
        <span className="block text-[10px] font-normal text-zinc-400">{count} {unit}</span>
      </span>
    </div>
  );
}

function Card({ title, icon: Icon, children, className = "" }: { title: string; icon: typeof BarChart3; children: React.ReactNode; className?: string }) {
  return (
    <section className={`p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80 ${className}`}>
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 mb-3"><Icon className="w-4 h-4 text-zinc-400" aria-hidden="true" /> {title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80">
      <div className="text-[11px] text-zinc-500 font-medium">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

type Section = "general" | "tasks" | "habits" | "challenges" | "classes" | "grades";
const SECTIONS: { key: Section; title: string; desc: string; icon: typeof BarChart3; tone: string }[] = [
  { key: "general", title: "Resumen general", desc: "Todo junto y las observaciones clave", icon: Lightbulb, tone: "text-emerald-700 bg-emerald-50" },
  { key: "tasks", title: "Tareas", desc: "Cumplimiento, días, categorías y lo que pospones", icon: ListChecks, tone: "text-zinc-700 bg-zinc-100" },
  { key: "habits", title: "Hábitos", desc: "Constancia por hábito y hábitos consolidados", icon: Repeat, tone: "text-emerald-700 bg-emerald-50" },
  { key: "challenges", title: "Retos", desc: "Logrados, parciales y no logrados", icon: Trophy, tone: "text-amber-700 bg-amber-50" },
  { key: "classes", title: "Clases", desc: "Asistencia y entregas por materia", icon: GraduationCap, tone: "text-sky-700 bg-sky-50" },
  { key: "grades", title: "Notas y carrera", desc: "Índice, lo que te falta, honores y metas", icon: Award, tone: "text-amber-700 bg-amber-50" },
];

/** Pantalla previa: eliges qué análisis ver. */
function Picker({ all, grades, hasClasses, onPick }: { all: Analytics; grades: GradesAnalytics | null; hasClasses: boolean; onPick: (s: Section) => void }) {
  const headline: Record<Section, [string, string]> = {
    general: [String(all.overview.active_days), "días activos"],
    tasks: [pct(all.overview.tasks_rate), `${all.tasks.evaluated} tareas marcadas`],
    habits: [pct(all.overview.habits_rate), `${all.habits.done} de ${all.habits.expected} veces`],
    challenges: [pct(all.overview.challenges_rate), `${all.challenges.decided} retos con resultado`],
    classes: hasClasses ? [pct(all.overview.attendance_rate), "de asistencia"] : ["—", "sin clases en el periodo"],
    grades: grades?.cumulative_index != null ? [grades.cumulative_index.toFixed(2), `índice · ${grades.courses} materias`] : ["—", "sin notas aún"],
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {SECTIONS.map((x) => (
        <button key={x.key} type="button" onClick={() => onPick(x.key)} className="group text-left p-5 rounded-3xl bg-white border border-zinc-200/80 hover:border-zinc-300 hover:shadow-lg hover:shadow-emerald-900/5 transition-all cursor-pointer">
          <div className="flex items-start justify-between gap-3">
            <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${x.tone}`}><x.icon className="w-5 h-5" aria-hidden="true" /></span>
            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-700 transition-colors" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-bold text-zinc-950">{x.title}</h2>
          <p className="text-xs text-zinc-500">{x.desc}</p>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-zinc-950">{headline[x.key][0]}</span>
            <span className="text-[11px] text-zinc-500">{headline[x.key][1]}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function AnalyticsView({ refreshKey, onError }: { refreshKey: number; onError: (m: string) => void }) {
  const [range, setRange] = useState<RangeKey>("4_weeks");
  const [start, end] = rangeOf(range);
  const { data: all, loading } = useLoad<Analytics>(() => api.analytics(start, end), [start, end], refreshKey, onError);
  const [section, setSection] = useState<Section | null>(null);
  const { programs } = useDash();
  const [programId, setProgramId] = useState<string | null>(null);
  const grades = useLoad<GradesAnalytics>(() => api.gradesAnalytics(programId), [programId], refreshKey, onError);
  const meta = section ? SECTIONS.find((x) => x.key === section)! : null;
  const hasClasses = !!all && (all.classes.classes > 0 || all.classes.by_subject.length > 0);
  const m = all?.tasks;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {section ? (
            <button type="button" onClick={() => setSection(null)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider cursor-pointer hover:text-emerald-900">
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Análisis
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> Análisis
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">{meta ? meta.title : "¿Qué quieres analizar?"}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {section === "grades"
              ? `${grades.data?.program.name ?? "Tu carrera"}${grades.data?.program.institution ? ` · ${grades.data.program.institution}` : ""} · todo el historial (no depende del periodo)`
              : `${formatDay(start, { day: "numeric", month: "short" })} – ${formatDay(end, { day: "numeric", month: "short" })}`}
          </p>
        </div>
        {section === "grades" && programs.length > 1 && (
          <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100" role="radiogroup" aria-label="Carrera">
            {programs.map((p, i) => {
              const on = (programId ?? programs[0].id) === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => setProgramId(i === 0 ? null : p.id)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${on ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}>
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
        <div className={`flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100 ${section === "grades" ? "hidden" : ""}`} role="radiogroup" aria-label="Periodo">
          {RANGES.map((r) => (
            <button key={r.key} type="button" role="radio" aria-checked={range === r.key} onClick={() => setRange(r.key)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${range === r.key ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !all || !m ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : (
        <>
          {section === null && <Picker all={all} grades={grades.data} hasClasses={hasClasses} onPick={setSection} />}
          {section === "general" && (
          <>
          {/* Resumen general de las secciones */}
          <div className={`grid grid-cols-1 sm:grid-cols-3 ${hasClasses ? "lg:grid-cols-4" : ""} gap-3`}>
            <Stat label="Tareas" value={pct(all.overview.tasks_rate)} sub={`${m.evaluated} marcadas · Hecho 100%, A medias 50%`} />
            <Stat label="Hábitos" value={pct(all.overview.habits_rate)} sub={`${all.habits.done} de ${all.habits.expected} veces`} />
            <Stat label="Retos" value={pct(all.overview.challenges_rate)} sub={`${all.challenges.counts.achieved} logrados de ${all.challenges.decided}`} />
            {hasClasses && <Stat label="Asistencia" value={pct(all.overview.attendance_rate)} sub={`${all.classes.attended} de ${all.classes.attended + all.classes.absent} clases`} />}
          </div>
          <Card title="Resumen general" icon={Lightbulb}>
            <ul className="space-y-2">
              {all.insights.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" aria-hidden="true" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>

          </>
          )}
          {section === "habits" && <HabitsSection h={all.habits} />}
          {section === "challenges" && <ChallengesSection c={all.challenges} />}
          {section === "classes" && <ClassesSection k={all.classes} />}
          {section === "grades" && (grades.data ? <GradesSection g={grades.data} /> : <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>)}
          {section === "tasks" && (
          <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Cumplimiento" value={pct(m.completion_rate)} sub={`${m.evaluated} tareas marcadas`} />
            <Stat label="Planificado vs hecho" value={`${m.avg_done_per_day} / ${m.avg_planned_per_day}`} sub="promedio por día activo" />
            <Stat label="Racha actual" value={`${m.streak} ${m.streak === 1 ? "día" : "días"}`} sub={`Mejor: ${m.best_streak} · meta 70%`} />
            <Stat label="Días activos" value={String(m.active_days)} sub={m.unreviewed ? `${m.unreviewed} sin marcar` : "todo marcado"} />
          </div>

          <Card title="Resumen de tareas" icon={Lightbulb}>
            <ul className="space-y-2">
              {m.insights.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" aria-hidden="true" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>

          {m.evaluated > 0 && (
            <>
              <Card title="Cómo marcaste tus tareas" icon={ListChecks}>
                <div className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden bg-zinc-100" role="img" aria-label="Distribución por estado">
                  {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) =>
                    m.counts[s] ? <div key={s} title={`${STATUS_META[s].label}: ${m.counts[s]}`} style={{ width: `${(m.counts[s] / m.evaluated) * 100}%`, background: STATUS_META[s].color }} /> : null
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((s) => (
                    <div key={s} className="flex items-center gap-2 text-xs text-zinc-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_META[s].color }} aria-hidden="true" />
                      {STATUS_META[s].label}
                      <span className="ml-auto font-semibold text-zinc-900 tabular-nums">{m.counts[s]} · {Math.round((m.counts[s] / m.evaluated) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                <Card title="Por día de la semana" icon={BarChart3}>
                  {m.by_weekday.map((r) => <BarRow key={r.weekday} label={r.name.charAt(0).toUpperCase() + r.name.slice(1)} rate={r.rate} count={r.count} />)}
                </Card>
                <Card title="Por categoría" icon={Target}>
                  {m.by_category.map((r) => <BarRow key={r.category_id ?? "none"} label={r.name} rate={r.rate} count={r.count} color={r.color} />)}
                </Card>
                <Card title="Tendencia por semana" icon={BarChart3}>
                  {m.by_week.map((r) => <BarRow key={r.week_start} label={`Sem. ${formatDay(r.week_start, { day: "numeric", month: "short" })}`} rate={r.rate} count={r.count} />)}
                </Card>
                <Card title="Por franja horaria" icon={BarChart3}>
                  {m.by_time_slot.filter((r) => r.count).map((r) => <BarRow key={r.slot} label={SLOT_LABEL[r.slot]} rate={r.rate} count={r.count} />)}
                </Card>
                <Card title="Energía vs cumplimiento" icon={Flame}>
                  {m.by_energy.some((r) => r.days) ? (
                    m.by_energy.map((r) => <BarRow key={r.energy} label={ENERGY_LABEL[r.energy]} rate={r.rate} count={r.days} unit={r.days === 1 ? "día" : "días"} />)
                  ) : (
                    <p className="text-xs text-zinc-400">Registra tu energía en el cierre del día para ver esta relación.</p>
                  )}
                </Card>
                <Card title="Lo que más pospones o dejas a medias" icon={Repeat2}>
                  {m.top_postponed.length === 0 && m.top_partial.length === 0 ? (
                    <p className="text-xs text-zinc-400">Nada que destacar. 👌</p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {m.top_postponed.map((t) => (
                        <li key={`p-${t.title}`} className="flex items-center justify-between gap-2">
                          <span className="truncate text-zinc-700">{t.title}</span>
                          <span className="shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-sky-50 text-sky-700 border-sky-200">Pospuesta {t.count}×</span>
                        </li>
                      ))}
                      {m.top_partial.map((t) => (
                        <li key={`h-${t.title}`} className="flex items-center justify-between gap-2">
                          <span className="truncate text-zinc-700">{t.title}</span>
                          <span className="shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold bg-amber-50 text-amber-700 border-amber-200">A medias {t.count}×</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          )}
          </>
          )}
        </>
      )}
    </div>
  );
}

function Insights({ items }: { items: string[] }) {
  return (
    <Card title="Resumen" icon={Lightbulb}>
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s} className="flex gap-2 text-sm text-zinc-700 leading-relaxed">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" aria-hidden="true" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HabitsSection({ h }: { h: HabitAnalytics }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Cumplimiento" value={pct(h.rate)} sub={`${h.done} de ${h.expected} veces`} />
        <Stat label="En construcción" value={String(h.building)} sub={h.needs_adjust ? `${h.needs_adjust} por reajustar` : "ninguno por reajustar"} />
        <Stat label="Consolidados" value={String(h.consolidated_in_period)} sub="en este periodo" />
        <Stat label="Mejor racha" value={String(h.best_streak)} sub="veces seguidas" />
      </div>
      <Insights items={h.insights} />
      {h.expected > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Por hábito" icon={Repeat}>
            {h.habits.map((r) => (
              <BarRow key={r.habit_id} label={`${r.kind === "building" ? "🔨 " : ""}${r.title}`} rate={r.rate} count={r.expected} unit="veces" />
            ))}
            <p className="mt-2 text-[11px] text-zinc-400">🔨 = en construcción</p>
          </Card>
          <Card title="Por día de la semana" icon={BarChart3}>
            {h.by_weekday.map((r) => <BarRow key={r.weekday} label={r.name.charAt(0).toUpperCase() + r.name.slice(1)} rate={r.rate} count={r.count} unit="veces" />)}
          </Card>
        </div>
      )}
    </>
  );
}

function ChallengesSection({ c }: { c: ChallengeAnalytics }) {
  const keys = Object.keys(CHALLENGE_META) as (keyof typeof CHALLENGE_META)[];
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Cumplimiento" value={pct(c.rate)} sub="Logrado 100%, Parcial 50%" />
        {keys.map((k) => <Stat key={k} label={`${CHALLENGE_META[k].emoji} ${CHALLENGE_META[k].label}`} value={String(c.counts[k])} sub={c.decided ? `${Math.round((c.counts[k] / c.decided) * 100)}% de los retos` : "—"} />)}
      </div>
      <Insights items={c.insights} />
      {c.decided > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Resultados" icon={Trophy}>
            <div className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden bg-zinc-100" role="img" aria-label="Resultados de retos">
              {keys.map((k) => (c.counts[k] ? <div key={k} title={`${CHALLENGE_META[k].label}: ${c.counts[k]}`} style={{ width: `${(c.counts[k] / c.decided) * 100}%`, background: CHALLENGE_META[k].color }} /> : null))}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {c.recent.map((r) => (
                <li key={`${r.date}-${r.title}`} className="flex items-center justify-between gap-2">
                  <span className="truncate text-zinc-700">{r.title}</span>
                  <span className="shrink-0 text-zinc-400">{formatDay(r.date, { day: "numeric", month: "short" })} · {CHALLENGE_META[r.status as keyof typeof CHALLENGE_META].emoji}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Por categoría" icon={Target}>
            {c.by_category.map((r) => <BarRow key={r.category_id ?? "none"} label={r.name} rate={r.rate} count={r.count} color={r.color} unit="retos" />)}
          </Card>
        </div>
      )}
    </>
  );
}

function ClassesSection({ k }: { k: ClassAnalytics }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Asistencia" value={pct(k.attendance_rate)} sub={`${k.attended} de ${k.attended + k.absent} clases`} />
        <Stat label="Sin marcar" value={String(k.unmarked)} sub="clases pasadas" />
        <Stat label="Entregas atrasadas" value={String(k.assignments_overdue)} sub="sin marcar" />
        <Stat label="Exámenes por delante" value={String(k.upcoming_exams)} sub="en este periodo" />
      </div>
      <Insights items={k.insights} />
      {k.by_subject.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Asistencia por materia" icon={GraduationCap}>
            {k.by_subject.map((r) => <BarRow key={r.subject_id} label={r.name} rate={r.attendance_rate} count={r.attended + r.absent} color={r.color} unit="clases" />)}
          </Card>
          <Card title="Entregas por materia" icon={ListChecks}>
            {k.by_subject.map((r) => <BarRow key={r.subject_id} label={`${r.name}${r.overdue ? ` · ${r.overdue} atrasada(s)` : ""}`} rate={r.assignment_rate} count={r.assignments} color={r.color} unit="entregas" />)}
          </Card>
          {k.heavy_days.days > 0 && k.light_days.days > 0 && (
            <Card title="Días cargados de clase vs tareas" icon={BarChart3}>
              <BarRow label="4 h o más de clase" rate={k.heavy_days.task_rate} count={k.heavy_days.days} unit="días" />
              <BarRow label="Menos de 4 h" rate={k.light_days.task_rate} count={k.light_days.days} unit="días" />
              <p className="mt-2 text-[11px] text-zinc-400">Cumplimiento de tus tareas según cuántas horas de clase tuviste ese día.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

/** Barra del índice (0 a 4 puntos). El valor va en texto. */
function IndexRow({ label, value, sub, max = 4 }: { label: string; value: number | null; sub?: string; max?: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr_4rem] sm:grid-cols-[minmax(0,11rem)_1fr_4.5rem] items-center gap-3 py-1" title={`${label}: ${value ?? "—"}`}>
      <span className="text-xs text-zinc-700 truncate">{label}</span>
      <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
        {value !== null && <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max((value / max) * 100, 2)}%`, background: BRAND }} />}
      </div>
      <span className="text-xs font-semibold text-zinc-900 tabular-nums text-right">
        {value === null ? "—" : value.toFixed(2)}
        {sub && <span className="block text-[10px] font-normal text-zinc-400">{sub}</span>}
      </span>
    </div>
  );
}

function GradesSection({ g }: { g: GradesAnalytics }) {
  const totalLetters = Object.values(g.letters).reduce((a, b) => a + b, 0);
  const maxPoints = Math.max(...g.scale.map((b) => b.points), 4);
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Índice acumulado" value={g.cumulative_index?.toFixed(2) ?? "—"} sub={`de ${maxPoints.toFixed(2)}${g.has_prior && g.app_index !== null ? ` · en la app ${g.app_index.toFixed(2)}` : ""}`} />
        <Stat label="Promedio" value={g.average?.toString() ?? "—"} sub="de tus notas finales (0–100)" />
        <Stat label="Materias cursadas" value={String(g.courses)} sub={`${g.passed} aprobadas · ${g.failed} reprobadas`} />
        <Stat label="Créditos" value={g.credits_passed === null ? String(g.credits_attempted) : `${g.credits_passed} / ${g.credits_attempted}`} sub={`${g.credits_passed === null ? "cursados" : "aprobados / cursados"}${g.in_progress ? ` · ${g.in_progress} materia(s) en curso` : ""}`} />
      </div>
      <Insights items={g.insights} />
      <CareerPlan p={g.plan} max={maxPoints} />
      {g.subjects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Clasificación por letra" icon={Award}>
            {Object.entries(g.letters).map(([letter, n]) => {
              const band = g.scale.find((b) => b.letter === letter);
              return (
                <div key={letter} className="grid grid-cols-[3rem_1fr_4rem] items-center gap-3 py-1" title={`${letter}: ${n} materia(s)`}>
                  <span className="text-sm font-bold text-zinc-900">{letter}<span className="block text-[10px] font-normal text-zinc-400">≥ {band?.min}</span></span>
                  <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                    {n > 0 && <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max((n / totalLetters) * 100, 2)}%`, background: (band?.min ?? 0) >= g.pass_min ? "#16a34a" : "#e11d48" }} />}
                  </div>
                  <span className="text-xs font-semibold text-zinc-900 tabular-nums text-right">{n}<span className="block text-[10px] font-normal text-zinc-400">{totalLetters ? Math.round((n / totalLetters) * 100) : 0}%</span></span>
                </div>
              );
            })}
            <p className="mt-2 text-[11px] text-zinc-400">Verde = aprobada (≥ {g.pass_min}) · Rojo = reprobada</p>
          </Card>
          <Card title="Índice por periodo" icon={BarChart3}>
            {g.evolution.map((e) => <IndexRow key={e.schedule_id} label={e.name} value={e.period_index} sub={`acum. ${e.cumulative_index?.toFixed(2) ?? "—"}`} max={maxPoints} />)}
            {g.prior.index !== null && <p className="mt-2 text-[11px] text-zinc-400">El acumulado parte de tu historial manual (índice {g.prior.index} con {g.prior.credits ?? 0} créditos).</p>}
          </Card>
          <Card title="Tus materias" icon={GraduationCap} className="lg:col-span-2">
            <ul className="divide-y divide-zinc-100">
              {g.subjects.map((x) => (
                <li key={x.subject_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: x.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-sm text-zinc-800 truncate">{x.name}<span className="ml-2 text-[11px] text-zinc-400">{x.schedule}</span></span>
                  <span className="text-[11px] text-zinc-500">{x.credits != null ? `${x.credits} cr` : "sin créditos"}</span>
                  <span className="w-20 text-right text-sm font-bold tabular-nums text-zinc-900">{x.grade} · {x.letter}</span>
                  {statusBadge(x.passed)}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      {g.pending_grades.length > 0 && (
        <Card title="Notas por registrar" icon={Award}>
          <ul className="space-y-1 text-xs text-zinc-600">
            {g.pending_grades.map((x) => <li key={x.subject_id}>{x.name} <span className="text-zinc-400">· {x.schedule}</span></li>)}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-400">Regístralas en Horario → Notas del periodo.</p>
        </Card>
      )}
    </>
  );
}

const TARGET_META: Record<TargetStatus, { label: string; className: string }> = {
  asegurado: { label: "Asegurado", className: "bg-green-50 text-green-700 border-green-200" },
  en_camino: { label: "En camino", className: "bg-green-50 text-green-700 border-green-200" },
  exigente: { label: "Exigente", className: "bg-amber-50 text-amber-800 border-amber-200" },
  imposible: { label: "Fuera de alcance", className: "bg-rose-50 text-rose-700 border-rose-200" },
  descalificado: { label: "No elegible", className: "bg-rose-50 text-rose-700 border-rose-200" },
  logrado: { label: "Logrado", className: "bg-green-50 text-green-700 border-green-200" },
  no_alcanzado: { label: "No alcanzado", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  sin_pensum: { label: "Falta el pénsum", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};
const REQ_ICON = { ok: ["✓", "text-green-700"], fail: ["✗", "text-rose-600"], warn: ["!", "text-amber-700"], unknown: ["?", "text-zinc-400"] } as const;

function TargetCard({ t, max }: { t: PlanTarget; max: number }) {
  const meta = TARGET_META[t.status];
  const margin = t.margins.filter((x) => x.credits > 0);
  return (
    <div className="p-4 rounded-2xl border border-zinc-200/80 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-zinc-900">{t.name}</div>
          <div className="text-[11px] text-zinc-500">índice ≥ {t.min.toFixed(2)}</div>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${meta.className}`}>{meta.label}</span>
      </div>
      {t.needed !== null && t.status !== "imposible" && (
        <div className="flex items-baseline gap-3">
          <div>
            <div className="text-xl font-bold tabular-nums text-zinc-950">{t.needed.toFixed(2)}</div>
            <div className="text-[10px] text-zinc-500">índice necesario en lo que falta</div>
          </div>
          {t.probability !== null && (
            <div>
              <div className="text-xl font-bold tabular-nums text-zinc-950">{t.probability}%</div>
              <div className="text-[10px] text-zinc-500">probabilidad estimada</div>
            </div>
          )}
        </div>
      )}
      {t.needed !== null && t.status !== "imposible" && (
        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden" title={`Necesitas ${t.needed.toFixed(2)} de ${max.toFixed(2)}`}>
          <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(Math.min(t.needed / max, 1) * 100, 2)}%`, background: BRAND }} />
        </div>
      )}
      {t.status === "imposible" && t.final_if_all !== null && <p className="text-xs text-zinc-600">Aun sacando todo {"A"} llegarías a {t.final_if_all.toFixed(2)}.</p>}
      {t.status === "descalificado" && <p className="text-xs text-rose-700">No cumples un requisito de honores (abajo).</p>}
      {t.status !== "descalificado" && t.status !== "imposible" && t.margins.length > 0 && (
        <p className="text-xs text-zinc-600 leading-relaxed">
          {margin.length
            ? <>Margen: hasta {margin.map((x, i) => <span key={x.letter}>{i > 0 && " o "}<b>{x.credits} créditos en {x.letter}</b>{x.subjects !== null && ` (≈${x.subjects} materia${x.subjects === 1 ? "" : "s"})`}</span>)}, con todo lo demás en la nota más alta.</>
            : "Sin margen: necesitas la nota más alta en todo lo que falta."}
        </p>
      )}
    </div>
  );
}

function CareerPlan({ p, max }: { p: GradesPlan; max: number }) {
  if (p.total_credits === null) {
    return (
      <Card title="Tu carrera" icon={Flag}>
        <p className="text-xs text-zinc-600">Agrega los créditos y materias de tu pénsum en <b>Horario → Carrera e historial</b> para ver cuánto te falta, qué índice necesitas para graduarte con honores o llegar a tu índice deseado, y tu margen.</p>
      </Card>
    );
  }
  const left = p.credits_remaining ?? 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Tu carrera" icon={Flag}>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums text-zinc-950">{Math.round((p.progress ?? 0) * 100)}%</span>
          <span className="text-[11px] text-zinc-500">{p.credits_done + p.transfer_credits} de {p.total_credits} créditos</span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-zinc-100 overflow-hidden" title={`${Math.round((p.progress ?? 0) * 100)}% del pénsum`}>
          <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max((p.progress ?? 0) * 100, 2)}%`, background: BRAND }} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
          <dt className="text-zinc-500">Créditos por cursar</dt><dd className="text-right font-semibold tabular-nums">{left}</dd>
          {p.subjects_remaining !== null && <><dt className="text-zinc-500">Materias por aprobar</dt><dd className="text-right font-semibold tabular-nums">{p.subjects_remaining}</dd></>}
          {p.credits_in_progress > 0 && <><dt className="text-zinc-500">En curso ahora</dt><dd className="text-right font-semibold tabular-nums">{p.credits_in_progress} cr</dd></>}
          {p.transfer_credits > 0 && <><dt className="text-zinc-500">Convalidados</dt><dd className="text-right font-semibold tabular-nums">{p.transfer_credits} cr</dd></>}
          <dt className="text-zinc-500">Periodos terminados</dt>
          <dd className="text-right font-semibold tabular-nums">
            {p.periods_used}{p.max_periods ? ` de ${p.max_periods} máx.` : ""}
            {p.prior_periods > 0 && <span className="block text-[10px] font-normal text-zinc-400">{p.periods_in_app} en la app + {p.prior_periods} sin registrar</span>}
          </dd>
          {p.periods_left !== null && <><dt className="text-zinc-500">Te faltan a tu ritmo</dt><dd className="text-right font-semibold tabular-nums">{p.periods_left} periodo(s)</dd></>}
        </dl>
        <Pace p={p} />
      </Card>
      <Card title="Metas de índice" icon={Target} className="lg:col-span-2">
        {p.targets.length === 0 ? (
          <p className="text-xs text-zinc-500">Agrega niveles de honor o un índice deseado en la carrera.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{p.targets.map((t) => <TargetCard key={`${t.kind}-${t.name}`} t={t} max={max} />)}</div>
        )}
        {p.expected_points !== null && left > 0 && (
          <p className="mt-3 text-[11px] text-zinc-400">La probabilidad es una estimación con tu rendimiento por materia (promedio {p.expected_points.toFixed(2)} puntos) y su variación; no es una garantía.</p>
        )}
      </Card>
      <TimeGoal p={p} />
      <Card title="Requisitos de honores" icon={ShieldCheck} className="lg:col-span-3">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {p.requirements.map((r) => (
            <li key={r.key} className="flex gap-2 text-xs">
              <span className={`w-4 text-center font-bold ${REQ_ICON[r.status][1]}`} aria-label={r.status}>{REQ_ICON[r.status][0]}</span>
              <span><b className="text-zinc-800">{r.label}.</b> <span className="text-zinc-500">{r.detail}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-zinc-400">{p.eligible ? "Hasta ahora cumples los requisitos conocidos (los marcados con ? no se pueden verificar)." : "Con lo marcado en rojo pierdes los honores; tu índice deseado se sigue calculando."}</p>
      </Card>
    </div>
  );
}

const shortDate = (iso: string) => formatDay(iso, { day: "numeric", month: "short", year: "numeric" });

/** Tu ritmo frente a la duración del pénsum y al límite de créditos. */
function Pace({ p }: { p: GradesPlan }) {
  const x = p.pace;
  if (x.your_rate === null && x.plan_periods === null && x.limit === null) return null;
  const tone = x.delta === null ? "" : x.delta < 0 ? "text-green-700" : x.delta > 0 ? "text-amber-700" : "text-zinc-700";
  return (
    <div className="mt-4 pt-3 border-t border-zinc-100 space-y-1.5 text-xs">
      <div className="font-bold text-zinc-900">Ritmo</div>
      <dl className="grid grid-cols-2 gap-y-1.5">
        {x.your_rate !== null && <><dt className="text-zinc-500">Inscribes</dt><dd className="text-right font-semibold tabular-nums">{x.your_rate} cr/periodo</dd></>}
        {x.pensum_rate !== null && <><dt className="text-zinc-500">El pénsum pide</dt><dd className="text-right font-semibold tabular-nums">{x.pensum_rate} cr/periodo</dd></>}
        {x.limit !== null && <><dt className="text-zinc-500">Límite</dt><dd className="text-right font-semibold tabular-nums">{x.limit} cr/periodo</dd></>}
        {x.projected_total !== null && (
          <>
            <dt className="text-zinc-500">Terminarías en</dt>
            <dd className="text-right font-semibold tabular-nums">
              {x.projected_total} periodos{x.plan_periods ? ` de ${x.plan_periods}` : ""}
              {x.projected_end && <span className="block text-[10px] font-normal text-zinc-400">≈ {shortDate(x.projected_end)}</span>}
            </dd>
          </>
        )}
        {x.fastest_left !== null && x.fastest_end && (
          <><dt className="text-zinc-500">Lo más rápido</dt><dd className="text-right font-semibold tabular-nums">{x.fastest_left} periodo(s)<span className="block text-[10px] font-normal text-zinc-400">≈ {shortDate(x.fastest_end)}, al límite</span></dd></>
        )}
      </dl>
      {x.delta !== null && (
        <p className={`font-semibold ${tone}`}>
          {x.delta === 0 ? "Vas al día con el pénsum." : `Vas ${Math.abs(x.delta)} periodo(s) ${x.delta < 0 ? "adelantado" : "atrasado"} respecto al pénsum.`}
        </p>
      )}
    </div>
  );
}

const GOAL_META = {
  posible: { label: "Posible", className: "bg-green-50 text-green-700 border-green-200" },
  exigente: { label: "Exigente", className: "bg-amber-50 text-amber-800 border-amber-200" },
  imposible: { label: "No cabe", className: "bg-rose-50 text-rose-700 border-rose-200" },
} as const;

/** Meta de terminar para una fecha: plan por periodo con los créditos que tocan. */
function TimeGoal({ p }: { p: GradesPlan }) {
  const g = p.time_goal;
  if (!g) {
    return (
      <Card title="Meta de tiempo" icon={Flag} className="lg:col-span-3">
        <p className="text-xs text-zinc-500">Pon una fecha en <b>Carrera e historial → Metas → Terminar la carrera para</b> (ej. en 6 meses) y aquí verás si es posible y un plan de créditos por periodo.</p>
      </Card>
    );
  }
  const meta = GOAL_META[g.status];
  return (
    <Card title={`Meta: terminar para el ${shortDate(g.end_date)}`} icon={Flag} className="lg:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="text-xl font-bold tabular-nums text-zinc-950">{g.credits_per_period ?? "—"}</div>
            <div className="text-[10px] text-zinc-500">créditos por periodo{g.subjects_per_period !== null ? ` · ≈${g.subjects_per_period} materias` : ""}</div>
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums text-zinc-950">{g.periods_available}</div>
            <div className="text-[10px] text-zinc-500">periodo(s) en {g.months} meses</div>
          </div>
          {g.your_rate !== null && (
            <div>
              <div className="text-xl font-bold tabular-nums text-zinc-950">{g.your_rate}</div>
              <div className="text-[10px] text-zinc-500">créditos que sueles inscribir</div>
            </div>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>
      </div>
      {g.periods.length > 0 && (
        <ol className="mt-4 divide-y divide-zinc-100">
          {g.periods.map((x, i) => (
            <li key={x.start} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs">
              <span className="w-20 font-semibold text-zinc-900">Periodo {i + 1}</span>
              <span className="flex-1 min-w-0 text-zinc-500">{shortDate(x.start)} – {shortDate(x.end)}{x.in_progress && " · en curso"}</span>
              <span className="font-semibold tabular-nums text-zinc-900">{x.credits} cr{x.subjects !== null && <span className="font-normal text-zinc-400"> · ≈{x.subjects} materias</span>}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11px] text-zinc-500">
        {g.status === "imposible"
          ? (g.credits_per_period === null
              ? `No cabe ningún periodo completo antes de esa fecha: el próximo termina el ${shortDate(g.next_end)}.`
              : `Aun al límite${g.limit ? ` de ${g.limit} créditos` : ""} quedarían ${g.leftover} créditos fuera.`)
            + (g.earliest_end ? ` Lo más pronto que terminarías: ≈ ${shortDate(g.earliest_end)}.` : "")
          : g.status === "exigente"
            ? "Es más carga de la que sueles inscribir: ojo con tu índice, cada crédito extra pesa en tus metas."
            : "Cabe a un ritmo que ya has llevado."}
        {" "}Los periodos se calculan con la duración de tu horario más reciente.
      </p>
    </Card>
  );
}
