import { apiErrorMessage, getApiBase } from "./api";

// ============ Tipos ============
export type TaskStatus = "pending" | "done" | "partial" | "not_done" | "postponed";
export type Priority = "high" | "medium" | "low";

export interface Category {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  position: number;
  is_academic: boolean;
}

export interface Task {
  id: string;
  title: string;
  category_id: string | null;
  priority: Priority;
  date: string | null;
  time: string | null;
  status: TaskStatus;
  status_at: string | null;
  recurrence_id: string | null;
  postponed_from_id: string | null;
  postpone_count: number;
  position: number;
  subject_id: string | null;
  assignment_type: AssignmentType | null;
}

export interface TaskInput {
  title: string;
  category_id?: string | null;
  priority?: Priority;
  date?: string | null;
  time?: string | null;
  subject_id?: string | null;
  assignment_type?: AssignmentType | null;
}

export type HabitKind = "building" | "established";
export type HabitLogStatus = "done" | "not_done";

export interface HabitStats {
  streak: number;
  end_date: string | null;
  // en construcción
  expected_total?: number;
  expected_so_far?: number;
  done?: number;
  rate_so_far?: number | null;
  needed?: number;
  days_left?: number;
  on_track?: boolean;
  // ya establecido
  done_30d?: number;
  expected_30d?: number;
  rate_30d?: number | null;
}

export interface Habit {
  id: string;
  title: string;
  category_id: string | null;
  time: string | null;
  weekdays: number[];
  kind: HabitKind;
  status: "active" | "needs_adjust" | "archived";
  start_date: string;
  period_days: number | null;
  target_rate: number;
  consolidated_on: string | null;
  evaluated_on: string | null;
  last_rate: number | null;
  adjustments: number;
  stats: HabitStats | null;
}

export interface HabitInput {
  title: string;
  category_id?: string | null;
  time?: string | null;
  weekdays: number[];
  kind: HabitKind;
  start_date: string;
  period_days?: number | null;
  target_rate?: number;
}

export interface HabitEntry {
  habit_id: string;
  date: string;
  status: HabitLogStatus | null;
}

export type ChallengeStatus = "pending" | "achieved" | "partial" | "failed";

export interface Challenge {
  id: string;
  title: string;
  category_id: string | null;
  date: string;
  time: string | null;
  status: ChallengeStatus;
  result_note: string | null;
  status_at: string | null;
}

export interface ChallengeInput {
  title: string;
  category_id?: string | null;
  date: string;
  time?: string | null;
}

export interface Agenda {
  tasks: Task[];
  habits: Habit[];
  habit_entries: HabitEntry[];
  challenges: Challenge[];
  classes: ClassOccurrence[];
}

// ============ Horario de clases ============
export type PeriodType = "bimestral" | "trimestral" | "cuatrimestral" | "semestral" | "anual" | "verano" | "personalizado";
export type AssignmentType = "tarea" | "examen" | "proyecto" | "exposicion" | "lectura";
export type Modality = "presencial" | "virtual" | "mixta";

export const PERIOD_META: Record<PeriodType, { label: string; months: number | null }> = {
  bimestral: { label: "Bimestral", months: 2 },
  trimestral: { label: "Trimestral", months: 3 },
  cuatrimestral: { label: "Cuatrimestral", months: 4 },
  semestral: { label: "Semestral", months: 6 },
  anual: { label: "Anual", months: 12 },
  verano: { label: "Verano / intensivo", months: 2 },
  personalizado: { label: "Personalizado", months: null },
};

