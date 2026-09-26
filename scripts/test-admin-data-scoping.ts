// Test E2E : la Gestion des Données est strictement limitée à l'établissement
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get("set-cookie") || "";
  return cookie.split(";")[0];
}

async function getData(cookie: string) {
  const res = await fetch(`${BASE}/api/admin/data`, { headers: { cookie } });
  return { status: res.status, body: await res.json() };
}

async function postData(cookie: string, payload: object) {
  const res = await fetch(`${BASE}/api/admin/data`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  // --- 0. Serveur en vie ---
  await fetch(BASE);

  // --- 1. Établissement B avec données propres ---
  const etabA = await db.etablissement.findFirst({ where: { code: "ETAB-DEM" } });
  const etabB = await db.etablissement.upsert({
    where: { code: "ETAB-TEST-B" },
    create: {
      code: "ETAB-TEST-B",
      nameFr: "Collège Al Amal (test)",
      nameAr: "إعدادية الأمل (اختبار)",
      arefFr: "AREF test", arefAr: "أكاديمية اختبار",
      dpFr: "DP test", dpAr: "مديرية اختبار",
    },
    update: {},
  });
  const niv = await db.niveau.findFirstOrThrow();
  const dirB = await db.user.upsert({
    where: { email: "dirb@edu.ma" },
    create: { email: "dirb@edu.ma", name: "Directeur B", password: "directeur123", role: "DIRECTEUR", etablissementId: etabB.id },
    update: { etablissementId: etabB.id, role: "DIRECTEUR" },
  });
  const oldB = await db.classe.findFirst({ where: { code: "TESTB-1" } });
  if (oldB) await db.classe.delete({ where: { id: oldB.id } }); // cascade
  const classeB = await db.classe.create({
    data: { code: "TESTB-1", labelFr: "Test B 1", labelAr: "اختبار ب 1", niveauId: niv.id, etablissementId: etabB.id },
  });
  await db.student.create({
    data: { codeMassar: "TESTB00001", firstName: "TestB", lastName: "ElèveB", classeId: classeB.id, etablissementId: etabB.id },
  });
  const oldA = await db.classe.findFirst({ where: { code: "TESTA-1" } });
  if (oldA) await db.classe.delete({ where: { id: oldA.id } });
  const classeA = await db.classe.create({
    data: { code: "TESTA-1", labelFr: "Test A 1", labelAr: "اختبار أ 1", niveauId: niv.id, etablissementId: etabA!.id },
  });
  await db.student.create({
    data: { codeMassar: "TESTA00001", firstName: "TestA", lastName: "ElèveA", classeId: classeA.id, etablissementId: etabA!.id },
  });

  // --- 2. GET : chaque staff ne voit que son établissement ---
  const ckA = await login("surveillant@edu.ma", "surveillant123");
  const gA = await getData(ckA);
  check("GET A: 200 + établissement A", gA.status === 200 && gA.body.etablissement?.code === "ETAB-DEM", `code=${gA.body.etablissement?.code}`);
  check("GET A: comptes élèves = 31 (30 démo + 1 testA)", gA.body.counts?.students === 31, `students=${gA.body.counts?.students}`);
  check("GET A: classes = 4 (3 démo + 1 testA)", gA.body.counts?.classes === 4, `classes=${gA.body.counts?.classes}`);

  const ckB = await login("dirb@edu.ma", "directeur123");
  const gB = await getData(ckB);
  check("GET B: 200 + établissement B", gB.status === 200 && gB.body.etablissement?.code === "ETAB-TEST-B", `code=${gB.body.etablissement?.code}`);
  check("GET B: élèves = 1", gB.body.counts?.students === 1, `students=${gB.body.counts?.students}`);
  check("GET B: classes = 1", gB.body.counts?.classes === 1, `classes=${gB.body.counts?.classes}`);
  check("GET B: enseignants = 0", gB.body.counts?.teachers === 0, `teachers=${gB.body.counts?.teachers}`);

  // --- 3. Portée « niveaux » refusée ---
  const pNiv = await postData(ckA, { scope: "niveaux" });
  check("POST A scope=niveaux → 400", pNiv.status === 400, JSON.stringify(pNiv.body));

  // --- 4. Purge élèves par B : n'affecte pas A ---
  const pB = await postData(ckB, { scope: "students" });
  check("POST B scope=students: 1 supprimé", pB.status === 200 && pB.body.deleted?.students === 1, JSON.stringify(pB.body.deleted));
  const gA2 = await getData(ckA);
  check("GET A après purge B: élèves toujours 31", gA2.body.counts?.students === 31, `students=${gA2.body.counts?.students}`);

  // --- 5. Vider tout par B : uniquement ses données ---
  const pAll = await postData(ckB, { scope: "all", confirm: "VIDER" });
  check("POST B scope=all: OK", pAll.status === 200, JSON.stringify(pAll.body).slice(0, 120));
  check("all B: 1 classe supprimée", pAll.body.deleted?.classes === 1, `classes=${pAll.body.deleted?.classes}`);
  const gA3 = await getData(ckA);
  check("GET A après all B: élèves 31", gA3.body.counts?.students === 31, `students=${gA3.body.counts?.students}`);
  check("GET A après all B: classes 4", gA3.body.counts?.classes === 4, `classes=${gA3.body.counts?.classes}`);
  check("GET A après all B: enseignants 1", gA3.body.counts?.teachers === 1, `teachers=${gA3.body.counts?.teachers}`);
  const gB2 = await getData(ckB);
  check("GET B après all B: tout à 0 (sauf users)", gB2.body.counts?.students === 0 && gB2.body.counts?.classes === 0, JSON.stringify(gB2.body.counts));
  const nivCount = await db.niveau.count();
  check("Niveaux intacts = 3", nivCount === 3, `niveaux=${nivCount}`);
  const dirBAlive = await db.user.findUnique({ where: { email: "dirb@edu.ma" } });
  check("Compte directeur B conservé", !!dirBAlive);
  const surAAlive = await db.user.findUnique({ where: { email: "surveillant@edu.ma" } });
  check("Compte surveillant A conservé", !!surAAlive);

  // --- 6. Confirmation VIDER obligatoire ---
  const pNoConfirm = await postData(ckA, { scope: "all" });
  check("POST A scope=all sans VIDER → 400", pNoConfirm.status === 400, JSON.stringify(pNoConfirm.body));

  // --- 7. Nettoyage des données de test ---
  await db.student.deleteMany({ where: { codeMassar: { in: ["TESTA00001"] } } });
  await db.classe.deleteMany({ where: { code: { in: ["TESTA-1", "TESTB-1"] } } });
  await db.etablissement.delete({ where: { id: etabB.id } });
  await db.user.delete({ where: { email: "dirb@edu.ma" } });
  console.log("Nettoyage: établissement B + données de test supprimés");

  console.log(failures === 0 ? "\nTOUS LES TESTS PASSENT" : `\n${failures} ÉCHEC(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
