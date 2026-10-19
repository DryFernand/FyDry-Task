"use client";

import { motion } from "motion/react";
import { Check, X, Sparkles, Scale } from "lucide-react";

const comparisons = [
  {
    feature: "Capturar pendientes",
    traditional: "Notas sueltas, papelitos y chats contigo mismo",
    fydry: "Captura rápida en segundos, desde el móvil o la web",
  },
  {
    feature: "Carga mental y estrés",
    traditional: "Listas infinitas que nunca terminas y te generan culpa",
    fydry: "Mi día: una lista corta y realista de lo que importa hoy",
  },
  {
    feature: "Recordar fechas",
    traditional: "Se te pasan entregas y compromisos",
    fydry: "Fechas límite y recordatorios a tiempo",
  },
  {
    feature: "Curva de aprendizaje",
    traditional: "Herramientas complejas con decenas de menús y configuraciones",
    fydry: "Diseño minimalista: abres, escribes y listo",
  },
  {
    feature: "Privacidad y Control",
    traditional: "Apps que venden tus datos o te llenan de publicidad",
    fydry: "Sin publicidad, conexión cifrada y tus datos son tuyos",
  },
];

export default function ComparisonSection() {
  return (
    <section id="comparativa" className="py-20 md:py-28 bg-white border-b border-zinc-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold mb-3"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Por qué elegir FyDry Task</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900"
          >
            Menos fricción, mucha más claridad
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 text-base text-zinc-600"
          >
            Compara cómo cambia tu día a día al pasar de las notas sueltas al enfoque FyDry Task.
          </motion.p>
        </div>

        {/* Table Comparison Container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto border border-zinc-200 rounded-2xl overflow-hidden shadow-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200">
            {/* Traditional Method Column */}
            <div className="p-6 sm:p-8 bg-zinc-50/50">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500">
                  <X className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wider">
                  Notas Sueltas & Apps Complejas
                </h3>
              </div>

              <div className="space-y-6">
                {comparisons.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs text-zinc-500">
                    <X className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-zinc-700 font-medium">{c.feature}</strong>
                      <span>{c.traditional}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FyDry Method Column */}
            <div className="p-6 sm:p-8 bg-white relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                    El Método FyDry Task
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/60">
                  Recomendado
                </span>
              </div>

              <div className="space-y-6">
                {comparisons.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs text-zinc-700">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <strong className="block text-zinc-900 font-semibold">{c.feature}</strong>
                      <span>{c.fydry}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
