import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, resolveEtablissementId } from "@/lib/auth";

// GET /api/orientations — list orientations / teacher reports
// Filters: status=PENDING|RESOLVED, source=TEACHER|SEUIL|MANUEL, teacherId, studentId
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const source = url.searchParams.get("source");
  const teacherId = url.searchParams.get("teacherId");
  const studentId = url.searchParams.get("studentId");

  // Isolation par établissement (via l'élève concerné)
  const etabId = await resolveEtablissementId(user);
  const orientations = await db.orientation.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(etabId ? { student: { etablissementId: etabId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { include: { classe: true, groupe: true } },
      teacher: { include: { user: { select: { name: true } } } },
      session: { select: { id: true, date: true, subject: true, subjectAr: true } },
    },
    take: 300,
  });

  // Per-student unjustified absence counts (for the report header / threshold context)
  const studentIds = [...new Set(orientations.map((o) => o.studentId))];
  const unjustifiedCounts = studentIds.length
    ? await db.absence.groupBy({
        by: ["studentId"],
        _count: { _all: true },
        where: { studentId: { in: studentIds }, status: "ABSENT", justified: false },
      })
    : [];
  const countsMap: Record<string, number> = {};
  for (const c of unjustifiedCounts) countsMap[c.studentId] = c._count._all;

  const thresholdRow = await db.setting.findUnique({ where: { key: "absenceThreshold" } });
  const threshold = thresholdRow ? parseInt(thresholdRow.value) : 3;

  return NextResponse.json({
    orientations: orientations.map((o) => ({
      ...o,
      unjustifiedAbsences: countsMap[o.studentId] ?? 0,
      threshold,
    })),
  });
}

// POST /api/orientations — create an orientation / teacher report
// Body: { studentId, title, content, source?, teacherId?, sessionId?, absenceId? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      studentId,
      title,
      content,
      source,
      sessionId,
      absenceId,
      style,
    } = body as {
      studentId: string;
      title: string;
      content: string;
      source?: string;
      sessionId?: string;
      absenceId?: string;
      style?: string;
    };

    if (!studentId || !content) {
      return NextResponse.json({ error: "Élève et contenu requis" }, { status: 400 });
    }

    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });

    // Role rules:
    // - ENSEIGNANT → source forcée à TEACHER, teacherId = son propre id
    // - SURVEILLANT → source TEACHER (rapport déposé en son nom) interdit ; SEUIL ou MANUEL
    let finalSource = source || (user.role === "ENSEIGNANT" ? "TEACHER" : "MANUEL");
    let teacherId: string | null = null;

    if (user.role === "ENSEIGNANT") {
      finalSource = "TEACHER";
      teacherId = user.teacherId ?? null;
      if (!teacherId) {
        return NextResponse.json({ error: "Profil enseignant introuvable" }, { status: 400 });
      }
    } else {
      if (finalSource === "TEACHER") {
        return NextResponse.json({ error: "Source invalide" }, { status: 400 });
      }
      teacherId = body.teacherId || null;
    }

    const thresholdRow = await db.setting.findUnique({ where: { key: "absenceThreshold" } });
    const threshold = thresholdRow ? parseInt(thresholdRow.value) : 3;

    // Signature : pour un rapport enseignant, on reprend la signature manuscrite
    // du profil enseignant (snapshot figé sur le rapport).
    let signatureSnapshot: string | null = body.signature ?? null;
    if (!signatureSnapshot && finalSource === "TEACHER" && teacherId) {
      const teacherRow = await db.teacher.findUnique({ where: { id: teacherId }, select: { signature: true } });
      signatureSnapshot = teacherRow?.signature ?? null;
    }

    const orientation = await db.orientation.create({
      data: {
        studentId,
        source: finalSource,
        teacherId,
        sessionId: sessionId || null,
        title: title || (finalSource === "TEACHER" ? "Rapport d'orientation" : "Orientation surveillant"),
        content,
        signature: signatureSnapshot,
        status: "PENDING",
        thresholdAtCreation: finalSource === "SEUIL" ? threshold : null,
        // Mise en forme choisie dans la palette d'édition (police, taille, G/I/S, couleur)
        ...(typeof style === "string" && style.length <= 600 ? { styleJson: style } : {}),
      },
      include: {
        student: { include: { classe: true, groupe: true } },
        teacher: { include: { user: { select: { name: true } } } },
        session: { select: { id: true, date: true, subject: true } },
      },
    });

    // Optionally flag the related absence as oriented (visible to the teacher)
    if (absenceId) {
      await db.absence.updateMany({
        where: { id: absenceId, studentId },
        data: { oriented: true },
      });
    }

    return NextResponse.json({ orientation });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
