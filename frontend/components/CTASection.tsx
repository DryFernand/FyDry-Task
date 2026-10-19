"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles, ShieldCheck } from "lucide-react";

export default function CTASection() {
  return (
    <section id="empezar" className="py-20 md:py-28 bg-white relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glow-border relative rounded-3xl text-white p-8 sm:p-14 overflow-hidden shadow-2xl"
        >
          {/* Subtle glow background */}
          <div className="blob absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="blob absolute -bottom-32 -left-24 w-96 h-96 bg-zinc-700/40 rounded-full blur-3xl pointer-events-none [animation-delay:-9s]" aria-hidden="true" />
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" aria-hidden="true" />

          <div className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gratis, sin tarjeta</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
              Organiza tus tareas, <br />
              tranquiliza tu mente.
            </h2>

            <p className="mt-4 text-base text-zinc-400 max-w-lg">
              Crea tu cuenta en segundos y termina cada día sabiendo que lo importante quedó hecho.
            </p>

            {/* Email Capture or CTA Action */}
            <div className="mt-8 flex justify-center w-full">
              <motion.a
                href="/register"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-semibold text-sm transition-all shadow-md"
              >
                <span>Empezar Gratis</span>
                <ArrowRight className="w-4 h-4" />
              </motion.a>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Sin tarjeta de crédito
              </span>
              <span>•</span>
              <span>Sin publicidad</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
