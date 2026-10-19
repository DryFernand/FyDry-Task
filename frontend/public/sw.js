// Service Worker para FyDry — Notificaciones Push en PC y Teléfono Móvil
const CACHE_NAME = "fydry-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Escuchar eventos push en segundo plano con la web cerrada
self.addEventListener("push", (event) => {
  let data = {
    title: "FyDry — Alerta Financiera",
    body: "Tienes un nuevo movimiento o alerta pendiente de revisar.",
    icon: "/logo_negro.png",
    badge: "/logo_negro.png",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/logo_negro.png",
      badge: data.badge || "/logo_negro.png",
      vibrate: [200, 100, 200],
      tag: data.tag || `fydry-alert-${Date.now()}`,
      data: { url: "/" },
    })
  );
});

// Al tocar la notificación, enfocar la app o abrirla
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL("/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
