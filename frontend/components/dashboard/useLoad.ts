"use client";

import { useCallback, useEffect, useState } from "react";

/** Carga async con recarga manual y por `refreshKey` (cambia tras guardar en un modal). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], refreshKey: number, onError: (m: string) => void) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && onError(e instanceof Error ? e.message : "No se pudo cargar."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey, version]);

  return { data, loading, reload };
}
