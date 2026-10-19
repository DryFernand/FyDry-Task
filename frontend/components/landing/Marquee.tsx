import { CheckSquare, Calendar, Flag, FolderKanban, BellRing, Repeat, Tag, ListChecks, Sun, ShieldCheck } from "lucide-react";

const items = [
  { icon: CheckSquare, label: "Tareas y subtareas" },
  { icon: Sun, label: "Mi día" },
  { icon: Calendar, label: "Fechas límite" },
  { icon: Flag, label: "Prioridades" },
  { icon: FolderKanban, label: "Proyectos" },
  { icon: Repeat, label: "Tareas recurrentes" },
  { icon: Tag, label: "Etiquetas" },
  { icon: BellRing, label: "Recordatorios" },
  { icon: ListChecks, label: "Listas" },
  { icon: ShieldCheck, label: "Tus datos, privados" },
];

/** Cinta infinita de funciones. Se pausa al pasar el cursor y con "reducir movimiento". */
export default function Marquee() {
  return (
    <section aria-label="Funciones de FyDry Task" className="relative py-6 bg-emerald-700 overflow-hidden marquee-mask">
      <div className="marquee-track flex w-max gap-3">
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-200 text-sm font-medium whitespace-nowrap"
          >
            <item.icon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
