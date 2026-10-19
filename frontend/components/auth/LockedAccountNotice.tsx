"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ShieldAlert, Clock, KeyRound, RotateCcw, ArrowRight } from "lucide-react";
import { AuthView } from "./types";

interface LockedAccountNoticeProps {
  lockoutSeconds?: number;
  onSwitchView: (view: AuthView) => void;
  onUnlock: () => void;
}

export default function LockedAccountNotice({
  lockoutSeconds = 60,
  onSwitchView,
  onUnlock,
}: LockedAccountNoticeProps) {
  const [timeLeft, setTimeLeft] = useState<number>(lockoutSeconds);

  useEffect(() => {
    setTimeLeft(lockoutSeconds);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onUnlock();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onUnlock]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const formattedTime =
    hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="text-center py-2 space-y-6">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mx-auto shadow-xs">
        <ShieldAlert className="w-7 h-7" />
      </div>

      {/* Headline & Description */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
          Acceso bloqueado por seguridad
        </h2>
        <p className="text-xs text-zinc-600 mt-2 max-w-xs mx-auto leading-relaxed">
          Has superado el límite de intentos permitidos. Tu cuenta ha sido congelada temporalmente para proteger tu información.
        </p>
      </div>

      {/* Timer Display Box */}
      <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col items-center justify-center">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
          <Clock className="w-4 h-4 text-zinc-400" />
          <span>Podrás reintentar en:</span>
        </div>
        <div className="text-3xl font-mono font-bold text-zinc-900 tracking-wider">
          {formattedTime}
        </div>
        <div className="w-full bg-zinc-200 rounded-full h-1.5 mt-3 max-w-[220px] overflow-hidden">
          <motion.div
            className="bg-amber-500 h-1.5 rounded-full"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: lockoutSeconds, ease: "linear" }}
          />
        </div>
      </div>

      {/* Alternative actions */}
      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          onClick={() => onSwitchView("forgot-password")}
          className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>¿Olvidaste tu contraseña? Restablécela</span>
        </button>

        {timeLeft <= 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            type="button"
            onClick={onUnlock}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reintentar ahora</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
