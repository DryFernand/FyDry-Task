"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CalendarClock,
  FolderKanban,
  Flag,
  Sun,
  BellRing,
  Zap,
} from "lucide-react";
import { PhoneFrame, TiltCard, CountUp } from "./landing/primitives";

const ROTATING = ["tranquiliza tu mente.", "enfócate en lo importante.", "termina lo que empiezas.", "recupera tu tiempo."];

const TODAY = [
  { title: "Revisar correo del cliente", tag: "Trabajo", done: true },
  { title: "Pagar la luz", tag: "Casa", done: true },
  { title: "Preparar presentación", tag: "Trabajo", done: false, priority: true },
  { title: "Comprar regalo de mamá", tag: "Personal", done: false },
  { title: "Estudiar 30 min de inglés", tag: "Estudios", done: false },
];

/** Pantalla "Mi día" del teléfono en el hero. */
function TodayScreen() {
  return (
    <div className="h-full flex flex-col pt-10 px-4 pb-4 text-left">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
        <Sun className="w-3.5 h-3.5" aria-hidden="true" /> Mi día
      </div>
      <div className="mt-1 text-lg font-bold text-zinc-950 leading-tight">Lunes, 19 oct</div>
      <div className="mt-3 p-3 rounded-2xl bg-emerald-700 text-white">
        <div className="text-[10px] text-emerald-100">Progreso de hoy</div>
        <div className="text-xl font-bold">2 de 5</div>
        <div className="mt-2 h-1.5 rounded-full bg-white/25 overflow-hidden">
          <motion.div className="h-full bg-white rounded-full" initial={{ width: 0 }} animate={{ width: "40%" }} transition={{ duration: 1.2, delay: 1 }} />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {TODAY.map((t, i) => (
          <motion.div
            key={t.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1 + i * 0.1 }}
            className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-zinc-200/80"
          >
            {t.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-px" aria-hidden="true" />
            ) : (
              <Circle className="w-4 h-4 text-zinc-300 shrink-0 mt-px" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className={`text-[11px] font-medium truncate ${t.done ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{t.title}</div>
              <div className="text-[9px] text-zinc-400">{t.tag}</div>
            </div>
            {t.priority && <Flag className="w-3 h-3 text-rose-500 shrink-0" aria-hidden="true" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const ease = [0.16, 1, 0.3, 1] as const;

function FloatingCard({
  className,
  delay,
  float,
  children,
}: {
  className: string;
  delay: number;
  float: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1, y: [0, float, 0] }}
      transition={{
        opacity: { duration: 0.6, delay },
        scale: { duration: 0.6, delay, ease },
        y: { repeat: Infinity, duration: 5 + delay * 2, ease: "easeInOut" },
      }}
      className={`absolute z-20 flex items-center gap-3 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-zinc-200 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.12)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

export default function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const mockupY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useEffect(() => {
    const id = setInterval(() => setWordIndex((i) => (i + 1) % ROTATING.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative pt-14 pb-20 md:pt-20 md:pb-28 overflow-hidden border-b border-zinc-200/60 bg-gradient-to-b from-zinc-50 via-white to-white"
    >
      {/* Fondo: cuadrícula + manchas de luz en movimiento */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 pointer-events-none [mask-image:radial-gradient(ellipse_at_top,#000_40%,transparent_75%)]" />
      <motion.div style={{ opacity: glowOpacity }} className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="blob absolute -top-32 left-[10%] w-[30rem] h-[30rem] rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="blob absolute top-40 right-[5%] w-[26rem] h-[26rem] rounded-full bg-sky-100/70 blur-3xl [animation-delay:-6s]" />
        <div className="blob absolute top-[28rem] left-[35%] w-[22rem] h-[22rem] rounded-full bg-zinc-200/60 blur-3xl [animation-delay:-12s]" />
      </motion.div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <motion.a
            href="#caracteristicas"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="group inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white border border-zinc-200 shadow-xs text-xs font-medium text-zinc-700 hover:border-zinc-300 transition-colors"
          >
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">Nuevo</span>
            <span>De la familia FyDry: ahora para tus tareas</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="mt-6 w-full text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-950 leading-[1.1]"
          >
            Organiza tus tareas,
            <span className="sr-only"> {ROTATING[0]}</span>
            <span className="relative block h-[1.2em] overflow-hidden" aria-hidden="true">
              <AnimatePresence mode="wait">
                <motion.span
                  key={wordIndex}
                  initial={{ y: "100%", opacity: 0, filter: "blur(6px)" }}
                  animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: "-100%", opacity: 0, filter: "blur(6px)" }}
                  transition={{ duration: 0.5, ease }}
                  className="absolute inset-x-0"
                >
                  <span className="shimmer-text inline-block whitespace-nowrap bg-linear-to-r from-zinc-900 via-emerald-500 to-zinc-900 bg-clip-text text-transparent">{ROTATING[wordIndex]}</span>
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
            className="mt-6 text-lg sm:text-xl text-zinc-600 max-w-2xl leading-relaxed"
          >
            Captura pendientes en segundos, organízalos por proyecto y prioridad, y decide cada mañana qué harás hoy. Sin listas infinitas ni herramientas complicadas.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease }}
            className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
          >
            <motion.a
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              href="/register"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-700 text-white font-semibold text-sm shadow-[0_8px_24px_-6px_rgba(16,185,129,0.45)] overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" aria-hidden="true" />
              <span>Comenzar gratis hoy</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="#caracteristicas"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/80 backdrop-blur hover:bg-white text-zinc-800 font-medium text-sm border border-zinc-200 shadow-sm transition-colors"
            >
              Ver cómo funciona
            </motion.a>
          </motion.div>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500"
          >
            {["Gratis, sin tarjeta", "Web y móvil", "Sin publicidad"].map((t) => (
              <motion.li
                key={t}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                className="flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>{t}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* Composición de producto: panel de escritorio + teléfono */}
        <div className="relative mt-14 sm:mt-20 lg:min-h-[660px]">
          <FloatingCard className="hidden lg:flex -top-6 -left-6" delay={0.6} float={-12}>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shrink-0">
              <CalendarClock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-900 flex items-center gap-1">
                Vence mañana
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              </div>
              <div className="text-xs text-zinc-500">
                <span className="font-bold text-zinc-900">Entregar informe</span> · 10:00 AM
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="hidden lg:flex bottom-16 left-6" delay={0.9} float={10}>
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white shrink-0">
              <BellRing className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-900">Recordatorio: reunión a las 3:00</div>
              <div className="text-[11px] text-zinc-500">Proyecto Lanzamiento</div>
            </div>
          </FloatingCard>

          <motion.div style={{ y: mockupY }} className="hidden lg:block">
            <TiltCard className="relative rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.18)] ring-1 ring-zinc-950/5 lg:mr-64">
              <div className="flex items-center justify-between gap-2.5 border-b border-zinc-100 pb-3 mb-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                  </div>
                  <span className="text-xs font-mono text-zinc-400">fydrytask.app/dashboard</span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                  <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                  Mi día: 2 de 5
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-5 rounded-xl border border-zinc-100 bg-zinc-50/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>Completadas esta semana</span>
                      <CheckCircle2 className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                    </div>
                    <div className="text-2xl lg:text-3xl font-bold text-zinc-900 tracking-tight">
                      <CountUp value={28} />
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">7 pendientes</div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-zinc-200/60">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                      <span>Avance semanal</span>
                      <span className="font-semibold text-zinc-800">80%</span>
                    </div>
                    <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="bg-zinc-900 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: "80%" }}
                        transition={{ duration: 1.4, delay: 0.8, ease }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-zinc-100 bg-zinc-50/60">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
                    <span>Por proyecto</span>
                    <FolderKanban className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Lanzamiento", done: 9, total: 12, width: "75%", color: "bg-zinc-900" },
                      { label: "Casa", done: 4, total: 8, width: "50%", color: "bg-zinc-500" },
                      { label: "Estudios", done: 6, total: 7, width: "86%", color: "bg-emerald-500" },
                      { label: "Personal", done: 2, total: 10, width: "20%", color: "bg-zinc-300" },
                    ].map((c, i) => (
                      <div key={c.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-700">{c.label}</span>
                          <span className="font-semibold text-zinc-900">{c.done}/{c.total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-200/70 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: c.width }}
                            transition={{ duration: 1, delay: 0.9 + i * 0.12, ease }}
                            className={`h-full rounded-full ${c.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-zinc-100 bg-zinc-50/60">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
                    <span>Próximas</span>
                    <CalendarClock className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: "Entregar informe", meta: "Mañana · Trabajo", when: "10:00", urgent: true },
                      { name: "Reunión de equipo", meta: "Hoy · Lanzamiento", when: "15:00", urgent: false },
                      { name: "Cita médica", meta: "Jueves · Personal", when: "09:30", urgent: false },
                      { name: "Pagar internet", meta: "Viernes · Casa", when: "—", urgent: false },
                    ].map((m, i) => (
                      <motion.div
                        key={m.name}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 1 + i * 0.12 }}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-800 truncate">{m.name}</div>
                          <div className="text-[10px] text-zinc-400 truncate">{m.meta}</div>
                        </div>
                        <span className={`text-xs font-semibold whitespace-nowrap ${m.urgent ? "text-emerald-700" : "text-zinc-900"}`}>{m.when}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </TiltCard>
          </motion.div>

          {/* Teléfono: superpuesto en escritorio, protagonista en móvil */}
          <motion.div
            style={{ y: phoneY }}
            className="flex justify-center lg:absolute lg:-right-2 lg:top-10 lg:z-10"
          >
            <motion.div
              initial={{ opacity: 0, y: 60, rotate: 4 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.9, delay: 0.5, ease }}
            >
              <PhoneFrame>
                <TodayScreen />
              </PhoneFrame>
            </motion.div>
          </motion.div>

          <FloatingCard className="hidden lg:flex bottom-16 right-80" delay={1.1} float={-8}>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
              <Zap className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-zinc-900">Captura rápida</div>
              <div className="text-[11px] text-zinc-500">&quot;Llamar al banco mañana 10am&quot;</div>
            </div>
          </FloatingCard>
        </div>
      </div>
    </section>
  );
}
