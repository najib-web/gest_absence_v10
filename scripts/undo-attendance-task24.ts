// Task 24 — repasse la séance du jour du prof démo en « appel non fait » pour regénérer le toast de rappel.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const teacher = await db.teacher.findFirst({ where: { user: { email: "prof@edu.ma" } } });
  if (!teacher) throw new Error("prof@edu.ma introuvable");
  const res = await db.session.updateMany({ where: { teacherId: teacher.id, attendanceDone: false }, data: { attendanceDone: true } });
  console.log(`Séances repassées en appel-non-fait : ${res.count}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
