/**
 * Test du parseur d'import élèves sur le fichier Massar réel.
 * Vérifie l'association des colonnes (nom/prénom/AR/téléphone).
 */
import * as XLSX from "xlsx";
import * as fs from "fs";
import { parseStudentExcel } from "../src/lib/excel";

const buf = fs.readFileSync("/home/z/my-project/upload/Liste_Eleves_2026-2027.xlsx");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

const { rows, detectedHeaders, totalRows } = parseStudentExcel(ab);

console.log("=== En-têtes détectés ===");
console.log(detectedHeaders);

// Reproduire la détection de colonnes pour diagnostic
const raw = XLSX.utils.sheet_to_json(
  XLSX.read(new Uint8Array(ab), { type: "array" }).Sheets[
    XLSX.read(new Uint8Array(ab), { type: "array" }).SheetNames[0]
  ],
  { header: 1, raw: false, defval: "", blankrows: false }
) as string[][];

const headerKeywords: Record<string, string[]> = {
  codeMassar: ["code massar", "codemassar", "massar", "الرمز المساري", "الرمز"],
  firstNameAr: ["prénom arabe", "prenom arabe", "prénom (arabe)", "prenom (arabe)", "الاسم الشخصي بالعربية", "الاسم بالعربية", "الاسم العربي"],
  lastNameAr: ["nom arabe", "nom (arabe)", "النسب بالعربية", "اللقب بالعربية", "الاسم العائلي بالعربية"],
  parentPhone: ["téléphone parent", "telephone parent", "tel parent", "parent phone", "هاتف ولي الأمر", "هاتف الولي", "رقم هاتف ولي"],
  firstName: ["prénom", "prenom", "nom de famille", "الاسم"],
  lastName: ["nom", "نسب", "النسب"],
  classe: ["classe", "القسم", "section"],
  niveau: ["niveau", "المستوى", "level"],
};

function normalizeHeader(h: string): string {
  return String(h || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function matchHeader(h: string, keys: string[]): boolean {
  const n = normalizeHeader(h);
  return keys.some((k) => n === normalizeHeader(k) || n.includes(normalizeHeader(k)));
}

const header = raw[0];
const map: Record<string, number> = {};
const usedCols = new Set<number>();
for (let c = 0; c < header.length; c++) {
  const h = String(header[c] || "");
  if (!h) continue;
  for (const key of Object.keys(headerKeywords)) {
    if (key in map) continue;
    if (usedCols.has(c)) break;
    if (matchHeader(h, headerKeywords[key])) {
      map[key] = c;
      usedCols.add(c);
      console.log(`col ${c} "${h}" -> ${key}`);
      break;
    }
  }
}

console.log("\n=== 3 premières lignes parsées ===");
for (const r of rows.slice(0, 3)) {
  console.log(JSON.stringify(r));
}

const bad = rows.filter((r) => !r.lastName || !r.firstName).length;
const arOk = rows.filter((r) => r.firstNameAr && r.lastNameAr).length;
console.log(`\nTotal: ${totalRows} | sans lastName: ${bad} | avec AR complets: ${arOk}`);
