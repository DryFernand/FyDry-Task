"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Plus, Repeat, Send, Settings, Smartphone, Tag, Trash2 } from "lucide-react";
import { TaskFormTarget } from "../TaskFormModal";
import { useLoad } from "../useLoad";
import { api, Category, NotificationPrefs, WEEKDAY_SHORT } from "@/lib/tasks";
import { disablePush, enablePush, pushState, PushState } from "@/lib/push";

const PALETTE = ["#6e2234", "#16a34a", "#2563eb", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#52525b"];

function Section({ title, icon: Icon, children, action }: { title: string; icon: typeof Tag; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-900"><Icon className="w-4 h-4 text-zinc-400" aria-hidden="true" /> {title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${checked ? "bg-emerald-700" : "bg-zinc-300"}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export default function SettingsView({
  categories,
  reloadCategories,
  refreshKey,
  onError,
  onInfo,
  openForm,
}: {
  categories: Category[];
  reloadCategories: () => void;
  refreshKey: number;
  onError: (m: string) => void;
  onInfo: (m: string) => void;
  openForm: (t: TaskFormTarget) => void;
}) {
  const recs = useLoad(() => api.recurrences(), [], refreshKey, onError);
  const prefsLoad = useLoad(() => api.prefs(), [], refreshKey, onError);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [newCat, setNewCat] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[5]);
  const [push, setPush] = useState<PushState | "loading">("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const shownPrefs = prefs ?? prefsLoad.data;
  const catOf = (id: string | null) => categories.find((c) => c.id === id);

  useEffect(() => {
    pushState().then(setPush).catch(() => setPush("unsupported"));
  }, []);

  const guard = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) onInfo(ok);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Algo salió mal.");
    }
  };

  const savePref = (patch: Partial<NotificationPrefs>) =>
    guard(async () => setPrefs(await api.savePrefs(patch)));

  const togglePush = async () => {
    setPushBusy(true);
    try {
      setPush(push === "on" ? await disablePush() : await enablePush());
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudieron activar las notificaciones.");
    } finally {
      setPushBusy(false);
    }
  };

  const input = "px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:border-zinc-900";

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
          <Settings className="w-3.5 h-3.5" aria-hidden="true" /> Configuración
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">Tu espacio</h1>
      </div>

      <Section title="Categorías" icon={Tag}>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input type="color" value={c.color} aria-label={`Color de ${c.name}`} onChange={(e) => guard(async () => { await api.updateCategory(c.id, { color: e.target.value }); reloadCategories(); })} className="w-8 h-8 rounded-lg border border-zinc-200 cursor-pointer bg-white p-0.5" />
              <input
                defaultValue={c.name}
                maxLength={60}
                aria-label="Nombre de la categoría"
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && guard(async () => { await api.updateCategory(c.id, { name: e.target.value.trim() }); reloadCategories(); })}
                className={`${input} flex-1 min-w-0`}
              />
              <button
                type="button"
                aria-label={`Eliminar ${c.name}`}
                onClick={() => window.confirm(`¿Eliminar "${c.name}"? Sus tareas quedarán sin categoría.`) && guard(async () => { await api.deleteCategory(c.id); reloadCategories(); })}
                className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            guard(async () => { await api.createCategory(newCat.trim(), newColor); setNewCat(""); reloadCategories(); });
          }}
        >
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} aria-label="Color de la nueva categoría" className="w-8 h-8 rounded-lg border border-zinc-200 cursor-pointer bg-white p-0.5" />
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={60} placeholder="Nueva categoría" aria-label="Nueva categoría" className={`${input} flex-1 min-w-0`} />
          <button type="submit" className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold cursor-pointer"><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </form>
      </Section>

      <Section
        title="Tareas recurrentes"
        icon={Repeat}
        action={<button type="button" onClick={() => openForm({ kind: "new-recurrence" })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"><Plus className="w-3.5 h-3.5" /> Nueva</button>}
      >
        {recs.loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
        ) : (recs.data ?? []).length === 0 ? (
          <p className="text-xs text-zinc-400">Crea tareas que se repiten, como &quot;Gimnasio lunes, miércoles y viernes&quot;. Aparecen solas en tu semana.</p>
        ) : (
          <ul className="space-y-2">
            {(recs.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-2 p-2.5 rounded-2xl border border-zinc-200/80">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: catOf(r.category_id)?.color ?? "#d4d4d8" }} aria-hidden="true" />
                <button type="button" onClick={() => openForm({ kind: "edit-recurrence", rec: r })} className="flex-1 min-w-0 text-left cursor-pointer">
                  <div className="text-sm font-medium text-zinc-900 truncate">{r.title}</div>
                  <div className="text-[11px] text-zinc-400">{r.weekdays.map((d) => WEEKDAY_SHORT[d]).join(", ")}{r.time ? ` · ${r.time}` : ""}</div>
                </button>
                <button
                  type="button"
                  aria-label={`Detener ${r.title}`}
                  onClick={() => window.confirm(`¿Dejar de repetir "${r.title}"? Se borran las próximas pendientes; el historial se conserva.`) && guard(async () => { await api.deleteRecurrence(r.id); recs.reload(); }, "Recurrencia detenida.")}
                  className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Notificaciones" icon={Bell}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/60">
          <div className="text-xs text-zinc-700 max-w-md">
            {push === "loading" && "Revisando este dispositivo…"}
            {push === "on" && "✅ Activadas en este dispositivo."}
            {push === "off" && "Recibe avisos aunque tengas la app cerrada."}
            {push === "denied" && "Bloqueaste las notificaciones. Actívalas en los permisos del navegador para este sitio."}
            {push === "unsupported" && "Este navegador no admite notificaciones push."}
            {push === "needs-install" && (
              <span className="flex gap-1.5">
                <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
                En iPhone: toca Compartir → &quot;Agregar a inicio&quot; y abre FyDry Task desde ese ícono para activar los avisos.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {(push === "on" || push === "off") && (
              <button type="button" onClick={togglePush} disabled={pushBusy} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60 ${push === "on" ? "border border-zinc-200 bg-white text-zinc-700" : "bg-emerald-700 text-white"}`}>
                {pushBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : push === "on" ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                {push === "on" ? "Desactivar" : "Activar notificaciones"}
              </button>
            )}
            {push === "on" && (
              <button type="button" onClick={() => guard(() => api.testPush(), "Notificación de prueba enviada.")} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 cursor-pointer">
                <Send className="w-3.5 h-3.5" /> Probar
              </button>
            )}
          </div>
        </div>

        {shownPrefs && (
          <ul className="mt-3 divide-y divide-zinc-100">
            <li className="flex items-center justify-between gap-3 py-3">
              <div className="text-xs">
                <div className="font-semibold text-zinc-900">Recordatorio de tareas con hora</div>
                <div className="text-zinc-500 flex items-center gap-1.5 mt-1">
                  <input type="number" min={0} max={180} value={shownPrefs.reminder_minutes} aria-label="Minutos antes" onChange={(e) => savePref({ reminder_minutes: Math.min(180, Math.max(0, Number(e.target.value) || 0)) })} className="w-16 px-2 py-1 rounded-lg border border-zinc-200 text-xs" />
                  minutos antes
                </div>
              </div>
              <Toggle checked={shownPrefs.task_reminders} onChange={(v) => savePref({ task_reminders: v })} label="Recordatorio de tareas" />
            </li>
            <li className="flex items-center justify-between gap-3 py-3">
              <div className="text-xs">
                <div className="font-semibold text-zinc-900">Cierre del día</div>
                <div className="text-zinc-500 flex items-center gap-1.5 mt-1">
                  a las <input type="time" value={shownPrefs.day_close_time} aria-label="Hora del cierre" onChange={(e) => e.target.value && savePref({ day_close_time: e.target.value })} className="px-2 py-1 rounded-lg border border-zinc-200 text-xs" />
                </div>
              </div>
              <Toggle checked={shownPrefs.day_close} onChange={(v) => savePref({ day_close: v })} label="Cierre del día" />
            </li>
            <li className="flex items-center justify-between gap-3 py-3">
              <div className="text-xs">
                <div className="font-semibold text-zinc-900">Planificar la semana</div>
                <div className="text-zinc-500 flex items-center gap-1.5 mt-1">
                  domingos a las <input type="time" value={shownPrefs.weekly_plan_time} aria-label="Hora de planificar" onChange={(e) => e.target.value && savePref({ weekly_plan_time: e.target.value })} className="px-2 py-1 rounded-lg border border-zinc-200 text-xs" />
                </div>
              </div>
              <Toggle checked={shownPrefs.weekly_plan} onChange={(v) => savePref({ weekly_plan: v })} label="Planificar la semana" />
            </li>
            <li className="flex items-center justify-between gap-3 py-3">
              <div className="text-xs">
                <div className="font-semibold text-zinc-900">Resumen semanal listo</div>
                <div className="text-zinc-500 mt-1">lunes a las 8:00</div>
              </div>
              <Toggle checked={shownPrefs.weekly_summary} onChange={(v) => savePref({ weekly_summary: v })} label="Resumen semanal" />
            </li>
            <li className="pt-3 text-[11px] text-zinc-400">Zona horaria: {shownPrefs.timezone}</li>
          </ul>
        )}
      </Section>
    </div>
  );
}
