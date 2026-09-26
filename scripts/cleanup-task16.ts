// Nettoyage des données de test de la Task 16 (établissements fictifs + rapport test)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Supprimer les orientations de test (rapport MANUEL sur Chraibi + rapport SEUIL de test sur Alam Bilal)
  const chraibi = await db.student.findFirst({ where: { codeMassar: "T900001" } });
  if (chraibi) {
    const o = await db.orientation.deleteMany({ where: { studentId: chraibi.id } });
    console.log("orientations Chraibi supprimées:", o.count);
  }

  // 2. Supprimer les établissements de test LY-TA-002 et LY-HN-003 (avec leur contenu)
  for (const code of ["LY-TA-002", "LY-HN-003"]) {
    const etab = await db.etablissement.findUnique({ where: { code }, include: { users: true } });
    if (!etab) {
      console.log(code, "déjà absent");
      continue;
    }
    const delStudents = await db.student.deleteMany({ where: { etablissementId: etab.id } });
    const delClasses = await db.classe.deleteMany({ where: { etablissementId: etab.id } });
    const delTeachers = await db.teacher.deleteMany({ where: { etablissementId: etab.id } });
    // comptes : ENSEIGNANT supprimés en cascade avec le profil, le reste manuellement
    const delUsers = await db.user.deleteMany({
      where: { etablissementId: etab.id, role: { not: "ENSEIGNANT" } },
    });
    const delEtab = await db.etablissement.delete({ where: { id: etab.id } });
    console.log(
      `${code} supprimé: students=${delStudents.count}, classes=${delClasses.count}, teachers=${delTeachers.count}, users=${delUsers.count}`
    );
  }

  // 3. Supprimer le rapport SEUIL de test créé par le directeur (Alam Bilal, aujourd'hui)
  const testSeuil = await db.orientation.findFirst({
    where: { source: "SEUIL", title: "Rapport d'orientation", createdAt: { gte: new Date(Date.now() - 2 * 3600 * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (testSeuil) {
    await db.orientation.delete({ where: { id: testSeuil.id } });
    console.log("orientation SEUIL de test supprimée:", testSeuil.id.slice(-8));
  }

  // 4. Récap final
  const [etabs, users, teachers, students, classes, orientations] = await Promise.all([
    db.etablissement.count(),
    db.user.count(),
    db.teacher.count(),
    db.student.count(),
    db.classe.count(),
    db.orientation.count(),
  ]);
  const orphans = {
    users: await db.user.count({ where: { etablissementId: null, NOT: { role: "SUPERADMIN" } } }),
    teachers: await db.teacher.count({ where: { etablissementId: null } }),
    students: await db.student.count({ where: { etablissementId: null } }),
    classes: await db.classe.count({ where: { etablissementId: null } }),
  };
  console.log(JSON.stringify({ etabs, users, teachers, students, classes, orientations, orphans }, null, 1));

  // 5. État du compte a.bennani (diagnostic 401 constaté)
  const ab = await db.user.findUnique({ where: { email: "a.bennani@edu.ma" }, select: { email: true, password: true, role: true } });
  console.log("a.bennani:", ab ? `pwd="${ab.password}"` : "absent");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
