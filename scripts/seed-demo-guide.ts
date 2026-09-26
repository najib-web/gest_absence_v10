// Données de démonstration pour le guide enseignant (captures d'écran AR)
// Noms génériques — aucune donnée réelle d'élève (document destiné à la distribution)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Nettoyage...");
  await db.absence.deleteMany();
  await db.orientation.deleteMany();
  await db.session.deleteMany();
  await db.attendanceDismissal.deleteMany();
  await db.serviceSlot.deleteMany();
  await db.serviceTable.deleteMany();
  await db.teacher.deleteMany();
  await db.student.deleteMany();
  await db.groupe.deleteMany();
  await db.classe.deleteMany();
  await db.niveau.deleteMany();
  await db.user.deleteMany();
  await db.etablissement.deleteMany();
  await db.setting.deleteMany();

  console.log("Établissement...");
  const etab = await db.etablissement.create({
    data: {
      code: "ETAB-DEM",
      nameFr: "Lycée Al Massira",
      nameAr: "الثانوية التأهيلية المسيرة",
      arefFr: "Académie Régionale d'Éducation et de Formation — Rabat-Salé-Kénitra",
      arefAr: "الأكاديمية الجهوية للتربية والتكوين لجهة الرباط سلا القنيطرة",
      dpFr: "Direction Provinciale — Rabat",
      dpAr: "المديرية الإقليمية بالرباط",
    },
  });

  console.log("Niveaux + classes...");
  const nTC = await db.niveau.create({
    data: { code: "TC", labelFr: "Tronc Commun", labelAr: "الجذع المشترك", order: 1 },
  });
  const n1B = await db.niveau.create({
    data: { code: "1BAC", labelFr: "1ère Bac", labelAr: "الأولى باك", order: 2 },
  });
  const n2B = await db.niveau.create({
    data: { code: "2BAC", labelFr: "2ème Bac", labelAr: "الثانية باك", order: 3 },
  });

  const cTC = await db.classe.create({
    data: {
      code: "TCSF-1",
      labelFr: "Tronc Commun Sciences — 1",
      labelAr: "الجذع المشترك العلمي 1",
      niveauId: nTC.id,
      etablissementId: etab.id,
      capacity: 40,
    },
  });
  const c1B = await db.classe.create({
    data: {
      code: "1BACSC-1",
      labelFr: "1ère Bac Sciences — 1",
      labelAr: "الأولى باك علوم تجريبية 1",
      niveauId: n1B.id,
      etablissementId: etab.id,
      capacity: 40,
    },
  });
  const c2B = await db.classe.create({
    data: {
      code: "2BACPC-1",
      labelFr: "2ème Bac PC — 1",
      labelAr: "الثانية باك علوم فيزيائية 1",
      niveauId: n2B.id,
      etablissementId: etab.id,
      capacity: 40,
    },
  });

  console.log("Élèves...");
  const prenoms = [
    "يوسف", "مريم", "أحمد", "سلمى", "عمر", "هبة", "ياسين", "خديجة",
    "مهدي", "إيمان", "أنس", "زينب", "رضى", "سارة", "إلياس", "نور",
    "حمزة", "ملاك", "طارق", "أسماء", "بلال", "ريم", "عادل", "شيماء",
    "نبيل", "دعاء", "سفيان", "لبنى", "كريم", "أسيل",
  ];
  const noms = ["العلوي", "بنعيسى", "الإدريسي", "الفاسي", "بنكيران", "الزهراوي", "الموسوي", "الرامي", "بنعمر", "الشرقاوي"];
  const students: { id: string; classeId: string }[] = [];
  let counter = 0;
  const classesPlan: { classeId: string; count: number }[] = [
    { classeId: cTC.id, count: 14 },
    { classeId: c1B.id, count: 8 },
    { classeId: c2B.id, count: 8 },
  ];
  for (const plan of classesPlan) {
    for (let i = 0; i < plan.count; i++) {
      const fn = prenoms[counter % prenoms.length];
      const ln = noms[(counter + i) % noms.length];
      const s = await db.student.create({
        data: {
          codeMassar: `G13${String(1000000 + counter * 7).slice(0, 7)}`,
          firstName: fn, lastName: ln,
          firstNameAr: fn, lastNameAr: ln,
          parentPhone: `06${String(10000000 + counter * 137).slice(0, 8)}`,
          classeId: plan.classeId,
          etablissementId: etab.id,
        },
      });
      students.push({ id: s.id, classeId: plan.classeId });
      counter++;
    }
  }

  console.log("Enseignant démo...");
  const teacherUser = await db.user.create({
    data: {
      email: "prof@edu.ma",
      name: "محمد العلمي",
      password: "enseignant123",
      role: "ENSEIGNANT",
      etablissementId: etab.id,
    },
  });
  const teacher = await db.teacher.create({
    data: {
      userId: teacherUser.id,
      firstName: "محمد", lastName: "العلمي",
      firstNameAr: "محمد", lastNameAr: "العلمي",
      phone: "0661234567",
      matiere: "الرياضيات",
      matiereAr: "الرياضيات",
      ppr: "1254870",
      etablissementId: etab.id,
    },
  });

  // Comptes de base (l'app les recrée sinon — on les crée ici proprement)
  await db.user.create({
    data: { email: "admin@edu.ma", name: "Administration Centrale", password: "admin123", role: "SUPERADMIN" },
  });
  await db.user.create({
    data: { email: "directeur@edu.ma", name: "Le Directeur", password: "directeur123", role: "DIRECTEUR", etablissementId: etab.id },
  });
  await db.user.create({
    data: { email: "surveillant@edu.ma", name: "الحيال العام", password: "surveillant123", role: "SURVEILLANT", etablissementId: etab.id },
  });

  console.log("Tables de service + créneaux du jour...");
  const SUBJECT = "الرياضيات";
  await db.serviceTable.create({
    data: { teacherId: teacher.id, classeId: cTC.id, subject: SUBJECT, subjectAr: SUBJECT, hoursPerWeek: 4 },
  });
  await db.serviceTable.create({
    data: { teacherId: teacher.id, classeId: c1B.id, subject: SUBJECT, subjectAr: SUBJECT, hoursPerWeek: 4 },
  });
  await db.serviceTable.create({
    data: { teacherId: teacher.id, classeId: c2B.id, subject: SUBJECT, subjectAr: SUBJECT, hoursPerWeek: 6 },
  });

  // Créneaux autour de l'heure UTC actuelle (navigateur sandbox = UTC)
  const now = new Date();
  const dow = now.getUTCDay() === 0 ? 6 : now.getUTCDay(); // dimanche→non scolaire ; sinon index
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const past = [Math.max(nowMin - 240, 480), Math.max(nowMin - 60, 600)];
  const current = [nowMin - 40, nowMin + 140];
  const future = [Math.min(nowMin + 180, 1020), Math.min(nowMin + 300, 1140)];

  const slotPast = await db.serviceSlot.create({
    data: { teacherId: teacher.id, dayOfWeek: dow, startMin: past[0], endMin: past[1], classeId: cTC.id, subject: SUBJECT, subjectAr: SUBJECT },
  });
  const slotCurrent = await db.serviceSlot.create({
    data: { teacherId: teacher.id, dayOfWeek: dow, startMin: current[0], endMin: current[1], classeId: c2B.id, subject: SUBJECT, subjectAr: SUBJECT },
  });
  const slotFuture = await db.serviceSlot.create({
    data: { teacherId: teacher.id, dayOfWeek: dow, startMin: future[0], endMin: future[1], classeId: c1B.id, subject: SUBJECT, subjectAr: SUBJECT },
  });
  console.log(`DOW=${dow} past=${past} current=${current} future=${future}`);

  console.log("Séance passée : appel déjà fait (2 absents, 1 retard)...");
  const pastSession = await db.session.create({
    data: {
      teacherId: teacher.id,
      classeId: cTC.id,
      subject: SUBJECT,
      subjectAr: SUBJECT,
      date: new Date(now.getTime() - 3 * 3600 * 1000),
      attendanceDone: true,
      attendanceAt: new Date(now.getTime() - 2.5 * 3600 * 1000),
    },
  });
  const tcStudents = students.filter((s) => s.classeId === cTC.id);
  await db.absence.create({ data: { studentId: tcStudents[2].id, sessionId: pastSession.id, status: "ABSENT", justified: true, reason: "شهادة طبية" } });
  await db.absence.create({ data: { studentId: tcStudents[5].id, sessionId: pastSession.id, status: "ABSENT" } });
  await db.absence.create({ data: { studentId: tcStudents[8].id, sessionId: pastSession.id, status: "RETARD" } });

  console.log("Terminé.");
  console.log({ etab: etab.id, teacher: teacher.id, slots: [slotPast.id, slotCurrent.id, slotFuture.id] });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
