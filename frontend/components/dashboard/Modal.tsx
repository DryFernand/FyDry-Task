"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/40 backdrop-blur-[2px] p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl border border-zinc-200 shadow-2xl`}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-bold text-zinc-950">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 pb-4 overflow-y-auto flex-1">{children}</div>
            {footer && <div className="px-5 py-4 border-t border-zinc-100 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
