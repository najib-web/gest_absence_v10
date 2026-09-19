// Migration : crée l'établissement par défaut (si nécessaire) et rattache
// toutes les données existantes (users, teachers, students, classes) à cet
// établissement — héritage AREF + DP.
// Usage : DATABASE_URL="postgresql://..." bun scripts/migrate-etablissements.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  let etab = await db.etablissement.findFirst({ orderBy: { createdAt: "asc" } });
  if (!etab) {
    etab = await db.etablissement.create({
      data: {
        code: "ETAB-001",
        nameFr: "Établissement Scolaire",
        nameAr: "المؤسسة التعليمية",
        arefFr: "Académie Régionale d'Éducation et de Formation",
        arefAr: "الأكاديمية الجهوية للتربية والتكوين",
        dpFr: "Direction Provinciale",
        dpAr: "المديرية الإقليمية",
      },
    });
    console.log("Établissement par défaut créé:", etab.code, etab.id);
  } else {
    console.log("Établissement existant:", etab.code, etab.id);
  }

  const users = await db.user.updateMany({
    where: { etablissementId: null, NOT: { role: "SUPERADMIN" } },
    data: { etablissementId: etab.id },
  });
  const teachers = await db.teacher.updateMany({
    where: { etablissementId: null },
    data: { etablissementId: etab.id },
  });
  const students = await db.student.updateMany({
    where: { etablissementId: null },
    data: { etablissementId: etab.id },
  });
  const classes = await db.classe.updateMany({
    where: { etablissementId: null },
    data: { etablissementId: etab.id },
  });

  console.log(`Rattachés à ${etab.code}: users=${users.count}, teachers=${teachers.count}, students=${students.count}, classes=${classes.count}`);

  const remain = {
    users: await db.user.count({ where: { etablissementId: null, NOT: { role: "SUPERADMIN" } } }),
    teachers: await db.teacher.count({ where: { etablissementId: null } }),
    students: await db.student.count({ where: { etablissementId: null } }),
    classes: await db.classe.count({ where: { etablissementId: null } }),
  };
  console.log("Restants sans établissement:", remain);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
