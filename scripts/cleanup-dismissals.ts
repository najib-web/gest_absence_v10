// Nettoyage des dismissals de test (notifications supprimées manuellement
// pendant la vérification E2E). Usage : bun scripts/cleanup-dismissals.ts
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  try {
    const before = await db.attendanceDismissal.count();
    const del = await db.attendanceDismissal.deleteMany({});
    console.log(`AttendanceDismissal supprimés : ${del.count} (avant : ${before})`);
    // Vérifs finales
    const counts = {
      dismissals: await db.attendanceDismissal.count(),
      slots: await db.serviceSlot.count(),
      teachers: await db.teacher.count(),
      students: await db.student.count(),
    };
    console.log("État final :", JSON.stringify(counts));
  } finally {
    await db.$disconnect();
  }
}

main();
