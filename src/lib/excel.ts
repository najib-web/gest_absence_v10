import * as XLSX from "xlsx";

export interface ParsedStudentRow {
  codeMassar: string;
  firstName: string;
  lastName: string;
  firstNameAr?: string;
  lastNameAr?: string;
  parentPhone?: string;
  classeCode: string;
  niveauCode?: string;
}

// ============
// Shared helpers
// ============

/** Lowercase, trim, collapse spaces, remove latin accents (Arabic unchanged).
 * Note : NFD décompose aussi les lettres arabes avec hamza (أ → ا + U+0654).
 * On retire donc également les signes diacritiques arabes (harakat + marques
 * de hamza U+064B-U+0655, U+0670) pour que « الأربعاء » matche « الاربعاء ». */
export function deaccent(s: string): string {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u0655\u0670\u0640]/g, "");
}

interface ColSpec {
  keys: string[];
  exclude?: string[];
}

/**
 * Detect column indexes from a header row.
 * For each column, the best-scoring field wins (exact=3, startsWith=2, includes=1).
 * Each field is assigned at most one column, each column at most one field.
 */
export function detectColumns(
  headers: string[],
  spec: Record<string, ColSpec>
): Record<string, number> {
  const map: Record<string, number> = {};
  const usedCols = new Set<number>();
  const scored: { field: string; col: number; score: number }[] = [];

  for (let c = 0; c < headers.length; c++) {
    const h = deaccent(headers[c]);
    if (!h) continue;
    for (const field of Object.keys(spec)) {
      const { keys, exclude } = spec[field];
      if (exclude?.some((k) => h.includes(deaccent(k)))) continue;
      for (const k of keys) {
        const nk = deaccent(k);
        if (!nk) continue;
        let score = 0;
        if (h === nk) score = 3;
        else if (h.startsWith(nk)) score = 2;
        else if (h.includes(nk)) score = 1;
        if (score > 0) scored.push({ field, col: c, score });
      }
    }
  }

  // Best scores first; ties resolved by declaration order of fields
  scored.sort(
    (a, b) => b.score - a.score || Object.keys(spec).indexOf(a.field) - Object.keys(spec).indexOf(b.field)
  );
  for (const s of scored) {
    if (s.field in map || usedCols.has(s.col)) continue;
    map[s.field] = s.col;
    usedCols.add(s.col);
  }
  return map;
}

/** Parse "08:00", "8h", "8h30", "8", "8:30" → minutes since midnight (or null). */
export function parseTimeToMinutes(s: string): number | null {
  const t = String(s || "").trim().toLowerCase().replace(/\s/g, "");
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[:h.]?(\d{2})?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] !== undefined ? parseInt(m[2], 10) : 0;
  if (h < 0 || h > 23 || min > 59) return null;
  return h * 60 + min;
}

const DAY_ALIASES: Record<string, number> = {
  lundi: 1, lun: 1, monday: 1, mon: 1, "الاثنين": 1, "الأثنين": 1, "اثنين": 1,
  mardi: 2, mar: 2, tuesday: 2, tue: 2, "الثلاثاء": 2, "ثلاثاء": 2,
  mercredi: 3, mer: 3, wednesday: 3, wed: 3, "الأربعاء": 3, "الاربعاء": 3, "أربعاء": 3,
  jeudi: 4, jeu: 4, thursday: 4, thu: 4, "الخميس": 4, "خميس": 4,
  vendredi: 5, ven: 5, friday: 5, fri: 5, "الجمعة": 5, "الجمعه": 5, "جمعة": 5,
  samedi: 6, sam: 6, saturday: 6, sat: 6, "السبت": 6, "سبت": 6,
};

/** Parse "Lundi", "lun", "Monday", "الاثنين", "1" → day of week 1..6 (or null). */
export function parseDayOfWeek(s: string): number | null {
  const t = deaccent(String(s || ""));
  if (/^[1-6]$/.test(t)) return parseInt(t, 10);
  return DAY_ALIASES[t] ?? null;
}

