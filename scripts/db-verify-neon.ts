// Vérification post-migration : comptages + cohérence relationnelle sur Neon
import { PrismaClient } from "@prisma/client";
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

const counts = {
  users: await db.user.count(),
  niveaux: await db.niveau.count(),
  classes: await db.classe.count(),
  groupes: await db.groupe.count(),
  students: await db.student.count(),
  teachers: await db.teacher.count(),
  serviceTables: await db.serviceTable.count(),
  serviceSlots: await db.serviceSlot.count(),
  sessions: await db.session.count(),
  absences: await db.absence.count(),
  settings: await db.setting.count(),
  orientations: await db.orientation.count(),
};
console.table(counts);

// Cohérence : comptes de rôle + jointures clés
const roles = await db.user.groupBy({ by: ["role"], _count: true });
console.log("Rôles :", roles.map((r) => `${r.role}=${r._count}`).join(", "));

const t = await db.teacher.findFirst({ where: { ppr: "123456" }, include: { user: true } });
console.log(
  "Bennani/PPR 123456 :",
  t ? `${t.firstName} ${t.lastName} → user ${t.user.email} (${t.user.role})` : "INTROUVABLE"
);

const or = await db.orientation.findFirst({ include: { student: true, teacher: true } });
console.log(
  "Orientation :",
  or
    ? `${or.title} — élève ${or.student.codeMassar}, signature ${or.signature ? or.signature.length + " chars" : "aucune"}`
    : "aucune"
);

const abs = await db.absence.findFirst({ include: { student: true, session: true } });
console.log(
  "Absence :",
  abs ? `élève ${abs.student.codeMassar}, séance ${abs.session.subject} du ${abs.session.date.toISOString().slice(0, 10)}` : "aucune"
);

await db.$disconnect();
