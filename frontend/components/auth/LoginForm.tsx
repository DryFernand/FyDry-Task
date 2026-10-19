"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { AuthView } from "./types";
import { apiLogin } from "@/lib/auth";
import { redirectToGoogleOAuth, redirectToGitHubOAuth } from "@/lib/oauth";

interface LoginFormProps {
  onSwitchView: (view: AuthView) => void;
  onSetEmail: (email: string) => void;
  failedAttempts: number;
  maxAttempts: number;
  onFailedAttempt: () => void;
  onSuccessfulLogin: () => void;
}

export default function LoginForm({
  onSwitchView,
  onSetEmail,
  failedAttempts,
  maxAttempts,
  onFailedAttempt,
  onSuccessfulLogin,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Por favor completa todos los campos.");
      return;
    }

    setIsLoading(true);
    onSetEmail(email);

    try {
      const res = await apiLogin(email, password);

      if (res.data?.access_token) {
        if (typeof window !== "undefined") {
          localStorage.setItem("fydry_access_token", res.data.access_token);
          localStorage.setItem("fydry_token", res.data.access_token);
          if (res.data.user) {
            localStorage.setItem("fydry_user", JSON.stringify(res.data.user));
          }
        }

        onSuccessfulLogin();
      } else if (res.status === 423) {
        // Cuenta bloqueada
        onSwitchView("locked");
      } else if (res.status === 403) {
        // Correo sin verificar: el backend reenvió el código OTP
        onSwitchView("verify-otp");
      } else {
        onFailedAttempt();
        setErrorMsg(res.error || "Credenciales incorrectas.");
      }
    } catch {
      setErrorMsg("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    redirectToGoogleOAuth();
  };

  const handleGitHubLogin = () => {
    setIsLoading(true);
    redirectToGitHubOAuth();
  };

  const remaining = maxAttempts - failedAttempts;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
          Bienvenido de nuevo
        </h2>
        <p className="text-xs text-zinc-500 mt-1.5">
          Usa tu cuenta FyDry para continuar organizando tus tareas.
        </p>
      </div>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-xs"
        >
          {errorMsg}
        </motion.div>
      )}

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
            />
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
            />
            <path
              fill="#FBBC05"
              d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
            />
          </svg>
          <span>Google</span>
        </button>

        <button
          type="button"
          onClick={handleGitHubLogin}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
        >
          <svg className="w-4 h-4 fill-zinc-900" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>GitHub</span>
        </button>
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center mb-5">
        <div className="border-t border-zinc-200 w-full" />
        <span className="bg-white px-3 text-[11px] text-zinc-400 uppercase tracking-wider">
          o con tu correo
        </span>
      </div>

      {/* Main Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
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

        {/* Password Input */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-zinc-800">
              Contraseña
            </label>
            <button
              type="button"
              onClick={() => {
                onSetEmail(email);
                onSwitchView("forgot-password");
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-950 transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors shadow-2xs"
            />
            <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember me Checkbox */}
        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 text-zinc-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span>Recordar este dispositivo por 30 días</span>
          </label>
        </div>

        {/* Submit Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <>
              <span>Iniciar Sesión</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </motion.button>
      </form>
    </div>
  );
}
