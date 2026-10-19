"use client";

import { useState } from "react";
import { BarChart3, Flame, GraduationCap, Lightbulb, ListChecks, Loader2, Repeat, Repeat2, Target, Trophy } from "lucide-react";
import { KindIcon } from "../ItemRows";
import { useLoad } from "../useLoad";
import { addDays, Analytics, api, CHALLENGE_META, ChallengeAnalytics, ClassAnalytics, formatDay, HabitAnalytics, STATUS_META, todayISO, weekStart } from "@/lib/tasks";

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

export default function AnalyticsView({ refreshKey, onError }: { refreshKey: number; onError: (m: string) => void }) {
  const [range, setRange] = useState<RangeKey>("4_weeks");
  const [start, end] = rangeOf(range);
  const { data: all, loading } = useLoad<Analytics>(() => api.analytics(start, end), [start, end], refreshKey, onError);
  const [tab, setTab] = useState<"tasks" | "habits" | "challenges" | "classes">("tasks");
  const hasClasses = !!all && (all.classes.classes > 0 || all.classes.by_subject.length > 0);
  const m = all?.tasks;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> Análisis
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">Tu actividad</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatDay(start, { day: "numeric", month: "short" })} – {formatDay(end, { day: "numeric", month: "short" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100" role="radiogroup" aria-label="Periodo">
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
          {/* Resumen general de las 3 secciones */}
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

          <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100 w-fit" role="tablist" aria-label="Sección">
            {([["tasks", "Tareas"], ["habits", "Hábitos"], ["challenges", "Retos"], ...(hasClasses ? [["classes", "Clases"]] : [])] as [typeof tab, string][]).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${tab === k ? "bg-white shadow-xs text-zinc-950" : "text-zinc-500"}`}>
                {k === "classes" ? <GraduationCap className="w-3.5 h-3.5 text-sky-700" /> : <KindIcon kind={k === "tasks" ? "task" : k === "habits" ? "habit" : "challenge"} />} {label}
              </button>
            ))}
          </div>

          {tab === "habits" && <HabitsSection h={all.habits} />}
          {tab === "challenges" && <ChallengesSection c={all.challenges} />}
          {tab === "classes" && <ClassesSection k={all.classes} />}
          {tab === "tasks" && (
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
