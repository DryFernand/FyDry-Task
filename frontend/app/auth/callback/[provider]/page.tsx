"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { apiGoogleAuth, apiGitHubAuth } from "@/lib/auth";

interface CallbackProps {
  params: Promise<{
    provider: string;
  }>;
}

export default function AuthCallbackPage({ params }: CallbackProps) {
  const { provider } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMsg(`Autenticación cancelada: ${error}`);
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMsg("No se recibió ningún código de autorización del proveedor.");
      return;
    }

    async function completeOAuth() {
      try {
        let res;
        const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
        const currentRedirectUri = `${currentOrigin}/auth/callback/${provider}`;

        if (provider === "google") {
          res = await apiGoogleAuth(code as string, currentRedirectUri);
        } else if (provider === "github") {
          res = await apiGitHubAuth(code as string);
        } else {
          setStatus("error");
          setErrorMsg("Proveedor no soportado.");
          return;
        }

        if (res.data?.access_token) {
          if (typeof window !== "undefined") {
            localStorage.setItem("fydry_access_token", res.data.access_token);
            localStorage.setItem("fydry_token", res.data.access_token);
            if (res.data.user) {
              localStorage.setItem("fydry_user", JSON.stringify(res.data.user));
            }
          }
          setStatus("success");
          setTimeout(() => router.push("/dashboard"), 1000);
        } else {
          setStatus("error");
          setErrorMsg(res.error || "No se pudo completar el inicio de sesión.");
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err?.message || "Error al conectar con el servidor.");
      }
    }

    completeOAuth();
  }, [provider, searchParams, router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white rounded-3xl border border-zinc-200/80 p-8 shadow-sm text-center"
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
            FD
          </div>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-900 mx-auto" />
            <h2 className="text-lg font-bold text-zinc-950">
              Autenticando con {provider === "google" ? "Google" : "GitHub"}...
            </h2>
            <p className="text-xs text-zinc-500">
              Estamos validando tus credenciales de forma segura.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-zinc-950">¡Acceso concedido!</h2>
            <p className="text-xs text-zinc-500">
              Redirigiendo a tu panel de FyDry Task...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-zinc-950">Error de Autenticación</h2>
            <p className="text-xs text-red-600">{errorMsg}</p>
            <div className="pt-3">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
              >
                Volver al Login
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
