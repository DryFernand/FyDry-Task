import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white py-12 text-zinc-500 text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Info */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-3 group">
              <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                <Image
                  src="/logo_vino.png"
                  alt="FyDry Task Logo"
                  fill
                  sizes="28px"
                  className="object-contain"
                />
              </div>
              <span className="font-bold text-base text-zinc-900 tracking-tight">
                FyDry <span className="text-emerald-700">Task</span>
              </span>
            </Link>
            <p className="text-zinc-500 max-w-sm text-xs leading-relaxed">
              Organiza tus tareas, tranquiliza tu mente. El gestor de tareas minimalista de la familia FyDry, diseñado para darte claridad sin estrés.
            </p>
            <div className="mt-4 text-[11px] text-zinc-400">
              © {new Date().getFullYear()} FyDry Inc. Todos los derechos reservados.
            </div>
          </div>

          {/* Column 1: Producto */}
          <div>
            <div className="font-semibold text-zinc-900 mb-3 uppercase tracking-wider text-[11px]">
              Producto
            </div>
            <ul className="space-y-2">
              <li><a href="#caracteristicas" className="hover:text-zinc-900 transition-colors">Características</a></li>
              <li><a href="#precios" className="hover:text-zinc-900 transition-colors">Precios</a></li>
              <li><a href="#comparativa" className="hover:text-zinc-900 transition-colors">Comparativa</a></li>
            </ul>
          </div>

          {/* Column 2: Recursos */}
          <div>
            <div className="font-semibold text-zinc-900 mb-3 uppercase tracking-wider text-[11px]">
              Recursos
            </div>
            <ul className="space-y-2">
              <li><a href="#faq" className="hover:text-zinc-900 transition-colors">Preguntas Frecuentes</a></li>
              <li><a href="#" className="hover:text-zinc-900 transition-colors">Guía de Productividad Zen</a></li>
              <li><a href="#" className="hover:text-zinc-900 transition-colors">Blog</a></li>
              <li><a href="https://fydry-dary.vercel.app" className="hover:text-zinc-900 transition-colors">FyDry Finanzas</a></li>
            </ul>
          </div>

          {/* Column 3: Legal & Seguridad */}
          <div>
            <div className="font-semibold text-zinc-900 mb-3 uppercase tracking-wider text-[11px]">
              Legal
            </div>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-zinc-900 transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-zinc-900 transition-colors">Términos de Servicio</a></li>
              <li><a href="#" className="hover:text-zinc-900 transition-colors">Seguridad</a></li>
              <li><a href="#" className="hover:text-zinc-900 transition-colors">Contacto</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Todos los sistemas operando normalmente (100% Uptime)</span>
          </div>
          <div>Diseñado para la calma productiva.</div>
        </div>
      </div>
    </footer>
  );
}