/** Read an uploaded file buffer as a 2D array (handles .xlsx/.xls/.csv, FR ";" or "," separators). */
function readSheetRows(buffer: ArrayBuffer): any[][] {
  const bytes = new Uint8Array(buffer);
  // XLSX/XLS files start with the "PK" / OLE magic bytes → binary workbook
  const isBinary =
    (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) ||
    (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf);

  if (isBinary) {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetName = wb.SheetNames[0];
    return sheetName
      ? (XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        }) as any[][])
      : [];
  }

  // CSV as text — handle BOM and French semicolon separators
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.split(/\r?\n/)[0] || "";
  if (firstLine.includes(";") && !firstLine.includes(",")) {
    text = text.replace(/;/g, ",");
  }
  const wb = XLSX.read(text, { type: "string" });
  const sheetName = wb.SheetNames[0];
  return sheetName
    ? (XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      }) as any[][])
    : [];
}

// ============
// Grille hebdomadaire (export + modèles)
// ============

/**
 * Contenu d'une case de la grille horaire hebdomadaire :
 * « Classe | Groupe | Enseignant | Matière » — le groupe est omis lorsque la
 * séance concerne la classe entière. Format documenté dans l'onglet « Notice »
 * du modèle services (cf. /api/templates/services).
 */
export function buildServiceCellText(opts: {
  classe: string;
  groupe?: string | null;
  teacher: string;
  matiere: string;
}): string {
  return [opts.classe, opts.groupe?.trim() || "", opts.teacher, opts.matiere]
    .filter((part) => part !== "")
    .join(" | ");
}

// ============
// Teachers import
// ============

export interface ParsedTeacherRow {
  firstName: string;
  lastName: string;
  matiere: string;
  ppr?: string;
  firstNameAr?: string;
  lastNameAr?: string;
  phone?: string;
  email?: string;
  password?: string;
}

/**
 * Parse an Excel/CSV file containing the teachers list.
 * Expected columns (any order, FR or AR):
 *  - PPR / Matricule                     (optional)
 *  - Nom / النسب                         (required)
 *  - Prénom / الاسم                      (required)
 *  - Nom (arabe) / النسب بالعربية        (optional)
 *  - Prénom (arabe) / الاسم بالعربية     (optional)
 *  - Téléphone / الهاتف                  (optional)
 *  - Matière / المادة                    (required)
 *  - Email / البريد                      (optional — auto-generated if missing)
 *  - Mot de passe / كلمة المرور          (optional — default applied if missing)
 */
export function parseTeachersExcel(buffer: ArrayBuffer): {
  rows: ParsedTeacherRow[];
  detectedHeaders: string[];
  totalRows: number;
} {
  const raw = readSheetRows(buffer);
  if (raw.length === 0) return { rows: [], detectedHeaders: [], totalRows: 0 };

  const spec: Record<string, ColSpec> = {
    ppr: { keys: ["ppr", "matricule", "ن.ب.م"] },
    firstName: { keys: ["prénom", "prenom", "first name", "الاسم"], exclude: ["arabe", "بالعربية"] },
    lastName: { keys: ["nom", "last name", "family name", "النسب", "لقب", "الاسم العائلي"], exclude: ["prénom", "prenom", "first", "arabe", "بالعربية"] },
    firstNameAr: { keys: ["prénom arabe", "prenom arabe", "prénom (arabe)", "prenom (arabe)", "الاسم الشخصي بالعربية", "الاسم بالعربية", "الاسم العربي"] },
    lastNameAr: { keys: ["nom arabe", "nom (arabe)", "النسب بالعربية", "اللقب بالعربية", "النسب العربي", "الاسم العائلي بالعربية"] },
    phone: { keys: ["téléphone", "telephone", "tel", "phone", "mobile", "gsm", "الهاتف", "رقم الهاتف"], exclude: ["parent", "ولي", "والد"] },
    matiere: { keys: ["matière", "matiere", "subject", "المادة", "تخصص"] },
    email: { keys: ["email", "e-mail", "mail", "courriel", "البريد"] },
    password: { keys: ["password", "mot de passe", "pass", "كلمة المرور"] },
  };

  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const headers = raw[i].map((h) => String(h || ""));
    const map = detectColumns(headers, spec);
    if (("lastName" in map || "firstName" in map) && "matiere" in map) {
      headerRowIdx = i;
      colMap = map;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Fallback: fixed layout A=Nom, B=Prénom, C=Matière, D=Email, E=Mot de passe
    colMap = { lastName: 0, firstName: 1, matiere: 2, email: 3, password: 4 };
    headerRowIdx = -1;
  }

  const detectedHeaders =
    headerRowIdx >= 0
      ? raw[headerRowIdx].map((h) => String(h || ""))
      : ["Nom", "Prénom", "Matière", "Email", "Mot de passe"];

  const dataRows = headerRowIdx >= 0 ? raw.slice(headerRowIdx + 1) : raw;
  const rows: ParsedTeacherRow[] = [];

  const pick = (r: any[], field: string): string => {
    const idx = colMap[field];
    return idx !== undefined ? String(r[idx] ?? "").trim() : "";
  };

  for (const r of dataRows) {
    const firstName = pick(r, "firstName");
    const lastName = pick(r, "lastName");
    const matiere = pick(r, "matiere");
    if (!firstName && !lastName && !matiere) continue; // fully empty row
    const ppr = pick(r, "ppr");
    const firstNameAr = pick(r, "firstNameAr");
    const lastNameAr = pick(r, "lastNameAr");
    const phone = pick(r, "phone");
    const email = pick(r, "email");
    const password = pick(r, "password");
    rows.push({
      firstName,
      lastName,
      matiere,
      ppr: ppr || undefined,
      firstNameAr: firstNameAr || undefined,
      lastNameAr: lastNameAr || undefined,
      phone: phone || undefined,
      email: email || undefined,
      password: password || undefined,
    });
  }

  return { rows, detectedHeaders, totalRows: rows.length };
}

