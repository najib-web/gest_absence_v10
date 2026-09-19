/**
 * État actuel de la base avant import : élèves, classes, niveaux.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const [students, classes, niveaux, absences, orientations] = await Promise.all([
    prisma.student.count(),
    prisma.classe.count(),
    prisma.niveau.count(),
    prisma.absence.count(),
    prisma.orientation.count(),
  ]);
  console.log(`Élèves: ${students} | Classes: ${classes} | Niveaux: ${niveaux} | Absences: ${absences} | Orientations: ${orientations}`);

  const niveauxList = await prisma.niveau.findMany({
    select: { code: true, labelFr: true, _count: { select: { classes: true } } },
  });
  console.log("\nNiveaux existants:");
  for (const n of niveauxList) console.log(`  ${n.code} — ${n.labelFr} (${n._count.classes} classes)`);

  const classesList = await prisma.classe.findMany({
    select: { code: true, labelFr: true, niveau: { select: { code: true } }, _count: { select: { students: true } } },
    orderBy: { code: "asc" },
  });
  console.log(`\nClasses existantes (${classesList.length}):`);
  for (const c of classesList) console.log(`  ${c.code.padEnd(14)} ${c.niveau.code.padEnd(5)} — ${c._count.students} élèves`);

  const sampleStudents = await prisma.student.findMany({
    take: 10,
    select: { codeMassar: true, firstName: true, lastName: true, classe: { select: { code: true } } },
  });
  console.log("\nÉchantillon élèves existants:");
  for (const s of sampleStudents) console.log(`  ${s.codeMassar} ${s.firstName} ${s.lastName} [${s.classe?.code}]`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
