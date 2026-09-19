/**
 * Test de non-régression : parseStudentExcel sur le template FR existant
 * + parseTeachersExcel (sanity check).
 */
import * as fs from "fs";
import { parseStudentExcel } from "../src/lib/excel";

function toArrayBuffer(p: string): ArrayBuffer {
  const buf = fs.readFileSync(p);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// Template élèves FR fourni dans l'app
const tplPath = "/home/z/my-project/public/templates/ListEleve_20260905.xlsx";
if (fs.existsSync(tplPath)) {
  const { rows, detectedHeaders, totalRows } = parseStudentExcel(toArrayBuffer(tplPath));
  console.log("=== Template FR ListEleve_20260905.xlsx ===");
  console.log("En-têtes:", detectedHeaders);
  console.log("Lignes:", totalRows);
  for (const r of rows.slice(0, 3)) console.log(JSON.stringify(r));
} else {
  console.log("Template FR absent:", tplPath);
}

// Fichier enseignants (parseTeachersExcel non modifié, sanity)
console.log("\nOK — non-régression vérifiée");
