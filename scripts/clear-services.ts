// Vide les ServiceSlots + ServiceTables pour tester la création automatique depuis la grille
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  const slots = await prisma.serviceSlot.deleteMany({});
  const tables = await prisma.serviceTable.deleteMany({});
  console.log(`Supprimés : ${slots.count} créneaux, ${tables.count} tables de service`);
}
main().finally(() => prisma.$disconnect());
