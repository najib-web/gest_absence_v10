// Génère toutes les icônes PWA à partir des SVG sources (sharp).
// Exécuter : bun scripts/gen-icons.ts

import sharp from "sharp";
import fs from "fs";
import path from "path";

const iconsDir = path.join(process.cwd(), "public", "icons");
const appDir = path.join(process.cwd(), "src", "app");

const mainSvg = path.join(iconsDir, "icon.svg");
const maskableSvg = path.join(iconsDir, "icon-maskable.svg");

async function render(svg: string, size: number, out: string) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${path.relative(process.cwd(), out)} (${size}x${size})`);
}

async function main() {
  // Icônes manifest (any)
  await render(mainSvg, 192, path.join(iconsDir, "icon-192.png"));
  await render(mainSvg, 512, path.join(iconsDir, "icon-512.png"));
  // Icônes maskable (safe-zone)
  await render(maskableSvg, 192, path.join(iconsDir, "maskable-192.png"));
  await render(maskableSvg, 512, path.join(iconsDir, "maskable-512.png"));
  // Apple touch icon (180) + conventions Next (favicon)
  await render(mainSvg, 180, path.join(process.cwd(), "public", "apple-touch-icon.png"));
  await render(mainSvg, 180, path.join(appDir, "apple-icon.png"));
  await render(mainSvg, 256, path.join(appDir, "icon.png"));

  const files = fs.readdirSync(iconsDir).map((f) => {
    const st = fs.statSync(path.join(iconsDir, f));
    return `${f} — ${(st.size / 1024).toFixed(1)} Ko`;
  });
  console.log("\nIcons dir:", files.join(" | "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