// ============
// Service tables import (CSV / Excel)
// ============

export interface ParsedServiceRow {
  day: number | null; // 1..6 resolved, null if invalid
  dayRaw: string;
  startMin: number | null;
  endMin: number | null;
  classeCode: string;
  groupeCode: string; // "" = whole class
  teacherName: string;
  matiere: string;
}

/**
 * Parse a CSV/Excel file containing the weekly service tables.
 * Expected columns (any order, FR or AR):
 *  - Jour / اليوم                     (Lundi..Samedi, abbreviations, EN, AR or 1-6)
 *  - Heure début / Heure fin          ("08:00", "8h", "8"…) — or a combined "Créneau" column ("08:00-10:00")
 *  - Classe / القسم                   (required)
 *  - Groupe / المجموعة                (optional)
 *  - Enseignant / الأستاذ             ("Nom Prénom")
 *  - Matière / المادة
 */
export function parseServiceFile(buffer: ArrayBuffer): {
  rows: ParsedServiceRow[];
  detectedHeaders: string[];
  totalRows: number;
} {
  const raw = readSheetRows(buffer);
  if (raw.length === 0) return { rows: [], detectedHeaders: [], totalRows: 0 };

  const spec: Record<string, ColSpec> = {
    day: { keys: ["jour", "day", "اليوم"] },
    startMin: { keys: ["heure début", "heure debut", "début", "debut", "start", "الوقت من", "بداية", "من الساعة"] },
    endMin: { keys: ["heure fin", "fin", "end", "الوقت إلى", "نهاية", "إلى الساعة"] },
    creneau: { keys: ["créneau", "creneau", "plage horaire", "plage", "slot", "فترة زمنية", "الفترة"] },
    classe: { keys: ["classe", "class", "القسم", "section"] },
    groupe: { keys: ["groupe", "group", "المجموعة"] },
    teacher: { keys: ["enseignant", "professeur", "prof", "teacher", "الأستاذ", "الاستاذ"] },
    matiere: { keys: ["matière", "matiere", "subject", "المادة"] },
  };

  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const headers = raw[i].map((h) => String(h || ""));
    const map = detectColumns(headers, spec);
    if ("day" in map && "classe" in map && "teacher" in map) {
      headerRowIdx = i;
      colMap = map;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Fallback: fixed layout A=Jour, B=Heure début, C=Heure fin, D=Classe, E=Groupe, F=Enseignant, G=Matière
    colMap = { day: 0, startMin: 1, endMin: 2, classe: 3, groupe: 4, teacher: 5, matiere: 6 };
    headerRowIdx = -1;
  }

  const detectedHeaders =
    headerRowIdx >= 0
      ? raw[headerRowIdx].map((h) => String(h || ""))
      : ["Jour", "Heure début", "Heure fin", "Classe", "Groupe", "Enseignant", "Matière"];

  const dataRows = headerRowIdx >= 0 ? raw.slice(headerRowIdx + 1) : raw;
  const rows: ParsedServiceRow[] = [];

  for (const r of dataRows) {
    const dayRaw = colMap.day !== undefined ? String(r[colMap.day] ?? "").trim() : "";
    let startStr = colMap.startMin !== undefined ? String(r[colMap.startMin] ?? "").trim() : "";
    let endStr = colMap.endMin !== undefined ? String(r[colMap.endMin] ?? "").trim() : "";
    const creneauRaw = colMap.creneau !== undefined ? String(r[colMap.creneau] ?? "").trim() : "";
    // Combined "Créneau" column: "08:00-10:00", "08:00 – 10:00", "08:00 à 10:00"
    if ((!startStr || !endStr) && creneauRaw) {
      const parts = creneauRaw.split(/\s*(?:[-–—>]|à|→)\s*/).filter(Boolean);
      if (parts.length >= 2) {
        if (!startStr) startStr = parts[0];
        if (!endStr) endStr = parts[parts.length - 1];
      }
    }
    const classeCode = colMap.classe !== undefined ? String(r[colMap.classe] ?? "").trim() : "";
    const groupeCode = colMap.groupe !== undefined ? String(r[colMap.groupe] ?? "").trim() : "";
    const teacherName = colMap.teacher !== undefined
      ? String(r[colMap.teacher] ?? "").trim().replace(/,/g, " ").replace(/\s+/g, " ")
      : "";
    const matiere = colMap.matiere !== undefined ? String(r[colMap.matiere] ?? "").trim() : "";

    if (!dayRaw && !startStr && !endStr && !classeCode && !teacherName && !matiere) continue;

    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);

    rows.push({
      day: parseDayOfWeek(dayRaw),
      dayRaw,
      startMin,
      endMin,
      classeCode,
      groupeCode: groupeCode === "-" ? "" : groupeCode,
      teacherName,
      matiere,
    });
  }

  return { rows, detectedHeaders, totalRows: rows.length };
}

