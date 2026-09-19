// Sauvegarde / restauration de la base (démo) — JSON complet.
// Usage : bun scripts/db-backup.ts backup|restore [fichier]
import { PrismaClient } from "@prisma/client";
import { writeFileSync, readFileSync, existsSync } from "fs";

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "";
if (!url.startsWith("postgres")) {
  console.error("ERREUR : DIRECT_DATABASE_URL manquante (postgresql://...)");
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

const MODELS = [
  "user",
  "niveau",
  "classe",
  "groupe",
  "student",
  "teacher",
  "serviceTable",
  "serviceSlot",
  "session",
  "absence",
  "orientation",
  "setting",
] as const;

async function backup(file: string) {
  const data: Record<string, unknown[]> = {};
  for (const m of MODELS) {
    // @ts-expect-error accès dynamique au modèle
    data[m] = await prisma[m].findMany();
  }
  writeFileSync(file, JSON.stringify(data, null, 1));
  const total = Object.values(data).reduce((a, b) => a + b.length, 0);
  console.log(`BACKUP OK → ${file} (${total} enregistrements)`);
  for (const m of MODELS) console.log(`  ${m}: ${(data[m] as unknown[]).length}`);
}

async function restore(file: string) {
  if (!existsSync(file)) { console.error("Fichier introuvable : " + file); process.exit(1); }
  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown[]>;
  // Ordre inverse des dépendances FK.
  // NB : pas de $transaction interactive (incompatible PgBouncer mode transaction).
  const order = ["setting", "absence", "orientation", "session", "serviceSlot", "serviceTable", "teacher", "student", "groupe", "classe", "niveau", "user"] as const;
  const createOrder = [...order].reverse() as typeof order;
  for (const m of order) {
    // @ts-expect-error accès dynamique
    await prisma[m].deleteMany();
  }
  for (const m of createOrder) {
    for (const row of data[m] || []) {
      // @ts-expect-error accès dynamique
      await prisma[m].create({ data: row as object });
    }
  }
  console.log(`RESTORE OK ← ${file}`);
}

const cmd = process.argv[2] || "backup";
const file = process.argv[3] || "scripts/db-backup.json";
if (cmd === "backup") await backup(file);
else if (cmd === "restore") await restore(file);
else { console.error("Usage : bun scripts/db-backup.ts backup|restore [fichier]"); process.exit(1); }
await prisma.$disconnect();
