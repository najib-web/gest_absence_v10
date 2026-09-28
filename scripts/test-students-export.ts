// Test : bouton Télécharger (onglet Élèves) = export de la liste complète
// 1) API /api/students fournit toutes les données nécessaires à l'export
// 2) Round-trip : les en-têtes de l'export (FR + AR) sont reconnus par le
//    parseur d'import (src/lib/excel.ts) → le fichier ré-exporté est ré-importable
import * as XLSX from "xlsx";
import { parseStudentExcel } from "../src/lib/excel";

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
  if (!res.ok) throw new Error(`Login ${email} échoué (${res.status})`);
  return (res.headers.get("set-cookie") || "").split(";")[0];
}

// Miroir exact de exportStudents() dans src/components/admin/admin-students.tsx
const HEADERS_FR = ["Code Massar", "Nom", "Prénom", "Nom (arabe)", "Prénom (arabe)", "Téléphone parent", "Classe", "Groupe", "Niveau", "Absences", "Retards", "Non justifiés", "Orientations"];
const HEADERS_AR = ["الرمز المساري", "النسب", "الاسم الشخصي", "النسب بالعربية", "الاسم بالعربية", "هاتف ولي الأمر", "القسم", "المجموعة", "المستوى", "الغيابات", "التأخرات", "غير المبررة", "التوجيهات"];

function buildRow(s: any, isAr: boolean) {
  return [
    s.codeMassar,
    s.lastName,
    s.firstName,
    s.lastNameAr || "",
    s.firstNameAr || "",
    s.parentPhone || "",
    s.classe?.code ?? "",
    s.groupe?.code ?? "",
    s.classe?.niveau ? (isAr ? s.classe.niveau.labelAr : s.classe.niveau.labelFr) : "",
    s.stats.totalAbs,
    s.stats.totalLate,
    s.stats.unjustified,
    s.stats.oriented,
  ];
}

function aoaToBuffer(aoa: any[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Élèves");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function main() {
  // --- 0. Serveur en vie ---
  await fetch(BASE);

  // --- 1. API : la liste complète est servie avec tous les champs de l'export ---
  const cookie = await login("surveillant@edu.ma", "surveillant123");
  const res = await fetch(`${BASE}/api/students`, { headers: { cookie } });
  check("GET /api/students: 200", res.status === 200, `status=${res.status}`);
  const { students } = await res.json();
  check("Liste complète non vide", Array.isArray(students) && students.length > 0, `${students?.length ?? 0} élèves`);
  const s0 = students[0];
  check(
    "Champs export présents (stats, classe.niveau, groupe)",
    !!s0?.stats && "totalAbs" in s0.stats && "unjustified" in s0.stats &&
      "niveau" in (s0?.classe ?? {}) && "labelFr" in (s0?.classe?.niveau ?? {}) && "labelAr" in (s0?.classe?.niveau ?? {}) &&
      "groupe" in s0,
    `élève ${s0?.codeMassar}`
  );

  // --- 2. Round-trip FR : export → parseur d'import ---
  const aoaFr = [HEADERS_FR, ...students.map((s: any) => buildRow(s, false))];
  const parsedFr = parseStudentExcel(aoaToBuffer(aoaFr));
  check("FR: totalRows = élèves exportés", parsedFr.totalRows === students.length, `${parsedFr.totalRows}/${students.length}`);
  const f0 = parsedFr.rows[0];
  check("FR: codeMassar", f0.codeMassar === s0.codeMassar, `${f0.codeMassar} vs ${s0.codeMassar}`);
  check("FR: nom/prénom", f0.lastName === s0.lastName && f0.firstName === s0.firstName, `${f0.lastName} ${f0.firstName}`);
  check("FR: noms arabes", (f0.lastNameAr || "") === (s0.lastNameAr || "") && (f0.firstNameAr || "") === (s0.firstNameAr || ""));
  check("FR: téléphone parent", (f0.parentPhone || "") === (s0.parentPhone || ""), f0.parentPhone || "—");
  check("FR: classe", f0.classeCode === s0.classe.code, `${f0.classeCode} vs ${s0.classe.code}`);
  check("FR: niveau dérivé", !!f0.niveauCode, f0.niveauCode || "—");

  // --- 3. Round-trip AR : même fichier avec en-têtes arabes ---
  const aoaAr = [HEADERS_AR, ...students.map((s: any) => buildRow(s, true))];
  const parsedAr = parseStudentExcel(aoaToBuffer(aoaAr));
  check("AR: totalRows = élèves exportés", parsedAr.totalRows === students.length, `${parsedAr.totalRows}/${students.length}`);
  const a0 = parsedAr.rows[0];
  check("AR: codeMassar/nom/prénom", a0.codeMassar === s0.codeMassar && a0.lastName === s0.lastName && a0.firstName === s0.firstName, `${a0.codeMassar} ${a0.lastName} ${a0.firstName}`);
  check("AR: noms arabes + tél", (a0.lastNameAr || "") === (s0.lastNameAr || "") && (a0.firstNameAr || "") === (s0.firstNameAr || "") && (a0.parentPhone || "") === (s0.parentPhone || ""));
  check("AR: classe", a0.classeCode === s0.classe.code, `${a0.classeCode} vs ${s0.classe.code}`);

  // --- 4. Fidélité sur TOUTES les lignes (FR) ---
  let mismatches = 0;
  for (let i = 0; i < students.length; i++) {
    const p = parsedFr.rows[i];
    const o = students[i];
    if (p.codeMassar !== o.codeMassar || p.classeCode !== o.classe.code) mismatches++;
  }
  check("FR: 100 % des lignes fidèles", mismatches === 0, `${mismatches} écart(s)`);

  console.log(failures === 0 ? "\n✅ Tous les tests passent" : `\n❌ ${failures} échec(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERREUR:", e);
  process.exit(1);
});
