// Export de toutes les tables SQLite → JSON (sauvegarde avant migration vers PostgreSQL Neon)
// À exécuter AVANT le basculement du provider Prisma (utilise l'ancien client SQLite).
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const db = new PrismaClient();

const TABLES = [
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

const data: Record<string, unknown[]> = {};
let total = 0;

for (const t of TABLES) {

  const rows = await (db as any)[t].findMany();
  data[t] = rows;
  total += rows.length;
  console.log(`${t.padEnd(14)} : ${rows.length}`);
}

writeFileSync("/home/z/my-project/scripts/db-export.json", JSON.stringify(data, null, 0), "utf-8");
console.log(`\nTotal : ${total} lignes → /home/z/my-project/scripts/db-export.json`);
await db.$disconnect();
