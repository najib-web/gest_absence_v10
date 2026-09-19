/**
 * Vérification post-import : comptage par classe + échantillons.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const total = await prisma.student.count();
  const withAr = await prisma.student.count({
    where: { AND: [{ firstNameAr: { not: null } }, { lastNameAr: { not: null } }] },
  });
  const withPhone = await prisma.student.count({ where: { parentPhone: { not: null } } });
  console.log(`Total élèves      : ${total}`);
  console.log(`Noms arabes       : ${withAr}`);
  console.log(`Téléphones parents : ${withPhone}`);

  const classes = await prisma.classe.findMany({
    select: { code: true, niveau: { select: { code: true } }, _count: { select: { students: true } } },
    orderBy: [{ niveau: { order: "asc" } }, { code: "asc" }],
  });
  let sum = 0;
  for (const c of classes) {
    if (c._count.students > 0) {
      console.log(`  ${c.code.padEnd(14)} ${c.niveau.code.padEnd(5)} — ${c._count.students} élèves`);
      sum += c._count.students;
    }
  }
  console.log(`Somme élèves classés: ${sum}`);

  const empty = classes.filter((c) => c._count.students === 0).map((c) => c.code);
  console.log(`Classes vides (hors import): ${empty.join(", ") || "aucune"}`);

  const sample = await prisma.student.findFirst({
    where: { codeMassar: "D155039657" },
    include: { classe: { select: { code: true } } },
  });
  console.log("\nÉchantillon D155039657:", JSON.stringify(sample ? {
    nom: `${sample.lastName} ${sample.firstName}`,
    ar: `${sample.lastNameAr} ${sample.firstNameAr}`,
    classe: sample.classe.code,
  } : null, null as never) || "INTROUVABLE");

  const sample2 = await prisma.student.findFirst({
    where: { codeMassar: "R153046041" },
    select: { firstName: true, lastName: true, firstNameAr: true, lastNameAr: true, classe: { select: { code: true } } },
  });
  console.log("Échantillon R153046041 (prénom composé):", JSON.stringify(sample2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
