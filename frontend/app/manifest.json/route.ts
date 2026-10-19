import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const themeCookie = request.cookies.get("fydry_theme")?.value;
  const secChTheme = request.headers.get("sec-ch-prefers-color-scheme");
  const isDark = themeCookie === "dark" || secChTheme === "dark";

  const manifest = {
    name: "FyDry Task",
    short_name: "FyDry Task",
    description: "Plataforma minimalista de gestión de tareas.",
    start_url: "/",
    display: "standalone",
    background_color: isDark ? "#09090b" : "#ffffff",
    theme_color: isDark ? "#09090b" : "#ffffff",
    icons: [
      {
        src: isDark ? "/logo_blanco_fondo_negro.png" : "/logo_negro_fondo_blanco.png",
        sizes: "192x192 512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
