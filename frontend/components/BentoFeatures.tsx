"use client";

import { motion } from "motion/react";
import {
  Layers,
  Zap,
  FolderKanban,
  Sun,
  SlidersHorizontal,
} from "lucide-react";

const features = [
  {
    title: "Captura Rápida sin Fricción",
    description:
      "Escribe 'Llamar al banco mañana a las 10' y FyDry Task crea la tarea con fecha y hora. Sin formularios eternos, sin pasos de más.",
    icon: Zap,
    tag: "Velocidad",
    colSpan: "md:col-span-2",
    preview: (
      <div className="mt-4 p-3 rounded-lg bg-zinc-900 text-white text-xs font-mono">
        <div className="text-zinc-400">&gt; Nueva tarea:</div>
        <div className="text-emerald-400 mt-1">&quot;Enviar propuesta a cliente viernes&quot;</div>
        <div className="text-zinc-300 text-[10px] mt-2">✓ Creada · Vence viernes · Trabajo</div>
      </div>
    ),
  },
  {
    title: "Mi Día",
    description:
      "Cada mañana eliges lo que harás hoy. Una lista corta y realista que te deja terminar el día con la mente tranquila.",
    icon: Sun,
    tag: "Enfoque",
    colSpan: "md:col-span-1",
    preview: (
      <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200/60 text-center">
        <div className="text-[11px] text-emerald-800 font-medium">Completadas hoy</div>
        <div className="text-xl font-bold text-emerald-950 mt-0.5">4 de 6</div>
      </div>
    ),
  },
  {
    title: "Proyectos y Listas",
    description:
      "Agrupa tus tareas por proyecto, área o cliente. Todo en su lugar, nada mezclado.",
    icon: FolderKanban,
    tag: "Orden",
    colSpan: "md:col-span-1",
    preview: (
      <div className="mt-4 flex flex-wrap gap-2">
        {["Trabajo", "Casa", "Estudios", "Personal"].map((l) => (
          <span key={l} className="px-2 py-1 bg-white rounded border border-zinc-200 text-[10px] text-zinc-700">{l}</span>
        ))}
      </div>
    ),
  },
  {
    title: "Prioridades y Progreso Claro",
    description:
      "Marca lo urgente, divide lo grande en subtareas y mira tu avance por proyecto sin hojas de cálculo.",
    icon: SlidersHorizontal,
    tag: "Claridad",
    colSpan: "md:col-span-2",
    preview: (
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded bg-zinc-50 border border-zinc-200">
          <div className="text-[10px] text-zinc-500">Proyecto Lanzamiento</div>
          <div className="text-xs font-bold text-zinc-900 mt-1">75% Completado</div>
          <div className="w-full bg-zinc-200 rounded-full h-1.5 mt-2">
            <motion.div className="bg-zinc-900 h-1.5 rounded-full" initial={{ width: 0 }} whileInView={{ width: "75%" }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.3 }} />
          </div>
        </div>
        <div className="p-2.5 rounded bg-zinc-50 border border-zinc-200">
          <div className="text-[10px] text-zinc-500">Mudanza</div>
          <div className="text-xs font-bold text-zinc-900 mt-1">9 / 12 tareas</div>
          <div className="w-full bg-zinc-200 rounded-full h-1.5 mt-2">
            <motion.div className="bg-emerald-500 h-1.5 rounded-full" initial={{ width: 0 }} whileInView={{ width: "75%" }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.45 }} />
          </div>
        </div>
      </div>
    ),
  },
];

export default function BentoFeatures() {
  return (
    <section id="caracteristicas" className="py-20 md:py-28 bg-white border-b border-zinc-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Heading */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold mb-3"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Diseñado con precisión</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900"
          >
            Todo lo que necesitas para dominar tu día
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-base text-zinc-600"
          >
            Funcionalidades creadas bajo una premisa fundamental: brindarte el máximo control con la mínima fricción.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -6 }}
                onPointerMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
                  e.currentTarget.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
                }}
                className={`spotlight-card group ${item.colSpan} p-6 sm:p-7 rounded-2xl bg-white border border-zinc-200 shadow-xs hover:shadow-xl hover:shadow-emerald-900/5 hover:border-zinc-300 transition-[box-shadow,border-color] duration-300 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-900 transition-all duration-300 group-hover:bg-emerald-700 group-hover:text-emerald-400 group-hover:rotate-6 group-hover:scale-110">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-600 bg-zinc-100/80 px-2.5 py-1 rounded-full">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>

                {item.preview}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
