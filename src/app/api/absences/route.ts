import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/absences — list absences with filters
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const orientedOnly = url.searchParams.get("oriented") === "true";
  const justifiedOnly = url.searchParams.get("justified") === "true";
  const unjustifiedOnly = url.searchParams.get("unjustified") === "true";
  const classeId = url.searchParams.get("classeId");
  const studentId = url.searchParams.get("studentId");
  const codeMassar = url.searchParams.get("codeMassar");
  const teacherId = url.searchParams.get("teacherId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const absences = await db.absence.findMany({
    where: {
      ...(orientedOnly ? { oriented: true } : {}),
      ...(justifiedOnly ? { justified: true } : {}),
      ...(unjustifiedOnly ? { justified: false } : {}),
      ...(studentId ? { studentId } : {}),
      ...(codeMassar ? { student: { codeMassar: codeMassar.trim().toUpperCase() } } : {}),
      ...(classeId || teacherId || from || to
        ? {
            session: {
              ...(classeId ? { classeId } : {}),
              ...(teacherId ? { teacherId } : {}),
              ...(from || to
                ? {
                    date: {
                      ...(from ? { gte: new Date(from) } : {}),
                      ...(to ? { lte: new Date(to + "T23:59:59.999")} : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student: { include: { classe: true, groupe: true } },
      session: { include: { teacher: true, classe: true } },
    },
    take: 1000,
  });

  return NextResponse.json({ absences });
}

// POST /api/absences — bulk mark absences for a session
// Body: { sessionId, entries: [{ studentId, status, reason? }] }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await req.json();
    const { sessionId, entries } = body as {
      sessionId: string;
      entries: Array<{ studentId: string; status: "ABSENT" | "RETARD" | "PRESENT"; reason?: string; oriented?: boolean }>;
    };

    if (!sessionId || !Array.isArray(entries)) {
      return NextResponse.json({ error: "sessionId et entries requis" }, { status: 400 });
    }

    const session = await db.session.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });

    // Authorization: teacher can only mark their own sessions; surveillant can do any
    if (user.role === "ENSEIGNANT" && session.teacherId !== user.teacherId) {
      return NextResponse.json({ error: "Vous ne pouvez marquer que vos propres séances" }, { status: 403 });
    }

    // Delete existing absences for this session (replace mode)
    await db.absence.deleteMany({ where: { sessionId } });

    // Insert new ones (skip PRESENT entries — we only record ABSENT/RETARD)
    const toCreate = entries.filter((e) => e.status !== "PRESENT");
    if (toCreate.length > 0) {
      await db.absence.createMany({
        data: toCreate.map((e) => ({
          studentId: e.studentId,
          sessionId,
          status: e.status,
          reason: e.reason || null,
          oriented: e.oriented ?? false,
          justified: false,
        })),
      });
    }

    // L'appel est fait (même « tout présent ») → désactive les rappels
    // sonores enseignant et les notifications surveillant pour cette séance.
    await db.session.update({
      where: { id: sessionId },
      data: { attendanceDone: true, attendanceAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      marked: toCreate.length,
      present: entries.length - toCreate.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