export const ASSIGNMENT_META: Record<AssignmentType, { label: string; emoji: string; className: string }> = {
  tarea: { label: "Tarea", emoji: "📝", className: "bg-zinc-50 text-zinc-700 border-zinc-200" },
  examen: { label: "Examen", emoji: "🧪", className: "bg-rose-50 text-rose-700 border-rose-200" },
  proyecto: { label: "Proyecto", emoji: "🧩", className: "bg-violet-50 text-violet-700 border-violet-200" },
  exposicion: { label: "Exposición", emoji: "🎤", className: "bg-sky-50 text-sky-700 border-sky-200" },
  lectura: { label: "Lectura", emoji: "📖", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

/** Fin sugerido: mismo día N meses después, menos un día (igual que el backend). */
/** Tipos de periodo que puede tener una carrera, con su nombre en plural para contar. */
export const PROGRAM_PERIODS: Record<Exclude<PeriodType, "verano" | "personalizado">, string> = {
  bimestral: "bimestres", trimestral: "trimestres", cuatrimestral: "cuatrimestres", semestral: "semestres", anual: "años",
};

export function suggestedEnd(start: string, type: PeriodType): string | null {
  const months = PERIOD_META[type].months;
  if (!months) return null;
  const d = fromISO(start);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  target.setDate(target.getDate() - 1);
  return toISO(target);
}

export interface ClassSession {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string | null;
  conflicts: string[];
}

export interface SessionInput {
  id?: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location?: string | null;
}

export interface Subject {
  id: string;
  schedule_id: string;
  name: string;
  code: string | null;
  teacher: string | null;
  color: string;
  credits: number | null;
  modality: Modality;
  location: string | null;
  link: string | null;
  sessions: ClassSession[];
  weekly_minutes: number;
  assignments: { total: number; done: number; pending: number; overdue: number; next_date: string | null; next_exam: string | null };
  final_grade: number | null;
  course_id: string | null;
  letter: string | null;
  passed: boolean | null;
}

export interface SubjectInput {
  name: string;
  code?: string | null;
  teacher?: string | null;
  color: string;
  credits?: number | null;
  modality: Modality;
  location?: string | null;
  link?: string | null;
  course_id?: string | null;
  sessions: SessionInput[];
}

export interface Schedule {
  id: string;
  name: string;
  program_id: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  is_archived: boolean;
  final_grade: number | null;
  subjects: Subject[];
  weekly_minutes: number;
  credits: number;
  grades: { graded: number; total: number; average: number | null; period_index: number | null; passed: number; failed: number };
}

export interface ScheduleInput {
  name: string;
  program_id?: string | null;
  period_type?: PeriodType;
  start_date: string;
  end_date?: string | null;
}

export type AttendanceStatus = "attended" | "absent";

export interface ClassOccurrence {
  session_id: string;
  subject_id: string;
  schedule_id: string;
  date: string;
  start_time: string;
  end_time: string;
  subject: string;
  color: string;
  location: string | null;
  modality: Modality;
  link: string | null;
  teacher: string | null;
  attendance: AttendanceStatus | null;
}

// ============ Notas ============
export interface GradeBand {
  letter: string;
  min: number;
  points: number;
}

export type CourseStatus = "aprobada" | "cursando" | "disponible" | "bloqueada";

/** Materia del pénsum con su estado según tus horarios. */
export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number | null;
  term: number | null;
  prereqs: string[];
  coreqs: string[];
  done: boolean;
  status: CourseStatus;
  missing_prereqs: string[];
  pending_coreqs: string[];
  failed_before: boolean;
  grade: number | null;
}

export interface Curriculum {
  courses: Course[];
  summary: { total: number; aprobada: number; cursando: number; disponible: number; bloqueada: number; credits_total: number; credits_passed: number };
}

/** credits = índice ponderado por créditos · average = promedio 0-100 de una nota por periodo. */
export type Grading = "credits" | "average";

export interface HonorLevel {
  name: string;
  min: number;
}

/** Carrera: agrupa horarios de una institución con su escala, historial, pénsum y metas. */
export interface Program {
  id: string;
  name: string;
  institution: string | null;
  scale: GradeBand[];
  pass_min: number;
  prior_index: number | null;
  prior_credits: number | null;
  prior_courses: number | null;
  prior_passed: number | null;
  prior_failed: number | null;
  prior_periods: number | null;
  total_credits: number | null;
  total_subjects: number | null;
  transfer_credits: number | null;
  period_type: PeriodType;
  grading: Grading;
  prior_average: number | null;
  plan_periods: number | null;
  max_credits_per_period: number | null;
  goal_end_date: string | null;
  honors: HonorLevel[];
  target_index: number | null;
  probation_min: number | null;
  max_periods: number | null;
  min_institution_pct: number | null;
}

export type TargetStatus = "asegurado" | "en_camino" | "exigente" | "imposible" | "descalificado" | "logrado" | "no_alcanzado" | "sin_pensum";

export interface PlanTarget {
  name: string;
  min: number;
  kind: "honor" | "target";
  status: TargetStatus;
  needed: number | null;
  margins: { letter: string; credits: number; subjects: number | null }[];
  probability: number | null;
  final_if_all: number | null;
}

export interface GradesPlan {
  total_credits: number | null;
  total_subjects: number | null;
  transfer_credits: number;
  credits_done: number;
  credits_in_progress: number;
  credits_remaining: number | null;
  subjects_remaining: number | null;
  progress: number | null;
  periods_used: number;
  periods_in_app: number;
  prior_periods: number;
  periods_left: number | null;
  pace: {
    plan_periods: number | null;
    pensum_rate: number | null;
    your_rate: number | null;
    limit: number | null;
    projected_total: number | null;
    delta: number | null;
    projected_end: string | null;
    fastest_left: number | null;
    fastest_end: string | null;
  };
  time_goal: {
    end_date: string;
    months: number;
    periods_available: number;
    credits_per_period: number | null;
    subjects_per_period: number | null;
    next_end: string;
    earliest_end: string | null;
    your_rate: number | null;
    limit: number | null;
    status: "posible" | "exigente" | "imposible";
    periods: { start: string; end: string; credits: number; subjects: number | null; in_progress: boolean }[];
    leftover: number;
  } | null;
  max_periods: number | null;
  expected_points: number | null;
  max_index: number | null;
  eligible: boolean;
  requirements: { key: string; label: string; status: "ok" | "fail" | "warn" | "unknown"; detail: string }[];
  targets: PlanTarget[];
}

export interface GradedSubject {
  subject_id: string;
  name: string;
  color: string;
  schedule_id: string;
  schedule: string;
  grade: number;
  letter: string;
  points: number;
  credits: number | null;
  passed: boolean;
}

export interface GradesAnalytics {
  mode: "credits";
  program: { id: string; name: string; institution: string | null };
  scale: GradeBand[];
  pass_min: number;
  has_prior: boolean;
  prior: { index: number | null; credits: number | null; courses: number | null; passed: number | null; failed: number | null };
  cumulative_index: number | null;
  app_index: number | null;
  average: number | null;
  letters: Record<string, number>;
  courses: number;
  passed: number;
  failed: number;
  credits_attempted: number;
  credits_passed: number | null;
  in_progress: number;
  pending_grades: { subject_id: string; name: string; schedule: string }[];
  without_credits: string[];
  subjects: GradedSubject[];
  evolution: { schedule_id: string; name: string; start_date: string; end_date: string; subjects: number; credits: number; period_index: number | null; average: number; cumulative_index: number | null }[];
  plan: GradesPlan;
  insights: string[];
}

/** Carrera por promedio: una nota final (0-100) por periodo. */
export interface AverageAnalytics {
  mode: "average";
  program: { id: string; name: string; institution: string | null };
  scale: GradeBand[];
  pass_min: number;
  has_prior: boolean;
  prior: { average: number | null; periods: number | null; failed: number | null };
  average: number | null;
  app_average: number | null;
  periods_graded: number;
  passed: number;
  failed: number;
  in_progress: number;
  pending_grades: { schedule_id: string; name: string }[];
  evolution: { schedule_id: string; name: string; start_date: string; end_date: string; grade: number; letter: string; passed: boolean; cumulative_average: number }[];
  best: AverageAnalytics["evolution"][number] | null;
  plan: {
    total_periods: number | null;
    periods_done: number;
    periods_remaining: number | null;
    progress: number | null;
    periods_used: number;
    periods_in_app: number;
    prior_periods: number;
    pace: { plan_periods: number | null; projected_total: number | null; delta: number | null; projected_end: string | null };
    time_goal: {
      end_date: string; months: number; periods_available: number; periods_needed: number; next_end: string; earliest_end: string | null;
      status: "posible" | "imposible"; periods: { start: string; end: string; in_progress: boolean }[]; leftover: number;
    } | null;
    max_periods: number | null;
    expected_grade: number | null;
    max_average: number | null;
    eligible: boolean;
    requirements: GradesPlan["requirements"];
    targets: PlanTarget[];
  };
  insights: string[];
}

/** Letra según la escala (igual que el backend). */
export function letterFor(grade: number, scale: GradeBand[]): GradeBand {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  return sorted.find((b) => grade >= b.min) ?? sorted[sorted.length - 1];
}

export const hoursLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export interface Review {
  date: string;
  energy: number | null;
  note: string | null;
}

export interface RateRow {
  count: number;
  rate: number | null;
}

export interface TaskAnalytics {
  start: string;
  end: string;
  counts: Record<"done" | "partial" | "not_done" | "postponed", number>;
  evaluated: number;
  unreviewed: number;
  completion_rate: number | null;
  active_days: number;
  first_day: string | null;
  avg_planned_per_day: number;
  avg_done_per_day: number;
  streak: number;
  best_streak: number;
  by_weekday: (RateRow & { weekday: number; name: string })[];
  by_category: (RateRow & { category_id: string | null; name: string; color: string })[];
  by_week: (RateRow & { week_start: string })[];
  by_time_slot: (RateRow & { slot: "manana" | "tarde" | "noche" | "sin_hora" })[];
  by_energy: { energy: number; days: number; rate: number | null }[];
  top_postponed: { title: string; count: number }[];
  top_partial: { title: string; count: number }[];
  reviews: number;
  insights: string[];
}

export interface HabitAnalytics {
  expected: number;
  done: number;
  rate: number | null;
  habits: { habit_id: string; title: string; kind: HabitKind; status: string; category: string | null; expected: number; done: number; rate: number; streak: number; consolidated_on: string | null }[];
  by_weekday: (RateRow & { weekday: number; name: string })[];
  building: number;
  needs_adjust: number;
  established: number;
  consolidated_in_period: number;
  best_streak: number;
  first_day: string | null;
  active_days: number;
  insights: string[];
}

export interface ChallengeAnalytics {
  counts: Record<"achieved" | "partial" | "failed", number>;
  decided: number;
  pending_past: number;
  rate: number | null;
  by_category: (RateRow & { category_id: string | null; name: string; color: string })[];
  recent: { title: string; date: string; status: ChallengeStatus }[];
  first_day: string | null;
  active_days: number;
  insights: string[];
}

export interface ClassAnalytics {
  classes: number;
  attended: number;
  absent: number;
  unmarked: number;
  attendance_rate: number | null;
  by_subject: { subject_id: string; name: string; color: string; classes: number; attended: number; absent: number; attendance_rate: number | null; assignments: number; assignment_rate: number | null; overdue: number; exams: number; upcoming_exams: number }[];
  assignments_overdue: number;
  upcoming_exams: number;
  heavy_days: { days: number; task_rate: number | null };
  light_days: { days: number; task_rate: number | null };
  insights: string[];
}

export interface Analytics {
  start: string;
  end: string;
  overview: { tasks_rate: number | null; habits_rate: number | null; challenges_rate: number | null; attendance_rate: number | null; active_days: number; first_day: string | null };
  insights: string[];
  tasks: TaskAnalytics;
  habits: HabitAnalytics;
  challenges: ChallengeAnalytics;
  classes: ClassAnalytics;
}

export interface AiProfile {
  id: string;
  period_start: string;
  period_end: string;
  created_at: string;
  profile: {
    type: string;
    emoji?: string;
    summary: string;
    reasons: string[];
    strengths?: string[];
    recommendations: string[];
  };
  metrics: Analytics;
}

export interface NotificationPrefs {
  timezone: string;
  task_reminders: boolean;
  reminder_minutes: number;
  day_close: boolean;
  day_close_time: string;
  weekly_plan: boolean;
  weekly_plan_time: string;
  weekly_summary: boolean;
  class_reminders: boolean;
  deadline_reminders: boolean;
}

// ============ Estados (siempre con ícono + texto, nunca solo color) ============
export const STATUS_META: Record<Exclude<TaskStatus, "pending">, { label: string; color: string; soft: string }> = {
  done: { label: "Hecho", color: "#16a34a", soft: "bg-green-50 text-green-700 border-green-200" },
  partial: { label: "A medias", color: "#f59e0b", soft: "bg-amber-50 text-amber-700 border-amber-200" },
  not_done: { label: "No hecho", color: "#e11d48", soft: "bg-rose-50 text-rose-700 border-rose-200" },
  postponed: { label: "Pospuesta", color: "#0284c7", soft: "bg-sky-50 text-sky-700 border-sky-200" },
};

export const CHALLENGE_META: Record<Exclude<ChallengeStatus, "pending">, { label: string; color: string; soft: string; emoji: string }> = {
  achieved: { label: "Logrado", color: "#16a34a", soft: "bg-green-50 text-green-700 border-green-200", emoji: "🏆" },
  partial: { label: "Parcial", color: "#f59e0b", soft: "bg-amber-50 text-amber-700 border-amber-200", emoji: "🟡" },
  failed: { label: "No logrado", color: "#e11d48", soft: "bg-rose-50 text-rose-700 border-rose-200", emoji: "❌" },
};

export const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  high: { label: "Alta", className: "text-rose-600" },
  medium: { label: "Media", className: "text-amber-600" },
  low: { label: "Baja", className: "text-zinc-400" },
};

