// Smoke test des routes corrigées pour le déploiement Vercel
// 1) /api/templates/{students,teachers,services} → 200 + XLSX valide
// 2) /api/service-slots/export → 200 + XLSX valide (grille)
// 3) buildServiceCellText → format « Classe | Groupe | Enseignant | Matière »
import * as XLSX from "xlsx";
import { buildServiceCellText } from "../src/lib/excel";

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
  if (!res.ok) throw new Error(`Login échoué (${res.status})`);
  return (res.headers.get("set-cookie") || "").split(";")[0];
}

async function main() {
  // 0. Format de buildServiceCellText
  check(
    "buildServiceCellText: classe entière (sans groupe)",
    buildServiceCellText({ classe: "TCSF-1", groupe: null, teacher: "Bennani Ahmed", matiere: "Mathématiques" }) ===
      "TCSF-1 | Bennani Ahmed | Mathématiques",
    buildServiceCellText({ classe: "TCSF-1", groupe: null, teacher: "Bennani Ahmed", matiere: "Mathématiques" })
  );
  check(
    "buildServiceCellText: avec groupe",
    buildServiceCellText({ classe: "TCSF-1", groupe: "G1", teacher: "بناني أحمد", matiere: "الرياضيات" }) ===
      "TCSF-1 | G1 | بناني أحمد | الرياضيات",
    buildServiceCellText({ classe: "TCSF-1", groupe: "G1", teacher: "بناني أحمد", matiere: "الرياضيات" })
  );
  check(
    "buildServiceCellText: groupe vide ignoré",
    buildServiceCellText({ classe: "2BACPC-1", groupe: "  ", teacher: "X Y", matiere: "PC" }) === "2BACPC-1 | X Y | PC"
  );

  // 1-2. Routes HTTP (authentifié surveillant = isStaff)
  const cookie = await login("surveillant@edu.ma", "surveillant123");
  const routes = [
    "/api/templates/students?lang=fr",
    "/api/templates/students?lang=ar",
    "/api/templates/teachers?lang=fr",
    "/api/templates/services?lang=fr",
    "/api/templates/services?lang=ar",
    "/api/service-slots/export?lang=fr",
    "/api/service-slots/export?lang=ar",
  ];
  for (const r of routes) {
    const res = await fetch(`${BASE}${r}`, { headers: { cookie } });
    const buf = await res.arrayBuffer();
    let parsed = false;
    try {
      const wb = XLSX.read(buf, { type: "array" });
      parsed = wb.SheetNames.length > 0;
    } catch {}
    check(`${r} → 200 + XLSX valide`, res.status === 200 && parsed, `${res.status}, ${buf.byteLength} o`);
  }

  // 3. 401 sans cookie (garde isStaff en place)
  const anon = await fetch(`${BASE}/api/service-slots/export`, { headers: {} });
  check("service-slots/export sans session → 401/403", anon.status === 401 || anon.status === 403, `${anon.status}`);

  console.log(failures === 0 ? "\n✅ Tous les tests passent" : `\n❌ ${failures} échec(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERREUR:", e);
  process.exit(1);
});
