// Import des données JSON (export SQLite) vers PostgreSQL Neon
// Ordre respectant les clés étrangères. Ids conservés à l'identique.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

// Même résolution que src/lib/db-url.ts : env > .env.neon (via scripts/db-url.sh).
// Aucun identifiant en dur — voir .env.example et DEPLOIEMENT.md.
const envUrl = [process.env.POSTGRES_URL, process.env.DATABASE_URL].find((u) =>
  u?.startsWith("postgres")
);
const datasourceUrl =
  envUrl ??
  execFileSync("bash", ["scripts/db-url.sh"], {
    cwd: join(import.meta.dir, ".."),
  })
    .toString()
    .trim();
const db = new PrismaClient({ datasourceUrl });

const ORDER = [
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
  "setting",
  "orientation",
] as const;

const data = JSON.parse(
  readFileSync("/home/z/my-project/scripts/db-export.json", "utf-8")
) as Record<string, unknown[]>;

// Garde-fou : refuser d'importer dans une base déjà peuplée (sauf FORCE=1)
const existing = await db.user.count();
if (existing > 0 && process.env.FORCE !== "1") {
  console.error(`Refus : la base cible contient déjà ${existing} utilisateurs. FORCE=1 pour écraser.`);
  await db.$disconnect();
  process.exit(1);
}

let total = 0;
for (const t of ORDER) {
  const rows = data[t] ?? [];
  if (rows.length === 0) {
    console.log(`${t.padEnd(14)} : 0 (ignoré)`);
    continue;
  }

  await (db as any)[t].createMany({ data: rows });
  total += rows.length;
  console.log(`${t.padEnd(14)} : ${rows.length} importés`);
}

console.log(`\nTotal importé : ${total} lignes → Neon gest_absence`);
await db.$disconnect();