// ============ Fechas (siempre locales, formato YYYY-MM-DD) ============
export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAY_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** 0 = lunes ... 6 = domingo (igual que el backend) */
export function weekdayOf(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7;
}

export function weekStart(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  const s = fromISO(iso).toLocaleDateString("es-DO", opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============ API ============
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fydry_access_token") || localStorage.getItem("fydry_token");
}

async function send<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor. Intenta de nuevo.", 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(apiErrorMessage(data, res.status), res.status);
  return data as T;
}

const qs = (p: Record<string, string>) => `?${new URLSearchParams(p).toString()}`;

export const api = {
  categories: () => send<Category[]>("/categories"),
  createCategory: (name: string, color: string, is_academic = false) => send<Category>("/categories", "POST", { name, color, is_academic }),
  updateCategory: (id: string, data: Partial<Pick<Category, "name" | "color" | "is_academic">>) => send<Category>(`/categories/${id}`, "PATCH", data),
  deleteCategory: (id: string) => send<null>(`/categories/${id}`, "DELETE"),

  tasks: (start: string, end: string) => send<Task[]>(`/tasks${qs({ start, end })}`),
  inbox: () => send<Task[]>("/tasks/inbox"),
  createTask: (data: TaskInput) => send<Task>("/tasks", "POST", data),
  updateTask: (id: string, data: Partial<TaskInput> & { status?: Exclude<TaskStatus, "postponed"> }) => send<Task>(`/tasks/${id}`, "PATCH", data),
  postpone: (id: string, date: string | null) => send<Task>(`/tasks/${id}/postpone`, "POST", { date }),
  deleteTask: (id: string) => send<null>(`/tasks/${id}`, "DELETE"),
  copyWeek: (from_start: string, to_start: string) => send<Task[]>("/tasks/copy-week", "POST", { from_start, to_start }),

  agenda: (start: string, end: string) => send<Agenda>(`/agenda${qs({ start, end, today: todayISO() })}`),

  habits: (includeArchived = false) => send<Habit[]>(`/habits${qs({ today: todayISO(), include_archived: String(includeArchived) })}`),
  createHabit: (data: HabitInput) => send<Habit>("/habits", "POST", data),
  updateHabit: (id: string, data: Partial<Omit<HabitInput, "kind" | "start_date" | "period_days">> & { status?: "active" | "archived" }) => send<Habit>(`/habits/${id}`, "PATCH", data),
  deleteHabit: (id: string) => send<null>(`/habits/${id}`, "DELETE"),
  logHabit: (id: string, date: string, status: HabitLogStatus | null) => send<HabitEntry>(`/habits/${id}/log`, "PUT", { date, status }),
  extendHabit: (id: string, days: number) => send<Habit>(`/habits/${id}/extend`, "POST", { days }),
  restartHabit: (id: string, start_date: string, period_days: number) => send<Habit>(`/habits/${id}/restart`, "POST", { start_date, period_days }),

  schedules: () => send<Schedule[]>(`/schedules${qs({ today: todayISO() })}`),
  createSchedule: (data: ScheduleInput) => send<Schedule>(`/schedules${qs({ today: todayISO() })}`, "POST", data),
  updateSchedule: (id: string, data: Partial<ScheduleInput> & { is_archived?: boolean }) => send<Schedule>(`/schedules/${id}${qs({ today: todayISO() })}`, "PATCH", data),
  deleteSchedule: (id: string) => send<null>(`/schedules/${id}`, "DELETE"),
  duplicateSchedule: (id: string, data: ScheduleInput) => send<Schedule>(`/schedules/${id}/duplicate${qs({ today: todayISO() })}`, "POST", data),
  createSubject: (scheduleId: string, data: SubjectInput) => send<Schedule>(`/schedules/${scheduleId}/subjects${qs({ today: todayISO() })}`, "POST", data),
  updateSubject: (id: string, data: SubjectInput) => send<Schedule>(`/subjects/${id}${qs({ today: todayISO() })}`, "PUT", data),
  deleteSubject: (id: string) => send<null>(`/subjects/${id}`, "DELETE"),
  subjectAssignments: (id: string) => send<Task[]>(`/subjects/${id}/assignments`),
  setGrade: (subjectId: string, grade: number | null) => send<{ letter: string | null; passed: boolean | null }>(`/subjects/${subjectId}/grade`, "PUT", { grade }),
  programs: () => send<Program[]>("/programs"),
  createProgram: (data: Partial<Program>) => send<Program>("/programs", "POST", data),
  updateProgram: (id: string, data: Partial<Program>) => send<Program>(`/programs/${id}${qs({ today: todayISO() })}`, "PUT", data),
  deleteProgram: (id: string) => send<null>(`/programs/${id}`, "DELETE"),
  courses: (programId: string) => send<Curriculum>(`/programs/${programId}/courses${qs({ today: todayISO() })}`),
  saveCourses: (programId: string, courses: Pick<Course, "code" | "name" | "credits" | "term" | "prereqs" | "coreqs" | "done">[]) =>
    send<Curriculum>(`/programs/${programId}/courses${qs({ today: todayISO() })}`, "PUT", { courses }),
  setScheduleGrade: (id: string, grade: number | null) => send<{ grade: number | null; letter: string | null; passed: boolean | null }>(`/schedules/${id}/grade`, "PUT", { grade }),
  gradesAnalytics: (programId?: string | null) => send<GradesAnalytics | AverageAnalytics>(`/grades/analytics${qs({ today: todayISO(), ...(programId ? { program_id: programId } : {}) })}`),
  markAttendance: (sessionId: string, date: string, status: AttendanceStatus | null) => send<unknown>(`/sessions/${sessionId}/attendance`, "PUT", { date, status }),

  challenges: (start: string, end: string) => send<Challenge[]>(`/challenges${qs({ start, end })}`),
  createChallenge: (data: ChallengeInput) => send<Challenge>("/challenges", "POST", data),
  updateChallenge: (id: string, data: Partial<ChallengeInput>) => send<Challenge>(`/challenges/${id}`, "PATCH", data),
  challengeResult: (id: string, status: ChallengeStatus, note: string | null) => send<Challenge>(`/challenges/${id}/result`, "POST", { status, note }),
  deleteChallenge: (id: string) => send<null>(`/challenges/${id}`, "DELETE"),

  reviews: (start: string, end: string) => send<Review[]>(`/reviews${qs({ start, end })}`),
  saveReview: (date: string, energy: number | null, note: string | null) => send<Review>(`/reviews/${date}`, "PUT", { energy, note }),

  analytics: (start: string, end: string) => send<Analytics>(`/analytics${qs({ start, end, today: todayISO() })}`),
  profile: () => send<AiProfile | null>("/profile"),
  generateProfile: () => send<AiProfile>(`/profile/generate${qs({ today: todayISO() })}`, "POST"),

  pushConfig: () => send<{ enabled: boolean; public_key: string | null }>("/push/config"),
  subscribePush: (sub: PushSubscriptionJSON) => send<null>("/push/subscribe", "POST", sub),
  unsubscribePush: (endpoint: string) => send<null>("/push/unsubscribe", "POST", { endpoint }),
  testPush: () => send<{ delivered: number }>("/push/test", "POST"),
  prefs: () => send<NotificationPrefs>("/notifications/prefs"),
  savePrefs: (data: Partial<NotificationPrefs>) => send<NotificationPrefs>("/notifications/prefs", "PUT", data),
};

/** Puntaje del día: Hecho 1, A medias 0.5, No hecho/Pospuesta 0. null si nada marcado. */
export function dayScore(tasks: Task[]): { rate: number | null; marked: number; total: number } {
  const marked = tasks.filter((t) => t.status !== "pending");
  const w: Record<string, number> = { done: 1, partial: 0.5, not_done: 0, postponed: 0 };
  const score = marked.reduce((s, t) => s + (w[t.status] ?? 0), 0);
  return { rate: marked.length ? score / marked.length : null, marked: marked.length, total: tasks.length };
}
