// Task 24 — aligne les créneaux de démo sur mardi (dow=2) pour les captures du guide bilingue.
// Le navigateur de capture tourne avec TZ=Australia/Darwin (UTC+9:30) : il sera ~08:15 mardi.
// Créneaux : 08:00-10:00 (séance en cours + rappel), 12:00-13:30, 14:30-16:00 (grille hebdo naturelle).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const slots = await db.serviceSlot.findMany({ orderBy: { startMin: "asc" } });
  if (slots.length !== 3) throw new Error(`3 slots attendus, trouvé ${slots.length}`);
  await db.serviceSlot.update({ where: { id: slots[0].id }, data: { dayOfWeek: 2, startMin: 480, endMin: 600 } }); // mar. 08:00-10:00
  await db.serviceSlot.update({ where: { id: slots[1].id }, data: { dayOfWeek: 2, startMin: 720, endMin: 810 } }); // mar. 12:00-13:30
  await db.serviceSlot.update({ where: { id: slots[2].id }, data: { dayOfWeek: 2, startMin: 870, endMin: 960 } }); // mar. 14:30-16:00
  console.log("Slots ajustés : dow=2, 08:00-10:00 / 12:00-13:30 / 14:30-16:00");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
