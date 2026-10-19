"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Home, LogOut, Loader2, CheckSquare, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { apiRequest } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

type User = { id?: string; full_name?: string; email?: string };

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

export default function DashboardLayout() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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

  const firstName = currentUser?.full_name?.split(" ")[0] || "";
  const initial = currentUser?.full_name?.charAt(0).toUpperCase() || "U";

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

          <nav className="space-y-1 flex-1 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 px-3 pb-1 pt-1 select-none">
              {t.nav.main}
            </div>
            <button
              type="button"
              aria-current="page"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold bg-emerald-700 text-white shadow-xs cursor-pointer"
            >
              <Home className="w-4 h-4 shrink-0 text-white" />
              <span className="truncate">{t.nav.home}</span>
            </button>
          </nav>
        </div>

        <div className="pt-3 border-t border-zinc-100">
          <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                {initial}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-900 truncate">{currentUser?.full_name || "Usuario"}</span>
                <span className="text-[10px] text-zinc-400 truncate">{currentUser?.email}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
              title={t.nav.logout}
              aria-label={t.nav.logout}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Cabecera móvil */}
      <header className="md:hidden bg-white border-b border-zinc-200 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-bold text-sm text-zinc-950">{t.brand.name}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="p-2.5 rounded-2xl border border-zinc-200 text-zinc-600 hover:text-rose-600 cursor-pointer"
          aria-label={t.nav.logout}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Contenido */}
      <div className="md:pl-64">
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
                {t.home.greeting}{firstName ? `, ${firstName}` : ""} 👋
              </h1>
              <p className="mt-1 text-sm text-zinc-500">{t.home.subtitle}</p>
            </div>

            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-10 sm:p-16 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700 mb-4">
                <CheckSquare className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900">{t.home.emptyTitle}</h2>
              <p className="mt-2 text-sm text-zinc-500 max-w-md">{t.home.emptyText}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Próximamente
              </span>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
