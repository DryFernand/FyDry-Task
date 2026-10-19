"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, BrainCircuit, CalendarDays, CheckCircle2, AlertCircle, Loader2, LogOut, Plus, Settings, Sun } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { api, Category, todayISO } from "@/lib/tasks";
import { registerServiceWorker } from "@/lib/push";
import { useLanguage } from "@/context/LanguageContext";
import TaskFormModal, { TaskFormTarget } from "./TaskFormModal";
import DayCloseModal from "./DayCloseModal";
import TodayView from "./views/TodayView";
import WeekView from "./views/WeekView";
import AnalyticsView from "./views/AnalyticsView";
import ProfileView from "./views/ProfileView";
import SettingsView from "./views/SettingsView";

type User = { id?: string; full_name?: string; email?: string };
type Tab = "today" | "week" | "analytics" | "profile" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Sun }[] = [
  { id: "today", label: "Mi día", icon: Sun },
  { id: "week", label: "Semana", icon: CalendarDays },
  { id: "analytics", label: "Análisis", icon: BarChart3 },
  { id: "profile", label: "Perfil IA", icon: BrainCircuit },
  { id: "settings", label: "Configuración", icon: Settings },
];

const SESSION_KEYS = ["fydry_token", "fydry_access_token", "fydry_user"];

function clearSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <Image src="/logo_vino.png" alt="FyDry Task Logo" fill sizes={`${size}px`} className="object-contain" priority />
    </div>
  );
}

/** Lee ?tab= y ?close=1 (los usan los enlaces de las notificaciones push). */
function initialFromUrl(): { tab: Tab; close: boolean } {
  if (typeof window === "undefined") return { tab: "today", close: false };
  const p = new URLSearchParams(window.location.search);
  const tab = p.get("tab") as Tab;
  return { tab: TABS.some((t) => t.id === tab) ? tab : "today", close: p.get("close") === "1" };
}

