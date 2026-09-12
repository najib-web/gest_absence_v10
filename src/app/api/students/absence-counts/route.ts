import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/students/absence-counts — per-student absence statistics vs threshold
// Query: ?classeId=... (optional)
// Returns every student with: totalAbsences (ABSENT), unjustifiedAbsences, lateCount,
// threshold, exceeded (unjustified >= threshold).
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const classeId = url.searchParams.get("classeId");

  const students = await db.student.findMany({
    where: classeId ? { classeId } : undefined,
    include: { classe: true, groupe: true },
    orderBy: [{ classeId: "asc" }, { lastName: "asc" }],
  });

  const [totalCounts, unjustifiedCounts, lateCounts] = await Promise.all([
    db.absence.groupBy({
      by: ["studentId"],
      _count: { _all: true },
      where: { status: "ABSENT" },
    }),
    db.absence.groupBy({
      by: ["studentId"],
      _count: { _all: true },
      where: { status: "ABSENT", justified: false },
    }),
    db.absence.groupBy({
      by: ["studentId"],
      _count: { _all: true },
      where: { status: "RETARD" },
    }),
  ]);

  const toMap = (rows: { studentId: string; _count: { _all: number } }[]) => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.studentId] = r._count._all;
    return m;
  };
  const totalMap = toMap(totalCounts);
  const unjustMap = toMap(unjustifiedCounts);
  const lateMap = toMap(lateCounts);

  const thresholdRow = await db.setting.findUnique({ where: { key: "absenceThreshold" } });
  const threshold = thresholdRow ? parseInt(thresholdRow.value) : 3;

  const rows = students.map((s) => {
    const totalAbsences = totalMap[s.id] ?? 0;
    const unjustifiedAbsences = unjustMap[s.id] ?? 0;
    return {
      id: s.id,
      codeMassar: s.codeMassar,
      firstName: s.firstName,
      lastName: s.lastName,
      firstNameAr: s.firstNameAr,
      lastNameAr: s.lastNameAr,
      parentPhone: s.parentPhone,
      classe: { id: s.classe.id, code: s.classe.code },
      groupe: s.groupe ? { id: s.groupe.id, code: s.groupe.code } : null,
      totalAbsences,
      unjustifiedAbsences,
      lateCount: lateMap[s.id] ?? 0,
      exceeded: unjustifiedAbsences > threshold,
      atLimit: unjustifiedAbsences === threshold,
    };
  });

  return NextResponse.json({ threshold, students: rows });
}
