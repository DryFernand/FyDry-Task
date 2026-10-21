"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, BarChart3, BrainCircuit, CalendarDays, CheckCircle2, CheckSquare, GraduationCap, Loader2, LogOut, Menu, Plus, Repeat, Settings, Sun, Trophy, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { api, Category, Challenge, Program, Schedule, Subject, todayISO } from "@/lib/tasks";
import { registerServiceWorker } from "@/lib/push";
import { useLanguage } from "@/context/LanguageContext";
import BrandMark from "@/components/BrandMark";
import TaskFormModal, { TaskFormTarget } from "./TaskFormModal";
import HabitFormModal, { HabitFormTarget } from "./HabitFormModal";
import { ChallengeFormModal, ChallengeFormTarget, ChallengeResultModal } from "./ChallengeModals";
import DayCloseModal from "./DayCloseModal";
import { ScheduleFormModal, ScheduleFormTarget, SubjectDetailModal, SubjectFormModal, SubjectFormTarget } from "./ScheduleModals";
import SettingsModal from "./SettingsModal";
import { Dash, DashContext } from "./DashContext";
import { AddMenu } from "./ItemRows";
import TodayView from "./views/TodayView";
import WeekView from "./views/WeekView";
import TasksView from "./views/TasksView";
import HabitsView from "./views/HabitsView";
import ChallengesView from "./views/ChallengesView";
import ScheduleView from "./views/ScheduleView";
import AnalyticsView from "./views/AnalyticsView";
import ProfileView from "./views/ProfileView";

type User = { id?: string; full_name?: string; email?: string };
type Tab = "today" | "week" | "tasks" | "habits" | "challenges" | "schedule" | "analytics" | "profile";
type NavItem = { id: Tab; label: string; icon: typeof Sun };

// Mismo patrón que FyDry: grupos con título en el menú lateral
const NAV_GROUPS: { id: string; title: string; items: NavItem[] }[] = [
  {
    id: "main",
    title: "PRINCIPAL",
    items: [
      { id: "today", label: "Mi día", icon: Sun },
      { id: "week", label: "Semana", icon: CalendarDays },
    ],
  },
  {
    id: "manage",
    title: "GESTIÓN",
    items: [
      { id: "tasks", label: "Tareas", icon: CheckSquare },
      { id: "habits", label: "Hábitos", icon: Repeat },
      { id: "challenges", label: "Retos", icon: Trophy },
      { id: "schedule", label: "Horario", icon: GraduationCap },
    ],
  },
  {
    id: "insights",
    title: "ANÁLISIS",
    items: [
      { id: "analytics", label: "Análisis", icon: BarChart3 },
      { id: "profile", label: "Perfil IA", icon: BrainCircuit },
    ],
  },
];
const ALL_TABS = NAV_GROUPS.flatMap((g) => g.items);

const SESSION_KEYS = ["fydry_token", "fydry_access_token", "fydry_user"];

function clearSession() {
  SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
}

