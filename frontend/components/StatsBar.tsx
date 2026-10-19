"use client";

import { motion } from "motion/react";
import { Zap, Sun, Flag, Smartphone } from "lucide-react";

const stats = [
  {
    icon: Zap,
    value: "3 seg",
    label: "Captura rápida",
    subtext: "Anota una tarea antes de que se te olvide",
  },
  {
    icon: Sun,
    value: "1",
    label: "Vista de Mi día",
    subtext: "Solo lo que importa hoy, sin ruido",
  },
  {
    icon: Flag,
    value: "4",
    label: "Niveles de prioridad",
    subtext: "De urgente a cuando puedas",
  },
  {
    icon: Smartphone,
    value: "Web · Móvil",
    label: "En todas partes",
    subtext: "Instálala como app en tu teléfono",
  },
];

export default function StatsBar() {
  return (
    <section className="py-14 border-b border-zinc-200/80 bg-zinc-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8"
        >
          {stats.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                className="group flex flex-col items-center text-center p-4 rounded-xl bg-white border border-zinc-200/70 shadow-xs hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/5 transition-[box-shadow,border-color]"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900 mb-2 transition-colors group-hover:bg-emerald-700 group-hover:text-emerald-400">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                  {item.value}
                </div>
                <div className="text-xs font-semibold text-zinc-800 mt-1">
                  {item.label}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5 max-w-[160px]">
                  {item.subtext}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
