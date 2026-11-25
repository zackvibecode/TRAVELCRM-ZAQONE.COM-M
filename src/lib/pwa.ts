/**
 * PWA support: service-worker registration + the native install prompt.
 *
 * Chrome/Edge on Android & desktop fire `beforeinstallprompt` when the app
 * meets installability criteria (manifest + service worker + HTTPS). We
 * capture it so the UI can offer a one-tap "Install app" instead of relying
 * on the browser menu. iOS Safari has no such event — users install manually
 * via Share → Add to Home Screen (an instructions hint is shown there).
 */

export type InstallPrompt = {
  prompt: () => Promise<void>;
  isIos: boolean;
};

let deferredEvent: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
const listeners = new Set<(available: boolean) => void>();

function notify() {
  for (const fn of listeners) fn(!!deferredEvent || isIosSafari());
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(typeof window !== "undefined" && (window as { MSStream?: unknown }).MSStream)
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function onInstallAvailability(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  fn(!!deferredEvent || (isIosSafari() && !isStandalone()));
  return () => listeners.delete(fn);
}

export function getInstallPrompt(): InstallPrompt | null {
  if (deferredEvent) {
    return { prompt: () => deferredEvent!.prompt(), isIos: false };
  }
  if (isIosSafari() && !isStandalone()) {
    return { prompt: async () => {}, isIos: true };
  }
  return null;
}

export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW is a progressive enhancement — ignore registration failures.
    });
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredEvent = e as typeof deferredEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredEvent = null;
    notify();
  });
}
