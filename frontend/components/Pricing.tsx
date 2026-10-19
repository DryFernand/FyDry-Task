"use client";

import { motion } from "motion/react";
import { Check, Sparkles, Clock } from "lucide-react";

const freeFeatures = [
  "Tareas, subtareas y listas ilimitadas",
  "Vista Mi día",
  "Fechas límite y prioridades",
  "Proyectos y etiquetas",
  "Tareas recurrentes",
  "Acceso desde web y móvil",
];

const proFeatures = [
  "Recordatorios por correo y push",
  "Colaboración y tareas compartidas",
  "Soporte prioritario",
];

export default function Pricing() {
  return (
    <section id="precios" className="py-20 md:py-28 bg-zinc-50/50 border-b border-zinc-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-zinc-200 text-zinc-800 text-xs font-semibold mb-3 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Precios Simples y Transparentes</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900"
          >
            Todo lo esencial, gratis
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-base text-zinc-600"
          >
            Sin tarjeta de crédito y sin límites artificiales. El plan Pro llegará con funciones extra; lo que hoy es gratis seguirá siéndolo.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          {/* Plan Gratis */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            whileHover={{ y: -6 }}
            className="glow-border p-7 rounded-2xl text-white shadow-xl shadow-emerald-900/10 flex flex-col justify-between"
          >
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>FyDry Task Gratis</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xs text-zinc-400 mt-1">Todo lo que la app hace hoy, sin costo.</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">RD$ 0</span>
                <span className="text-xs text-zinc-400 font-medium">/ para siempre</span>
              </div>

              <ul className="mt-8 space-y-3 text-xs text-zinc-300">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href="/register"
              className="mt-8 w-full block text-center py-3 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-xs transition-colors shadow-sm"
            >
              Crear cuenta gratis
            </a>
          </motion.div>

          {/* Plan Pro (próximamente) */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-7 rounded-2xl bg-white border border-zinc-200 shadow-xs flex flex-col justify-between relative"
          >
            <div className="absolute top-4 right-4">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200/60 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Próximamente
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900">FyDry Task Pro</div>
              <div className="text-xs text-zinc-500 mt-1">Funciones extra para equipos y usuarios avanzados.</div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-zinc-400">Precio por anunciar</span>
              </div>

              <ul className="mt-8 space-y-3 text-xs text-zinc-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Todo lo del plan Gratis</span>
                </li>
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <span
              aria-disabled="true"
              className="mt-8 w-full block text-center py-2.5 px-4 rounded-xl bg-zinc-100 text-zinc-500 font-medium text-xs cursor-not-allowed"
            >
              Disponible pronto
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
