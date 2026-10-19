"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "¿Qué es FyDry Task?",
    answer:
      "Es el gestor de tareas de la familia FyDry. Mantiene la misma filosofía minimalista: menos ruido, más claridad. Te ayuda a capturar pendientes, decidir qué hacer hoy y terminar el día tranquilo.",
  },
  {
    question: "¿Es lo mismo que FyDry?",
    answer:
      "FyDry se enfoca en tus finanzas y FyDry Task en tus tareas. Comparten diseño, estilo y valores, pero cada uno resuelve un problema distinto.",
  },
  {
    question: "¿Están seguros mis datos?",
    answer:
      "Tus datos viajan cifrados (HTTPS/TLS), tu contraseña se guarda con hash bcrypt y cada consulta está aislada a tu usuario. No vendemos tus datos a terceros.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Lo esencial es gratis y sin tarjeta. Habrá un plan Pro con funciones extra, pero lo que hoy es gratis seguirá siéndolo.",
  },
  {
    question: "¿Puedo usarlo en mi teléfono?",
    answer:
      "Sí. FyDry Task funciona en cualquier navegador y puedes instalarlo como app en tu teléfono desde el menú del navegador.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 md:py-28 bg-white border-b border-zinc-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-semibold mb-3"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Respuestas claras</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900"
          >
            Preguntas Frecuentes
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-3 text-base text-zinc-600"
          >
            Todo lo que necesitas saber antes de empezar a organizar tus tareas con FyDry Task.
          </motion.p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs transition-colors hover:border-zinc-300"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 font-medium text-sm text-zinc-900"
                >
                  <span>{faq.question}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-400 shrink-0"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-4 pt-1 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
