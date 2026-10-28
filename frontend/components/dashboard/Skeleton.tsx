"use client";

import { CSSProperties, ReactNode } from "react";

/** Bloque gris con pulso suave; quieto si el sistema pide menos movimiento. */
export function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" style={style} className={`block ${className.includes("rounded") ? "" : "rounded-lg"} bg-zinc-200/70 animate-pulse motion-reduce:animate-none ${className}`} />;
}

/** Envuelve un esqueleto: avisa a lectores de pantalla que el contenido está cargando. */
export function Loading({ label = "Cargando…", className = "", children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Fila tipo TaskRow / HabitRow / ChallengeRow: punto de color, título y detalle. */
export function RowBone({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-zinc-200/80 bg-white ${compact ? "p-2.5" : "p-3 sm:p-3.5"}`}>
      <div className={`flex items-start ${compact ? "gap-1.5" : "gap-2.5"}`}>
        <Bone className="mt-1 w-2 h-2 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 py-0.5">
          <Bone className="h-3.5 w-3/4" />
          <Bone className="h-2.5 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function RowBones({ count = 3, compact = false }: { count?: number; compact?: boolean }) {
  return <>{Array.from({ length: count }, (_, i) => <RowBone key={i} compact={compact} />)}</>;
}

/** Tarjeta de estadística (etiqueta, número grande y nota). */
export function StatBone() {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 space-y-2">
      <Bone className="h-3 w-16" />
      <Bone className="h-7 w-20" />
      <Bone className="h-2.5 w-28" />
    </div>
  );
}

/** Tarjeta con título y unas líneas o barras dentro. */
export function CardBone({ lines = 4, bars = false, className = "" }: { lines?: number; bars?: boolean; className?: string }) {
  return (
    <div className={`p-4 sm:p-5 rounded-3xl bg-white border border-zinc-200/80 ${className}`}>
      <Bone className="h-3.5 w-32 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) =>
          bars ? (
            <div key={i} className="grid grid-cols-[minmax(0,7.5rem)_1fr_3rem] sm:grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3">
              <Bone className="h-3 w-20" />
              <Bone className="h-2.5 rounded-full" />
              <Bone className="h-3 w-8 ml-auto" />
            </div>
          ) : (
            <Bone key={i} className={`h-3 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
          )
        )}
      </div>
    </div>
  );
}
