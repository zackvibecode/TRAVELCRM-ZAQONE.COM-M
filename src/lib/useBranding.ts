import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Shared branding settings. The CRM writes these under the `company`
 * settings key; the public website and the CRM shells both read them from
 * here, so a change in Settings > Company Profile updates the website and
 * the CRM chrome at the same time.
 */
export interface Branding {
  name: string;
  brandName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  logoUrl: string;
  whatsapp: string;
  currency: string;
  defaultLang: string;
}

export const DEFAULT_BRANDING: Branding = {
  name: "ZAQONE Travel",
  brandName: "ZAQONE Travel",
  tagline: "Agensi pelancongan",
  phone: "+60 3-2711 8899",
  email: "hello@zaqone.travel",
  address: "Jalan Ampang 88, 50450 Kuala Lumpur",
  website: "https://travelcrm.zaqone.com",
  logoUrl: "/brand/zaqone-logo.png",
  whatsapp: "60123880030",
  currency: "MYR",
  defaultLang: "ms",
};

let cache: Branding | null = null;
let cacheAt = 0;
let inflight: Promise<Branding> | null = null;

const CACHE_TTL_MS = 60_000; // re-fetch at most once a minute so logo/brand edits show up

async function loadBranding(force = false): Promise<Branding> {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  if (!inflight) {
    inflight = apiFetch<{ branding?: Partial<Branding> }>("/public/branding")
      .then((res) => {
        cache = { ...DEFAULT_BRANDING, ...(res.branding ?? {}) };
        cacheAt = Date.now();
        return cache;
      })
      .catch(() => {
        if (!cache) {
          cache = DEFAULT_BRANDING;
          cacheAt = Date.now();
        }
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Warm the branding cache (call once at app start). */
export function preloadBranding(): Promise<Branding> {
  return loadBranding();
}

/** Drop the cached branding so the next read refetches (after a save). */
export function invalidateBranding(): void {
  cache = null;
}

/**
 * React hook exposing the shared branding settings. Returns the defaults
 * immediately and swaps in the stored values once loaded, so the UI never
 * flashes empty.
 */
export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(cache ?? DEFAULT_BRANDING);

  useEffect(() => {
    if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return;
    let alive = true;
    void loadBranding().then((b) => {
      if (alive) setBranding(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  return branding;
}

/** WhatsApp deep link built from the stored whatsapp number. */
export function whatsappUrl(branding: Branding): string {
  return `https://wa.me/${branding.whatsapp.replace(/\D/g, "")}`;
}