/** Lee ?tab=, ?close=1 y ?settings=1 (los usan los enlaces de las notificaciones push). */
function fromUrl() {
  if (typeof window === "undefined") return { tab: "today" as Tab, close: false, settings: false };
  const p = new URLSearchParams(window.location.search);
  const tab = p.get("tab") as Tab;
  return {
    tab: ALL_TABS.some((t) => t.id === tab) ? tab : ("today" as Tab),
    close: p.get("close") === "1",
    settings: p.get("tab") === "settings" || p.get("settings") === "1",
  };
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all group cursor-pointer ${
        active ? "bg-emerald-700 text-white shadow-xs" : "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100/70"
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${active ? "text-white" : "text-zinc-400 group-hover:text-zinc-950"}`} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function NavGroups({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  return (
    <>
      {NAV_GROUPS.map((group, i) => (
        <div key={group.id} className="space-y-1">
          <div className={`text-[10px] uppercase tracking-wider font-semibold text-zinc-400 px-3 pb-1 select-none ${i === 0 ? "pt-1" : "pt-2.5"}`}>{group.title}</div>
          <div className="space-y-1">
            {group.items.map((item) => (
              <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => onSelect(item.id)} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function DashboardLayout() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>(() => fromUrl().tab);
  const [closeDate, setCloseDate] = useState<string | null>(() => (fromUrl().close ? todayISO() : null));
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => fromUrl().settings);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hideBottomBar, setHideBottomBar] = useState(false);
  const [formTarget, setFormTarget] = useState<TaskFormTarget | null>(null);
  const [habitTarget, setHabitTarget] = useState<HabitFormTarget | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<ChallengeFormTarget | null>(null);
  const [resultTarget, setResultTarget] = useState<Challenge | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [scheduleTarget, setScheduleTarget] = useState<ScheduleFormTarget | null>(null);
  const [subjectTarget, setSubjectTarget] = useState<SubjectFormTarget | null>(null);
  const [subjectDetail, setSubjectDetail] = useState<Subject | null>(null);
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
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const loadSchedules = useCallback(() => {
    api.schedules().then(setSchedules).catch((e) => onError(e.message));
    api.programs().then(setPrograms).catch((e) => onError(e.message));
  }, [onError]);
  const reloadSchedules = useCallback(() => {
    loadSchedules();
    setRefreshKey((k) => k + 1);
  }, [loadSchedules]);

  // Como en FyDry: en el teléfono la barra inferior se oculta al bajar y aparece al subir
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 8) return;
      setHideBottomBar(window.matchMedia("(max-width: 767px)").matches && y > lastY && y > 80);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // Horarios: al entrar y cada vez que cambian datos (asignaciones, asistencia)
  useEffect(() => {
    if (!isLoadingAuth) loadSchedules();
  }, [isLoadingAuth, loadSchedules, refreshKey]);

  const goTo = (next: Tab) => {
    setTab(next);
    setIsMobileMenuOpen(false);
    window.history.replaceState(null, "", next === "today" ? "/dashboard" : `/dashboard?tab=${next}`);
    window.scrollTo({ top: 0 });
  };

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  const dash: Dash = useMemo(
    () => ({
      categories,
      catOf: (id) => categories.find((c) => c.id === id),
      schedules,
      programs,
      subjectOf: (id) => (id ? schedules.flatMap((s) => s.subjects).find((m) => m.id === id) : undefined),
      reloadSchedules,
      refreshKey,
      bump,
      onError,
      onInfo,
      actions: {
        newTask: (date) => setFormTarget({ kind: "new", date }),
        editTask: (task) => setFormTarget({ kind: "edit", task }),
        newHabit: (mode, date) => setHabitTarget({ kind: "new", mode, date }),
        editHabit: (habit) => setHabitTarget({ kind: "edit", habit }),
        newChallenge: (date) => setChallengeTarget({ kind: "new", date }),
        editChallenge: (challenge) => setChallengeTarget({ kind: "edit", challenge }),
        reportChallenge: (c) => setResultTarget(c),
        openClose: (date) => setCloseDate(date),
        create: (kind, date) =>
          kind === "task" ? setFormTarget({ kind: "new", date }) : kind === "habit" ? setHabitTarget({ kind: "new", mode: "building", date }) : setChallengeTarget({ kind: "new", date }),
        newSchedule: (programId) => setScheduleTarget({ kind: "new", programId }),
        editSchedule: (schedule) => setScheduleTarget({ kind: "edit", schedule }),
        duplicateSchedule: (schedule) => setScheduleTarget({ kind: "duplicate", schedule }),
        newSubject: (scheduleId) => setSubjectTarget({ kind: "new", scheduleId }),
        editSubject: (subject) => setSubjectTarget({ kind: "edit", subject }),
        openSubject: (subject) => setSubjectDetail(subject),
      },
    }),
    [categories, schedules, programs, reloadSchedules, refreshKey, bump, onError, onInfo]
  );

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

  return (
    <DashContext.Provider value={dash}>
    <div className="min-h-screen bg-zinc-50/60 antialiased font-sans text-zinc-900">
      {/* Menú lateral de escritorio (fijo, como FyDry) */}
      <aside className="hidden md:flex flex-col w-64 min-w-[256px] max-w-[256px] border-r border-zinc-200/80 bg-white h-dvh p-4 fixed inset-y-0 left-0 z-30 justify-between overflow-hidden">
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center gap-3 px-2 py-3 mb-3">
            <BrandMark />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-zinc-950 truncate">{t.brand.name}</span>
              <span className="text-[10px] text-zinc-400 font-medium">{t.brand.tagline}</span>
            </div>
          </div>
          <nav className="space-y-3 flex-1 overflow-y-auto pr-1" aria-label="Secciones">
            <NavGroups tab={tab} onSelect={goTo} />
          </nav>
        </div>

        <div className="pt-3 border-t border-zinc-100 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-semibold text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100/70 transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 shrink-0 text-zinc-400" />
            <span className="truncate">Configuración</span>
          </button>
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

      {/* Cabecera móvil: configuración + menú, como FyDry */}
      <header className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-bold text-sm text-zinc-950">{t.brand.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsSettingsOpen(true)} aria-label="Configuración" className="p-2.5 rounded-2xl border border-zinc-200 text-zinc-600 cursor-pointer">
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
            className="p-2.5 rounded-2xl bg-emerald-700 text-white cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden fixed inset-x-0 top-[73px] z-40 bg-white border-b border-zinc-200 p-4 shadow-xl max-h-[calc(100dvh-73px)] overflow-y-auto space-y-3"
          >
            <nav className="space-y-3" aria-label="Secciones">
              <NavGroups tab={tab} onSelect={goTo} />
            </nav>
            <div className="pt-2 border-t border-zinc-100">
              <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer">
                <LogOut className="w-4 h-4" /> {t.nav.logout}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0 flex flex-col md:pl-64">
        {/* Barra superior de escritorio: aquí va "Nueva tarea", como "Registrar" en FyDry */}
        <div className="hidden md:flex items-center justify-end px-6 lg:px-8 pt-6 pb-2">
          <NewButton onPick={(k) => dash.actions.create(k, todayISO())} />
        </div>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 md:pt-2 lg:pt-2 pb-28 md:pb-10 w-full max-w-[1600px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {tab === "today" && <TodayView />}
              {tab === "week" && <WeekView />}
              {tab === "tasks" && <TasksView />}
              {tab === "habits" && <HabitsView />}
              {tab === "challenges" && <ChallengesView />}
              {tab === "schedule" && <ScheduleView />}
              {tab === "analytics" && <AnalyticsView {...shared} />}
              {tab === "profile" && <ProfileView {...shared} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Barra inferior móvil con botón central de nueva tarea */}
      <nav
        aria-label="Navegación inferior"
        className={`md:hidden fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-zinc-200/80 z-30 pb-[env(safe-area-inset-bottom)] px-3 py-1.5 transition-transform duration-300 ${hideBottomBar ? "translate-y-full" : "translate-y-0"}`}
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {MOBILE_TABS.slice(0, 2).map((item) => (
            <MobileTab key={item.id} item={item} active={tab === item.id} onClick={() => goTo(item.id)} />
          ))}
          <MobileNew onPick={(k) => dash.actions.create(k, todayISO())} />
          {MOBILE_TABS.slice(2, 4).map((item) => (
            <MobileTab key={item.id} item={item} active={tab === item.id} onClick={() => goTo(item.id)} />
          ))}
        </div>
      </nav>

      <TaskFormModal
        target={formTarget}
        categories={categories}
        schedules={schedules}
        onClose={() => setFormTarget(null)}
        onSaved={bump}
        onSwitchToHabit={(date) => { setFormTarget(null); setHabitTarget({ kind: "new", mode: "established", date }); }}
      />
      <HabitFormModal target={habitTarget} categories={categories} onClose={() => setHabitTarget(null)} onSaved={bump} />
      <ChallengeFormModal target={challengeTarget} categories={categories} onClose={() => setChallengeTarget(null)} onSaved={bump} />
      <ScheduleFormModal target={scheduleTarget} onClose={() => setScheduleTarget(null)} onSaved={reloadSchedules} />
      <SubjectFormModal target={subjectTarget} onClose={() => setSubjectTarget(null)} onSaved={reloadSchedules} />
      <SubjectDetailModal subject={subjectDetail} onClose={() => setSubjectDetail(null)} />
      <ChallengeResultModal challenge={resultTarget} onClose={() => setResultTarget(null)} onSaved={() => { bump(); onInfo("Resultado guardado."); }} />
      <DayCloseModal date={closeDate} categories={categories} onClose={() => setCloseDate(null)} onSaved={() => { bump(); onInfo("Día cerrado. ¡Buen trabajo!"); }} />
      <SettingsModal
        open={isSettingsOpen}
        onClose={closeSettings}
        user={currentUser}
        onLogout={handleLogout}
        categories={categories}
        reloadCategories={() => { loadCategories(); bump(); }}
        onInfo={onInfo}
        {...shared}
      />

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
    </DashContext.Provider>
  );
}

const MOBILE_TABS = ["today", "week", "habits", "challenges"].map((id) => ALL_TABS.find((t) => t.id === id)!);

/** "+ Nueva" de la barra superior: elige tarea, hábito o reto. */
function NewButton({ onPick }: { onPick: (k: "task" | "habit" | "challenge") => void }) {
  return (
    <div className="w-36">
      <AddMenu label="Nueva" onPick={onPick} below
        className="[&>button]:border [&>button]:border-zinc-200/90 [&>button]:bg-white [&>button]:text-zinc-800 [&>button]:text-xs [&>button]:py-2 [&>button]:rounded-2xl [&>button]:shadow-2xs" />
    </div>
  );
}

/** Botón central de la barra móvil: también deja elegir el tipo. */
function MobileNew({ onPick }: { onPick: (k: "task" | "habit" | "challenge") => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative -mt-4 shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Nueva"
        aria-expanded={open}
        className="w-11 h-11 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform hover:bg-emerald-800 cursor-pointer"
      >
        {open ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>
      {open && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-40 p-1 rounded-2xl bg-white border border-zinc-200 shadow-xl text-xs">
          {([["task", "Tarea", CheckSquare, "text-zinc-500"], ["habit", "Hábito", Repeat, "text-emerald-700"], ["challenge", "Reto", Trophy, "text-amber-600"]] as const).map(([k, label, Icon, cls]) => (
            <button key={k} type="button" onClick={() => { setOpen(false); onPick(k); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-zinc-100 cursor-pointer">
              <Icon className={`w-4 h-4 ${cls}`} /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileTab({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-colors cursor-pointer text-[10px] ${active ? "text-zinc-950 font-semibold" : "text-zinc-400 hover:text-zinc-600 font-medium"}`}
    >
      <Icon className={`w-5 h-5 ${active ? "text-zinc-950" : "text-zinc-400"}`} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}
