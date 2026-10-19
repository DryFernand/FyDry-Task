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
}

export interface TaskInput {
  title: string;
  category_id?: string | null;
  priority?: Priority;
  date?: string | null;
  time?: string | null;
}

export interface Recurrence {
  id: string;
  title: string;
  category_id: string | null;
  priority: Priority;
  time: string | null;
  weekdays: number[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export interface Review {
  date: string;
  energy: number | null;
  note: string | null;
}

export interface RateRow {
  count: number;
  rate: number | null;
}

export interface Analytics {
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
}

// ============ Estados (siempre con ícono + texto, nunca solo color) ============
export const STATUS_META: Record<Exclude<TaskStatus, "pending">, { label: string; color: string; soft: string }> = {
  done: { label: "Hecho", color: "#16a34a", soft: "bg-green-50 text-green-700 border-green-200" },
  partial: { label: "A medias", color: "#f59e0b", soft: "bg-amber-50 text-amber-700 border-amber-200" },
  not_done: { label: "No hecho", color: "#e11d48", soft: "bg-rose-50 text-rose-700 border-rose-200" },
  postponed: { label: "Pospuesta", color: "#0284c7", soft: "bg-sky-50 text-sky-700 border-sky-200" },
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
  createCategory: (name: string, color: string) => send<Category>("/categories", "POST", { name, color }),
  updateCategory: (id: string, data: Partial<Pick<Category, "name" | "color">>) => send<Category>(`/categories/${id}`, "PATCH", data),
  deleteCategory: (id: string) => send<null>(`/categories/${id}`, "DELETE"),

  tasks: (start: string, end: string) => send<Task[]>(`/tasks${qs({ start, end })}`),
  inbox: () => send<Task[]>("/tasks/inbox"),
  createTask: (data: TaskInput) => send<Task>("/tasks", "POST", data),
  updateTask: (id: string, data: Partial<TaskInput> & { status?: Exclude<TaskStatus, "postponed"> }) => send<Task>(`/tasks/${id}`, "PATCH", data),
  postpone: (id: string, date: string | null) => send<Task>(`/tasks/${id}/postpone`, "POST", { date }),
  deleteTask: (id: string) => send<null>(`/tasks/${id}`, "DELETE"),
  copyWeek: (from_start: string, to_start: string) => send<Task[]>("/tasks/copy-week", "POST", { from_start, to_start }),

  recurrences: () => send<Recurrence[]>("/recurrences"),
  createRecurrence: (data: Omit<Recurrence, "id" | "is_active" | "end_date"> & { end_date?: string | null }) => send<Recurrence>("/recurrences", "POST", data),
  updateRecurrence: (id: string, data: Partial<Omit<Recurrence, "id" | "is_active">>) => send<Recurrence>(`/recurrences/${id}${qs({ today: todayISO() })}`, "PATCH", data),
  deleteRecurrence: (id: string) => send<null>(`/recurrences/${id}${qs({ today: todayISO() })}`, "DELETE"),

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
