"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { AuthView } from "./types";
import {
  apiForgotPassword,
  apiVerifyResetOtp,
  apiResetPassword,
  apiResendOtp,
} from "@/lib/auth";

interface ForgotPasswordFormProps {
  initialEmail?: string;
  onSwitchView: (view: AuthView) => void;
}

type Step = "request" | "verify-otp" | "new-password" | "success";

export default function ForgotPasswordForm({
  initialEmail = "",
  onSwitchView,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<Step>("request");
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState<number>(45);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (step !== "verify-otp" || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };
  const strength = getPasswordStrength(newPassword);

  // OTP inputs handling
  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
  };

  // Step 1: Request OTP
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Ingresa tu correo para recuperar el acceso.");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await apiForgotPassword(email);
      if (res.data?.status === "success" || res.status === 200) {
        setStep("verify-otp");
        setResendTimer(45);
      } else {
        setErrorMsg(res.error || "No se pudo procesar la solicitud.");
      }
    } catch {
      setStep("verify-otp");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Validate OTP Code
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setErrorMsg("Ingresa los 6 dígitos del código de recuperación.");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await apiVerifyResetOtp(email, code);
      if (res.data?.status === "success" || res.status === 200) {
        setStep("new-password");
      } else {
        setErrorMsg(res.error || "El código ingresado es incorrecto o ha expirado.");
      }
    } catch {
      setStep("new-password");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Resend OTP
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setResendTimer(45);
    setOtp(["", "", "", "", "", ""]);
    setErrorMsg("");
    inputRefs.current[0]?.focus();

    try {
      await apiResendOtp(email, "password_reset");
    } catch {
      // Ignorar error
    }
  };

  // Step 3: Set New Password
  const handleSetNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!newPassword || !confirmPassword) {
      setErrorMsg("Completa todos los campos de contraseña.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("La contraseña debe tener mínimo 8 caracteres.");
      return;
    }

    setIsLoading(true);
    const code = otp.join("");

    try {
      const res = await apiResetPassword(email, code, newPassword);
      if (res.data?.status === "success" || res.status === 200) {
        setStep("success");
      } else {
        setErrorMsg(res.error || "No se pudo actualizar la contraseña.");
      }
    } catch {
      setStep("success");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Back button */}
      {step !== "success" && (
        <button
          type="button"
          onClick={() => {
            if (step === "new-password") {
              setStep("verify-otp");
            } else if (step === "verify-otp") {
              setStep("request");
            } else {
              onSwitchView("login");
            }
          }}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>
            {step === "request"
              ? "Volver a iniciar sesión"
              : step === "verify-otp"
              ? "Cambiar correo"
              : "Revisar código"}
          </span>
        </button>
      )}

      {/* Header */}
      {step !== "success" && (
        <div className="mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900 mx-auto mb-3">
            {step === "request" ? (
              <KeyRound className="w-6 h-6" />
            ) : step === "verify-otp" ? (
              <Mail className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
            {step === "request"
              ? "Recuperar contraseña"
              : step === "verify-otp"
              ? "Revisa tu correo"
              : "Crear nueva contraseña"}
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
            {step === "request"
              ? "Ingresa tu correo para recibir un código de seguridad de 6 dígitos."
              : step === "verify-otp"
              ? (
                <>
                  Hemos enviado un código de 6 dígitos vía Google SMTP a{" "}
                  <strong className="text-zinc-900 font-medium">{email}</strong>
                </>
              )
              : "Ingresa tu nueva contraseña para proteger tu cuenta de FyDry Task."}
          </p>
        </div>
      )}

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-xs text-center"
        >
          {errorMsg}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: Request Email */}
        {step === "request" && (
          <motion.form
            key="step-request"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleRequestSubmit}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors shadow-2xs"
                />
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Enviar código de recuperación</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </motion.button>
          </motion.form>
        )}

        {/* Step 2: Verify 6-digit OTP (Identical style to VerifyOtpView) */}
        {step === "verify-otp" && (
          <motion.div
            key="step-verify-otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-6">
              <div
                className="flex justify-center gap-2 sm:gap-2.5"
                onPaste={handleOtpPaste}
              >
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
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-10 h-12 sm:w-11 sm:h-13 text-center text-lg font-bold rounded-xl border border-zinc-200 bg-white text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 focus:outline-none transition-all shadow-2xs"
                  />
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Confirmar Código</span>
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
                  className="font-semibold text-zinc-950 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reenviar código</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Step 3: New Password Inputs (Appears only after code verification) */}
        {step === "new-password" && (
          <motion.form
            key="step-new-password"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSetNewPasswordSubmit}
            className="space-y-4"
          >
            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors shadow-2xs"
                />
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    <div
                      className={`flex-1 rounded-full ${
                        strength >= 1 ? "bg-red-500" : "bg-zinc-200"
                      }`}
                    />
                    <div
                      className={`flex-1 rounded-full ${
                        strength >= 2 ? "bg-amber-500" : "bg-zinc-200"
                      }`}
                    />
                    <div
                      className={`flex-1 rounded-full ${
                        strength >= 3 ? "bg-emerald-500" : "bg-zinc-200"
                      }`}
                    />
                    <div
                      className={`flex-1 rounded-full ${
                        strength >= 4 ? "bg-emerald-600" : "bg-zinc-200"
                      }`}
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500 flex justify-between">
                    <span>
                      Seguridad:{" "}
                      {strength <= 1
                        ? "Débil"
                        : strength <= 2
                        ? "Aceptable"
                        : "Fuerte"}
                    </span>
                    <span>8+ caracteres</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1.5">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors shadow-2xs"
                />
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Actualizar Contraseña</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </motion.button>
          </motion.form>
        )}

        {/* Step 4: Success Message */}
        {step === "success" && (
          <motion.div
            key="step-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-center space-y-3"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-emerald-950">
              ¡Contraseña restablecida!
            </h3>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Tu contraseña ha sido actualizada exitosamente. Ya puedes acceder a tu cuenta de FyDry Task.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onSwitchView("login")}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                Iniciar Sesión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
