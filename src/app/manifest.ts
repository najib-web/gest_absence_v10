import type { MetadataRoute } from "next";

// Manifeste PWA — rend l'application installable sur téléphone (Android/iOS/desktop).
// Le lien <link rel="manifest"> est injecté automatiquement par Next.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestion des Absences — Établissement Scolaire",
    short_name: "Absences",
    description:
      "Suivi et gestion des absences des élèves — enseignants, surveillant général et direction.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "fr",
    dir: "auto",
    background_color: "#ffffff",
    theme_color: "#047857",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
