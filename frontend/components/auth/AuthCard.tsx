"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import VerifyOtpView from "./VerifyOtpView";
import ForgotPasswordForm from "./ForgotPasswordForm";
import LockedAccountNotice from "./LockedAccountNotice";
import { AuthView } from "./types";
import { ShieldCheck } from "lucide-react";

interface AuthCardProps {
  initialView?: AuthView;
}

export default function AuthCard({ initialView = "login" }: AuthCardProps) {
  const router = useRouter();
  const [view, setView] = useState<AuthView>(initialView);
  const [direction, setDirection] = useState<number>(1);
  const [email, setEmail] = useState<string>("");
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const MAX_ATTEMPTS = 5;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("fydry_token");
      if (token) {
        router.push("/dashboard");
      }
    }
  }, [router]);

  const handleSwitchView = (newView: AuthView) => {
    if (newView === "login") {
      setDirection(-1);
    } else {
      setDirection(1);
    }
    setView(newView);
  };

  const handleFailedAttempt = () => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    if (nextAttempts >= MAX_ATTEMPTS) {
      setView("locked");
    }
  };

  const handleUnlock = () => {
    setFailedAttempts(0);
    setView("login");
  };

  const handleLoginSuccess = () => {
    router.push("/dashboard");
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 30 : -30,
      opacity: 0,
      filter: "blur(4px)",
    }),
    center: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.3,
        ease: "easeOut" as const,
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -30 : 30,
      opacity: 0,
      filter: "blur(4px)",
      transition: {
        duration: 0.2,
        ease: "easeIn" as const,
      },
    }),
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-zinc-50/70 via-white to-zinc-50/40 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-6 text-center z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="relative w-10 h-10 transition-transform duration-200 group-hover:scale-105 shrink-0 flex items-center justify-center">
            <Image
              src="/logo_task.svg"
              alt="FyDry Task Logo"
              fill
              sizes="40px"
              className="object-contain"
              priority
            />
          </div>
          <span className="font-bold text-xl tracking-tight text-zinc-950">
            FyDry <span className="text-emerald-700">Task</span>
          </span>
        </Link>
      </div>

      {/* Auth Card Container */}
      <motion.div
        layout
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] ring-1 ring-zinc-950/5 p-6 sm:p-8 relative z-10 overflow-hidden"
      >
        {/* Toggle pill between Login and Register if on primary views */}
        {(view === "login" || view === "register") && (
          <div className="flex p-1 rounded-xl bg-zinc-100/90 border border-zinc-200/80 mb-6">
            <button
              type="button"
              onClick={() => handleSwitchView("login")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                view === "login"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => handleSwitchView("register")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                view === "register"
                  ? "bg-white text-zinc-950 shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Crear Cuenta
            </button>
          </div>
        )}

        {/* Animated Views */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={view}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {view === "login" && (
              <LoginForm
                onSwitchView={handleSwitchView}
                onSetEmail={setEmail}
                failedAttempts={failedAttempts}
                maxAttempts={MAX_ATTEMPTS}
                onFailedAttempt={handleFailedAttempt}
                onSuccessfulLogin={handleLoginSuccess}
              />
            )}

            {view === "register" && (
              <RegisterForm
                onSwitchView={handleSwitchView}
                onSetEmail={setEmail}
              />
            )}

            {view === "verify-otp" && (
              <VerifyOtpView
                email={email}
                onSwitchView={handleSwitchView}
                onVerificationSuccess={handleLoginSuccess}
              />
            )}

            {view === "forgot-password" && (
              <ForgotPasswordForm
                initialEmail={email}
                onSwitchView={handleSwitchView}
              />
            )}

            {view === "locked" && (
              <LockedAccountNotice
                lockoutSeconds={60}
                onSwitchView={handleSwitchView}
                onUnlock={handleUnlock}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Footer reassurance */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-6 flex items-center justify-center gap-4 text-[11px] text-zinc-400 z-10"
      >
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Conexión cifrada (HTTPS)</span>
        </span>
        <span>•</span>
        <span>FyDry Task 1.0</span>
      </motion.div>
    </div>
  );
}
