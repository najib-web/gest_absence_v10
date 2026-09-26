// Ajuste les créneaux de démo à des heures rondes (captures naturelles)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const now = new Date();
  const dow = now.getUTCDay() === 0 ? 6 : now.getUTCDay();
  const slots = await db.serviceSlot.findMany({ orderBy: { startMin: "asc" } });
  if (slots.length !== 3) throw new Error(`3 slots attendus, trouvé ${slots.length}`);
  await db.serviceSlot.update({ where: { id: slots[0].id }, data: { dayOfWeek: dow, startMin: 480, endMin: 600 } }); // 08:00-10:00
  await db.serviceSlot.update({ where: { id: slots[1].id }, data: { dayOfWeek: dow, startMin: 720, endMin: 810 } }); // 12:00-13:30
  await db.serviceSlot.update({ where: { id: slots[2].id }, data: { dayOfWeek: dow, startMin: 870, endMin: 960 } }); // 14:30-16:00
  console.log(`Slots ajustés : dow=${dow}, 08:00-10:00 / 12:00-13:30 / 14:30-16:00 (maintenant ${now.toISOString()})`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
