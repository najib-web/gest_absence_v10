"use client";

import { useEffect } from "react";

// Enregistrement du service worker (PWA installable + page hors ligne).
// Uniquement en PRODUCTION : en dev, le cache-first sur /_next/static servirait
// des chunks Turbopack périmés (URLs non fingerprintées) et casserait le HMR.
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // échec silencieux : l'application fonctionne normalement sans SW
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
