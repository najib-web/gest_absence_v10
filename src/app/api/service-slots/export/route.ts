import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import * as XLSX from "xlsx";
import { HOUR_SLOTS, DAY_NAMES, minutesToLabel } from "@/lib/schedule";
import { buildServiceCellText } from "@/lib/excel";

/**
 * Export the "Grille Horaire" as an Excel table that mirrors the UI weekly grid:
 *  - header row: Créneau | Lundi … Samedi (localized with ?lang=fr|ar)
 *  - one row per hour from 08:00-09:00 to 17:00-18:00
 *  - each cell: "Classe | Groupe | Enseignant | Matière" (Groupe optional)
 *  - a 2h séance is merged vertically over its two hour rows
 *  - several séances sharing a cell are separated by a dashes-only line (---)
 * The file is re-importable via the "Importer les Tableaux de Services" feature,
 * which also re-creates/updates the per-teacher Tables de Service automatically.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return new Response(JSON.stringify({ error: "Accès refusé" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lang = req.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "fr";

  const H = {
    fr: {
      creneau: "Créneau",
      fileName: "grille horaire.xlsx",
      sheet: "Grille",
    },
    ar: {
      creneau: "التوقيت",
      fileName: "الجدول الأسبوعي.xlsx",
      sheet: "الجدول",
    },
  }[lang];

  const slots = await db.serviceSlot.findMany({
    include: { teacher: true, classe: true, groupe: true },
  });

  // --- Place each séance in the grid: col = day (1..6), row = hour index from 08:00
  interface Placed {
    day: number;
    row: number; // 0-based hour row (0 = 08:00-09:00)
    hours: number;
    text: string;
    key: string; // identity for occupancy comparison
  }

  const placed: Placed[] = slots.map((s) => {
    const row = Math.round((s.startMin - 8 * 60) / 60);
    const hours = Math.max(1, Math.round((s.endMin - s.startMin) / 60));
    // In AR mode, prefer the teacher's Arabic name when available (re-importable:
    // the import resolves Arabic names as well as Latin ones and the PPR)
    const teacherName =
      lang === "ar" && (s.teacher.lastNameAr || s.teacher.firstNameAr)
        ? `${s.teacher.lastNameAr ?? ""} ${s.teacher.firstNameAr ?? ""}`.trim()
        : `${s.teacher.lastName} ${s.teacher.firstName}`;
    const text = buildServiceCellText({
      classe: s.classe.code,
      groupe: s.groupe?.code ?? null,
      teacher: teacherName,
      matiere: lang === "ar" ? (s.subjectAr || s.subject) : s.subject,
    });
    return { day: s.dayOfWeek, row, hours, text, key: s.id };
  });

  // Occupancy per (day, hour row) — used to decide whether a 2h merge is safe
  const occupancy = new Map<string, Placed[]>();
  for (const p of placed) {
    for (let i = 0; i < p.hours; i++) {
      const k = `${p.day}|${p.row + i}`;
      if (!occupancy.has(k)) occupancy.set(k, []);
      occupancy.get(k)!.push(p);
    }
  }

  // Build the AOA: header + 10 hour rows × (time column + 6 day columns)
  const header = [H.creneau, ...DAY_NAMES.map((d) => d[lang as "fr" | "ar"])];
  const aoa: string[][] = [
    header,
    ...HOUR_SLOTS.map((h) => [
      `${minutesToLabel(h.startMin)} - ${minutesToLabel(h.endMin)}`,
      "",
      "",
      "",
      "",
      "",
      "",
    ]),
  ];

  // Fill cells: sessions starting at (day, hour) — joined with "---" when several share the cell
  const startMap = new Map<string, Placed[]>();
  for (const p of placed) {
    const k = `${p.day}|${p.row}`;
    if (!startMap.has(k)) startMap.set(k, []);
    startMap.get(k)!.push(p);
  }
  for (const [k, list] of startMap) {
    const [day, rowStr] = k.split("|");
    const row = parseInt(rowStr, 10);
    if (row < 0 || row >= HOUR_SLOTS.length) continue; // out of the 08:00-18:00 range
    aoa[row + 1][day] = list.map((p) => p.text).join("\n---\n");
  }

  // Vertical merges for 2h séances that are the sole occupant of both their hour rows
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  for (const p of placed) {
    if (p.hours < 2) continue;
    const r0 = p.row + 1; // +1 for the header row
    if (r0 + 1 >= aoa.length) continue;
    const sole =
      (occupancy.get(`${p.day}|${p.row}`) ?? []).length === 1 &&
      (occupancy.get(`${p.day}|${p.row + 1}`) ?? []).every((x) => x.key === p.key);
    if (sole) {
      merges.push({ s: { r: r0, c: p.day }, e: { r: r0 + 1, c: p.day } });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [{ wch: 16 }, ...Array.from({ length: 6 }, () => ({ wch: 30 }))];
  if (lang === "ar") {
    (ws as unknown as { "!views": unknown[] })["!views"] = [{ RTL: true }];
  }
  XLSX.utils.book_append_sheet(wb, ws, H.sheet);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // RFC 5987 encoding so the Arabic filename survives the headers
  const encodedName = encodeURIComponent(H.fileName);

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="grille-horaire-${lang}.xlsx"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
