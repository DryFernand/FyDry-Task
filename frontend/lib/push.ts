import { api } from "./tasks";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function urlB64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function pushState(): Promise<PushState> {
  // En iPhone el push solo existe con la app instalada en la pantalla de inicio
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  const config = await api.pushConfig();
  if (!config.enabled || !config.public_key) throw new Error("Las notificaciones aún no están configuradas en el servidor.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(config.public_key) }));
  await api.subscribePush(sub.toJSON());
  await api.savePrefs({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.unsubscribePush(sub.endpoint).catch(() => null);
    await sub.unsubscribe();
  }
  return "off";
}