/**
 * Parse an Excel/CSV file containing the Massar student list.
 * Expected columns (any order, headers can be in FR or AR):
 *  - Code Massar / الرمز المساري
 *  - Nom / النسب
 *  - Prénom / الاسم
 *  - Nom (arabe) / النسب بالعربية        (optional)
 *  - Prénom (arabe) / الاسم بالعربية     (optional)
 *  - Téléphone parent / هاتف ولي الأمر   (optional)
 *  - Classe / القسم
 *  - Niveau / المستوى (optional)
 *
 * Returns the rows found and the detected headers.
 */
export function parseStudentExcel(buffer: ArrayBuffer): {
  rows: ParsedStudentRow[];
  detectedHeaders: string[];
  totalRows: number;
} {
  const raw = readSheetRows(buffer);
  if (raw.length === 0) return { rows: [], detectedHeaders: [], totalRows: 0 };

  // Header detection — find the row that contains a Massar-like column.
  // Order matters: the most specific keys (arabic names, parent phone) must be
  // tested before the generic ones (Nom / Prénom) — each column is used once.
  // Massar exports use « الاسم العائلي / الاسم الشخصي » (± « بالعربية ») — the
  // generic « الاسم » key would swallow the family-name column, hence the
  // specific keys + exclude lists.
  const headerKeywords: Record<string, { keys: string[]; exclude?: string[] }> = {
    codeMassar: { keys: ["code massar", "codemassar", "massar", "الرمز المساري", "الرمز"] },
    firstNameAr: { keys: ["prénom arabe", "prenom arabe", "prénom (arabe)", "prenom (arabe)", "الاسم الشخصي بالعربية", "الاسم بالعربية", "الاسم العربي"] },
    lastNameAr: { keys: ["nom arabe", "nom (arabe)", "النسب بالعربية", "اللقب بالعربية", "الاسم العائلي بالعربية"] },
    parentPhone: { keys: ["téléphone parent", "telephone parent", "tel parent", "parent phone", "هاتف ولي الأمر", "هاتف الولي", "رقم هاتف ولي"] },
    firstName: { keys: ["prénom", "prenom", "first name", "الاسم الشخصي", "الاسم"], exclude: ["العائلي", "بالعربية", "arabe"] },
    lastName: { keys: ["nom", "النسب", "الاسم العائلي", "لقب", "last name", "family name"], exclude: ["الشخصي", "بالعربية", "arabe", "prénom", "prenom"] },
    classe: { keys: ["classe", "القسم", "section"] },
    niveau: { keys: ["niveau", "المستوى", "level"] },
  };

  function normalizeHeader(h: string): string {
    return String(h || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function matchHeader(h: string, field: { keys: string[]; exclude?: string[] }): boolean {
    const n = normalizeHeader(h);
    if (field.exclude?.some((k) => n.includes(normalizeHeader(k)))) return false;
    return field.keys.some((k) => n === normalizeHeader(k) || n.includes(normalizeHeader(k)));
  }

  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const row = raw[i];
    const map: Record<string, number> = {};
    const usedCols = new Set<number>();
    for (let c = 0; c < row.length; c++) {
      const h = String(row[c] || "");
      if (!h) continue;
      for (const key of Object.keys(headerKeywords)) {
        if (key in map) continue;
        if (usedCols.has(c)) break;
        if (matchHeader(h, headerKeywords[key as keyof typeof headerKeywords])) {
          map[key] = c;
          usedCols.add(c);
          break;
        }
      }
    }
    // We need at least codeMassar + name + classe
    if ("codeMassar" in map && "classe" in map && ("firstName" in map || "lastName" in map || "firstNameAr" in map || "lastNameAr" in map)) {
      headerRowIdx = i;
      colMap = map;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Fallback: assume no header. Use fixed columns:
    // A=Massar, B=Nom, C=Prénom, D=Classe, E=Niveau
    colMap = { codeMassar: 0, lastName: 1, firstName: 2, classe: 3, niveau: 4 };
    headerRowIdx = -1;
  }

  const detectedHeaders = headerRowIdx >= 0
    ? raw[headerRowIdx].map((h) => String(h || ""))
    : ["Code Massar", "Nom", "Prénom", "Classe", "Niveau"];

  const dataRows = headerRowIdx >= 0 ? raw.slice(headerRowIdx + 1) : raw;
  const rows: ParsedStudentRow[] = [];

  for (const r of dataRows) {
    const codeMassar = String(r[colMap.codeMassar] ?? "").trim();
    if (!codeMassar) continue;
    // Skip if it doesn't look like a Massar code (typically contains letters+digits, length>=8)
    if (codeMassar.length < 4) continue;

    let firstName = colMap.firstName !== undefined ? String(r[colMap.firstName] ?? "").trim() : "";
    let lastName = colMap.lastName !== undefined ? String(r[colMap.lastName] ?? "").trim() : "";

    // Handle case where only one combined "Nom Prénom" column exists
    if (!firstName && !lastName && !colMap.firstNameAr && !colMap.lastNameAr) continue;
    if (!lastName && firstName.includes(" ")) {
      const parts = firstName.split(" ");
      lastName = parts[0];
      firstName = parts.slice(1).join(" ");
    }

    const firstNameAr = colMap.firstNameAr !== undefined ? String(r[colMap.firstNameAr] ?? "").trim() : "";
    const lastNameAr = colMap.lastNameAr !== undefined ? String(r[colMap.lastNameAr] ?? "").trim() : "";
    const parentPhone = colMap.parentPhone !== undefined ? String(r[colMap.parentPhone] ?? "").trim() : "";

    const classeCode = String(r[colMap.classe] ?? "").trim();
    const niveauCode = colMap.niveau !== undefined ? String(r[colMap.niveau] ?? "").trim() || undefined : undefined;

    rows.push({
      codeMassar,
      firstName: firstName || "",
      lastName: lastName || "",
      firstNameAr: firstNameAr || undefined,
      lastNameAr: lastNameAr || undefined,
      parentPhone: parentPhone || undefined,
      classeCode,
      niveauCode,
    });
  }

  return {
    rows,
    detectedHeaders,
    totalRows: rows.length,
  };
}
