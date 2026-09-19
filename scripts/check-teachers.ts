// Vérifie les noms arabes des enseignants en base
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const teachers = await prisma.teacher.findMany({
    select: { lastName: true, firstName: true, lastNameAr: true, firstNameAr: true },
  });
  for (const t of teachers) {
    console.log(`${t.lastName} ${t.firstName} | AR: ${t.lastNameAr ?? "—"} ${t.firstNameAr ?? "—"}`);
  }
}
main().finally(() => prisma.$disconnect());
