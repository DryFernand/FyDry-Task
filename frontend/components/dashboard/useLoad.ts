"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Carga async con recarga manual y por `refreshKey` (cambia tras guardar en un modal).
 * `loading` es true hasta que llegan los datos de los `deps` actuales (p. ej. otra semana);
 * las recargas por `refreshKey` o `reload` conservan los datos mientras llegan los nuevos.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], refreshKey: number, onError: (m: string) => void) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string; data: T | null } | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fn()
      .then((d) => alive && setState({ key, data: d }))
      .catch((e) => {
        if (!alive) return;
        onError(e instanceof Error ? e.message : "No se pudo cargar.");
        setState((s) => ({ key, data: s?.key === key ? s.data : null }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey, version]);

  const fresh = state?.key === key;
  return { data: fresh ? state.data : null, loading: !fresh, reload };
}
