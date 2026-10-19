"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { animate, motion, MotionConfig, useInView, useMotionValue, useSpring, useTransform } from "motion/react";

/** Respeta "reducir movimiento" del sistema en toda la landing. */
export function LandingMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Número que cuenta hasta `value` cuando entra en pantalla. */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.4,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setDisplay });
    return () => controls.stop();
  }, [inView, value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Marco de teléfono para los mockups de pantallas de la app. */
export function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative w-[260px] sm:w-[280px] aspect-[9/19] rounded-[2.6rem] bg-emerald-700 p-[10px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] ring-1 ring-zinc-800 ${className}`}
    >
      <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-emerald-700 z-20" aria-hidden="true" />
      <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-zinc-50">{children}</div>
    </div>
  );
}

/** Tarjeta que se inclina siguiendo el cursor (solo con puntero fino). */
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 200, damping: 20 });

  return (
    <motion.div
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Borde con brillo que sigue el cursor (efecto "spotlight"). */
export function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
        el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
      }}
      className={`spotlight-card ${className}`}
    >
      {children}
    </div>
  );
}