export default function DashboardLayout() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>(() => initialFromUrl().tab);
  const [closeDate, setCloseDate] = useState<string | null>(() => (initialFromUrl().close ? todayISO() : null));
  const [formTarget, setFormTarget] = useState<TaskFormTarget | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ kind: "error" | "info"; msg: string } | null>(null);

  const notify = useCallback((kind: "error" | "info", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast((cur) => (cur?.msg === msg ? null : cur)), 4000);
  }, []);
  const onError = useCallback((m: string) => notify("error", m), [notify]);
  const onInfo = useCallback((m: string) => notify("info", m), [notify]);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);
  const loadCategories = useCallback(() => {
    api.categories().then(setCategories).catch((e) => onError(e.message));
  }, [onError]);

  // Auth guard: carga optimista desde localStorage y revalidación en segundo plano
  useEffect(() => {
    async function verifyAuth() {
      const token = localStorage.getItem("fydry_access_token") || localStorage.getItem("fydry_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const cached = localStorage.getItem("fydry_user");
      if (cached) {
        try {
          setCurrentUser(JSON.parse(cached));
        } catch {}
      }
      setIsLoadingAuth(false);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      try {
        // El backend de Task valida el token con FyDry
        const res = await apiRequest("/me", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.ok && res.data?.id) {
          setCurrentUser(res.data);
          localStorage.setItem("fydry_user", JSON.stringify(res.data));
        } else if (res.status === 401 || res.status === 403) {
          // Solo sesión inválida cierra sesión; un error 5xx no debe expulsar al usuario
          clearSession();
          router.push("/login");
        }
      } catch (err) {
        console.warn("Revalidación de sesión omitida (usando sesión en caché):", err);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    verifyAuth();
  }, [router]);

  useEffect(() => {
    if (isLoadingAuth) return;
    loadCategories();
    registerServiceWorker();
  }, [isLoadingAuth, loadCategories]);

  const goTo = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "today" ? "/dashboard" : `/dashboard?tab=${next}`);
    window.scrollTo({ top: 0 });
  };

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={40} />
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
            <span>{t.home.loading}</span>
          </div>
        </div>
      </div>
    );
  }

  const initial = currentUser?.full_name?.charAt(0).toUpperCase() || "U";
  const shared = { refreshKey, onError };
  const openForm = (target: TaskFormTarget) => setFormTarget(target);

  return (
    <div className="min-h-screen bg-zinc-50/60 antialiased font-sans text-zinc-900">
      {/* Sidebar escritorio */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200/80 bg-white h-dvh p-4 fixed inset-y-0 left-0 z-30 justify-between">
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center gap-3 px-2 py-3 mb-3">
            <BrandMark />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-zinc-950 truncate">{t.brand.name}</span>
              <span className="text-[10px] text-zinc-400 font-medium">{t.brand.tagline}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openForm({ kind: "new", date: todayISO() })}
            className="mb-4 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>

          <nav className="space-y-1 flex-1 overflow-y-auto" aria-label="Secciones">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    active ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100/70"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-zinc-400"}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-3 border-t border-zinc-100">
          <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-[11px] shrink-0">{initial}</div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-900 truncate">{currentUser?.full_name || "Usuario"}</span>
                <span className="text-[10px] text-zinc-400 truncate">{currentUser?.email}</span>
              </div>
            </div>
            <button type="button" onClick={handleLogout} className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0" title={t.nav.logout} aria-label={t.nav.logout}>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Cabecera móvil */}
      <header className="md:hidden bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-bold text-sm text-zinc-950">{t.brand.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goTo("settings")} aria-label="Configuración" className={`p-2.5 rounded-2xl border cursor-pointer ${tab === "settings" ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-600"}`}>
            <Settings className="w-4 h-4" />
          </button>
          <button type="button" onClick={handleLogout} className="p-2.5 rounded-2xl border border-zinc-200 text-zinc-600 hover:text-rose-600 cursor-pointer" aria-label={t.nav.logout}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="md:pl-64">
        <main className="p-4 sm:p-6 lg:p-8 pb-28 md:pb-10 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {tab === "today" && <TodayView categories={categories} openForm={openForm} openClose={setCloseDate} {...shared} />}
              {tab === "week" && <WeekView categories={categories} openForm={openForm} onInfo={onInfo} {...shared} />}
              {tab === "analytics" && <AnalyticsView {...shared} />}
              {tab === "profile" && <ProfileView {...shared} />}
              {tab === "settings" && (
                <SettingsView categories={categories} reloadCategories={() => { loadCategories(); bump(); }} openForm={openForm} onInfo={onInfo} {...shared} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Navegación inferior móvil */}
      <nav aria-label="Navegación inferior" className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 z-30 pb-[env(safe-area-inset-bottom)] px-3 py-1.5">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {TABS.slice(0, 2).map((item) => (
            <MobileTab key={item.id} item={item} active={tab === item.id} onClick={() => goTo(item.id)} />
          ))}
          <button
            type="button"
            onClick={() => openForm({ kind: "new", date: todayISO() })}
            aria-label="Nueva tarea"
            className="w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-md -mt-4 active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
          {TABS.slice(2, 4).map((item) => (
            <MobileTab key={item.id} item={item} active={tab === item.id} onClick={() => goTo(item.id)} />
          ))}
        </div>
      </nav>

      <TaskFormModal target={formTarget} categories={categories} onClose={() => setFormTarget(null)} onSaved={bump} />
      <DayCloseModal date={closeDate} categories={categories} onClose={() => setCloseDate(null)} onSaved={() => { bump(); onInfo("Día cerrado. ¡Buen trabajo!"); }} />

      <AnimatePresence>
        {toast && (
          <motion.div
            role={toast.kind === "error" ? "alert" : "status"}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={`fixed z-[60] bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg text-xs font-medium max-w-[calc(100vw-2rem)] ${
              toast.kind === "error" ? "bg-rose-600 text-white" : "bg-zinc-900 text-white"
            }`}
          >
            {toast.kind === "error" ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileTab({ item, active, onClick }: { item: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl text-[10px] cursor-pointer ${active ? "text-zinc-950 font-semibold" : "text-zinc-400 font-medium"}`}
    >
      <Icon className="w-5 h-5" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}
