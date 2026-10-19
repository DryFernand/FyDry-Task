/** API de FyDry Task (tareas). */
export const getApiBase = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

/** API de FyDry: las cuentas (login, registro, OTP, OAuth) son compartidas con FyDry. */
export const getAuthApiBase = () =>
  process.env.NEXT_PUBLIC_AUTH_API_URL || "http://localhost:8000/api/v1";

/** Convierte el error del backend (FastAPI) en un mensaje legible. */
export function apiErrorMessage(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1]) : "";
    return `Dato inválido${field ? ` en "${field}"` : ""}: ${first.msg || "revisa el formulario"}.`;
  }
  if (status === 401) return "Tu sesión expiró. Inicia sesión de nuevo.";
  return "No se pudo completar la solicitud. Intenta de nuevo.";
}

export async function apiRequest(endpoint: string, options: RequestInit = {}, base: string = getApiBase()) {
  const url = `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  return {
    ok: res.ok,
    status: res.status,
    data: res.ok ? data : null,
    error: !res.ok ? apiErrorMessage(data, res.status) : null,
  };
}
