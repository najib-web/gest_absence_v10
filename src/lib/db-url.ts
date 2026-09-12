// Résolveur centralisé de l'URL PostgreSQL.
//
// Ordre de priorité :
//   1. POSTGRES_URL (env)
//   2. DATABASE_URL (env) — ignorée si elle pointe vers SQLite (file:) car le
//      sandbox/CI peut injecter une valeur factice qui ne doit pas masquer Neon.
//   3. Fichier `.env.neon` (développement local uniquement, git-ignoré).
//   4. Erreur explicite renvoyant à .env.example / DEPLOIEMENT.md.
//
// Aucun identifiant n'est codé en dur dans le code source.

import fs from "fs";
import path from "path";

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function readEnvFile(fileName: string): Record<string, string> | null {
  try {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) return null;
    return parseEnvFile(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isUsablePostgres(url: string | undefined | null): url is string {
  return !!url && !url.startsWith("file:") && /postgres(ql)?:\/\//.test(url);
}

export function resolveDatabaseUrl(): string {
  // 1 & 2 — variables d'environnement (Vercel, CI, export manuel)
  if (isUsablePostgres(process.env.POSTGRES_URL)) return process.env.POSTGRES_URL;
  if (isUsablePostgres(process.env.DATABASE_URL)) return process.env.DATABASE_URL;

  // 3 — fichier .env.neon (développement local, jamais commité)
  const fileEnv = readEnvFile(".env.neon") ?? readEnvFile(".env.local");
  if (fileEnv && isUsablePostgres(fileEnv.DATABASE_URL)) return fileEnv.DATABASE_URL;
  if (fileEnv && isUsablePostgres(fileEnv.POSTGRES_URL)) return fileEnv.POSTGRES_URL;

  // 4 — configuration manquante
  throw new Error(
    "URL PostgreSQL introuvable. Définissez DATABASE_URL (variable d'environnement) " +
      "ou créez un fichier .env.neon avec DATABASE_URL=postgresql://... " +
      "Voir .env.example et DEPLOIEMENT.md."
  );
}
