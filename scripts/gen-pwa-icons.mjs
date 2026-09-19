// Génération des icônes PWA à partir du logo SVG de l'application
// Logo : carré arrondi dégradé émeraude + chapeau de diplômé blanc + badge de validation
// Usage : bun scripts/gen-pwa-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";

const W = 512;

// ---------- Variante RONDE (coins arrondis, angles transparents) ----------
const svgRounded = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10B981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${W}" rx="112" fill="url(#bg)"/>
  <circle cx="120" cy="90" r="230" fill="#ffffff" opacity="0.07"/>
  <g fill="#ffffff">
    <path d="M256 128 L442 208 L256 288 L70 208 Z"/>
    <path d="M170 246 L170 326 Q170 336 178 342 Q214 368 256 368 Q298 368 334 342 Q342 336 342 326 L342 246 Q256 296 170 246 Z"/>
    <rect x="435" y="208" width="14" height="64" rx="7"/>
    <circle cx="442" cy="284" r="13"/>
  </g>
  <circle cx="384" cy="384" r="88" fill="#ffffff" stroke="#047857" stroke-width="12"/>
  <path d="M340 386 L370 416 L432 352" fill="none" stroke="#047857" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ---------- Variante MASKABLE (pleine, contenu réduit à 70 % — zone de sécurité) ----------
const svgMaskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10B981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#bg)"/>
  <g transform="translate(76.8,76.8) scale(0.7)">
    <g fill="#ffffff">
      <path d="M256 128 L442 208 L256 288 L70 208 Z"/>
      <path d="M170 246 L170 326 Q170 336 178 342 Q214 368 256 368 Q298 368 334 342 Q342 336 342 326 L342 246 Q256 296 170 246 Z"/>
      <rect x="435" y="208" width="14" height="64" rx="7"/>
      <circle cx="442" cy="284" r="13"/>
    </g>
    <circle cx="384" cy="384" r="88" fill="#ffffff" stroke="#047857" stroke-width="12"/>
    <path d="M340 386 L370 416 L432 352" fill="none" stroke="#047857" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// ---------- Variante APPLE (pleine, sans coins — iOS applique son propre masque) ----------
const svgApple = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10B981"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#bg)"/>
  <g transform="translate(35.84,35.84) scale(0.86)">
    <g fill="#ffffff">
      <path d="M256 128 L442 208 L256 288 L70 208 Z"/>
      <path d="M170 246 L170 326 Q170 336 178 342 Q214 368 256 368 Q298 368 334 342 Q342 336 342 326 L342 246 Q256 296 170 246 Z"/>
      <rect x="435" y="208" width="14" height="64" rx="7"/>
      <circle cx="442" cy="284" r="13"/>
    </g>
    <circle cx="384" cy="384" r="88" fill="#ffffff" stroke="#047857" stroke-width="12"/>
    <path d="M340 386 L370 416 L432 352" fill="none" stroke="#047857" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const outDir = "public/icons";
mkdirSync(outDir, { recursive: true });

async function render(svg, size, path) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path);
  console.log(`✅ ${path} (${size}×${size})`);
}

await render(svgRounded, 192, `${outDir}/icon-192.png`);
await render(svgRounded, 512, `${outDir}/icon-512.png`);
await render(svgMaskable, 192, `${outDir}/icon-maskable-192.png`);
await render(svgMaskable, 512, `${outDir}/icon-maskable-512.png`);
await render(svgApple, 180, `${outDir}/apple-touch-icon.png`);
// Favicon Next.js (convention src/app/icon.png)
await render(svgRounded, 256, "src/app/icon.png");
// Aperçu haute résolution pour l'utilisateur
await render(svgRounded, 1024, "download/logo-application.png");
console.log("🎉 Toutes les icônes sont générées");
