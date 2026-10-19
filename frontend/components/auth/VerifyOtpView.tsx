"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  Mail,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { AuthView } from "./types";
import { apiVerifyEmailOtp, apiResendOtp } from "@/lib/auth";

interface VerifyOtpViewProps {
  email: string;
  onSwitchView: (view: AuthView) => void;
  onVerificationSuccess: () => void;
}

export default function VerifyOtpView({
  email,
  onSwitchView,
  onVerificationSuccess,
}: VerifyOtpViewProps) {
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState<number>(45);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setErrorMsg("Ingresa los 6 dígitos del código de verificación.");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await apiVerifyEmailOtp(email, code);
      if (res.data?.access_token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("fydry_access_token", res.data.access_token);
          localStorage.setItem("fydry_token", res.data.access_token);
          if (res.data.user) {
            localStorage.setItem("fydry_user", JSON.stringify(res.data.user));
          }
        }
        setIsSuccess(true);
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1200);
      } else {
        setErrorMsg(res.error || "El código ingresado es incorrecto.");
      }
    } catch {
      setErrorMsg("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setResendTimer(45);
    setOtp(["", "", "", "", "", ""]);
    setErrorMsg("");
    inputRefs.current[0]?.focus();

    try {
      await apiResendOtp(email, "register_verification");
    } catch {
      // Ignore
    }
  };

  return (
    <div>
      {/* Back button */}
      <button
        type="button"
        onClick={() => onSwitchView("login")}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Volver a iniciar sesión</span>
      </button>

      {/* Header */}
      <div className="mb-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 mx-auto mb-3">
          <Mail className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
          Revisa tu correo
        </h2>
        <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mx-auto">
          Hemos enviado un código de 6 dígitos vía Google SMTP a{" "}
          <strong className="text-zinc-900 font-medium">
            {email || "tu correo registrado"}
          </strong>
        </p>
      </div>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-xs text-center"
        >
          {errorMsg}
        </motion.div>
      )}

      {isSuccess && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center justify-center gap-2 font-medium"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>¡Código verificado con éxito! Redirigiendo...</span>
        </motion.div>
      )}

      {/* OTP Code Input Boxes */}
      <form onSubmit={handleVerify} className="space-y-6">
        <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-10 h-12 sm:w-11 sm:h-13 text-center text-lg font-bold rounded-xl border border-zinc-200 bg-white text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 focus:outline-none transition-all shadow-2xs"
            />
          ))}
        </div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isLoading || isSuccess}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <>
              <span>Confirmar y Acceder</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </motion.button>
      </form>

      {/* Resend Section */}
      <div className="mt-6 pt-5 border-t border-zinc-100 text-center text-xs text-zinc-500">
        ¿No recibiste el código?{" "}
        {resendTimer > 0 ? (
          <span className="text-zinc-400 font-medium">
            Reenviar en {resendTimer}s
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="font-semibold text-zinc-950 hover:underline inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reenviar código</span>
          </button>
        )}
      </div>
    </div>
  );
}
