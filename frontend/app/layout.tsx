import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const figtree = Figtree({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FyDry Task — Organiza tus tareas, tranquiliza tu mente",
    template: "%s | FyDry Task",
  },
  description:
    "La plataforma minimalista de la familia FyDry para organizar tus tareas, proyectos y pendientes sin estrés.",
  keywords: [
    "gestor de tareas",
    "lista de pendientes",
    "productividad",
    "organización personal",
    "proyectos",
    "FyDry",
    "FyDry Task",
  ],
  authors: [{ name: "FyDry Team" }],
  creator: "FyDry",
  publisher: "FyDry Inc.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FyDry Task",
  },
  icons: {
    icon: [
      {
        url: "/logo_vino_fondo_blanco.png",
        media: "(prefers-color-scheme: light)",
        type: "image/png",
      },
      {
        url: "/logo_vino_fondo_blanco.png",
        media: "(prefers-color-scheme: dark)",
        type: "image/png",
      },
    ],
    shortcut: [
      {
        url: "/logo_vino_fondo_blanco.png",
        media: "(prefers-color-scheme: light)",
        type: "image/png",
      },
      {
        url: "/logo_vino_fondo_blanco.png",
        media: "(prefers-color-scheme: dark)",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    title: "FyDry Task — Organiza tus tareas, tranquiliza tu mente",
    description: "Claridad total sobre tus pendientes sin complicaciones.",
    url: siteUrl,
    siteName: "FyDry Task",
    images: [
      {
        url: "/og_fydry.png",
        width: 1200,
        height: 630,
        alt: "FyDry Task — Organiza tus tareas",
      },
    ],
    locale: "es_DO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FyDry Task — Organiza tus tareas, tranquiliza tu mente",
    description: "Claridad total sobre tus pendientes sin complicaciones.",
    images: ["/og_fydry.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerList = await headers();
  const themeCookie = cookieStore.get("fydry_theme")?.value;
  const secChTheme = headerList.get("sec-ch-prefers-color-scheme");
  const isDark = themeCookie === "dark" || secChTheme === "dark";

  const mobileIcon = isDark ? "/logo_vino_fondo_blanco.png" : "/logo_vino_fondo_blanco.png";
  const manifestPath = isDark ? "/manifest.dark.json" : "/manifest.light.json";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "FyDry Task",
    url: siteUrl,
    description: "Plataforma minimalista de gestión de tareas.",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "All",
    image: `${siteUrl}/logo_vino_fondo_blanco.png`,
    logo: `${siteUrl}/logo_vino_fondo_blanco.png`,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${figtree.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var mql = window.matchMedia('(prefers-color-scheme: dark)');
                  function applyTheme(dark) {
                    var theme = dark ? 'dark' : 'light';
                    document.cookie = "fydry_theme=" + theme + "; path=/; max-age=31536000; SameSite=Lax";

                    // Actualizar Apple Touch Icon para iOS Safari
                    var appleLink = document.getElementById('apple-touch-icon');
                    if (appleLink) {
                      appleLink.href = dark ? '/logo_vino_fondo_blanco.png' : '/logo_vino_fondo_blanco.png';
                    }

                    // Actualizar Manifest para Android Chrome
                    var manLink = document.getElementById('app-manifest');
                    if (manLink) {
                      manLink.href = dark ? '/manifest.dark.json' : '/manifest.light.json';
                    }

                    // Actualizar Favicon de pestaña
                    var favLink = document.getElementById('dynamic-favicon');
                    if (favLink) {
                      favLink.href = dark ? '/logo_vino_fondo_blanco.png' : '/logo_vino_fondo_blanco.png';
                    }
                  }
                  applyTheme(mql.matches);
                  if (mql.addEventListener) {
                    mql.addEventListener('change', function(e) { applyTheme(e.matches); });
                  } else if (mql.addListener) {
                    mql.addListener(function(e) { applyTheme(e.matches); });
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FyDry Task" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <link id="dynamic-favicon" rel="icon" href="/logo_vino_fondo_blanco.png" type="image/png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/logo_vino_fondo_blanco.png" type="image/png" media="(prefers-color-scheme: dark)" />
        <link id="apple-touch-icon" rel="apple-touch-icon" sizes="180x180" href={mobileIcon} />
        <link id="app-manifest" rel="manifest" href={manifestPath} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
