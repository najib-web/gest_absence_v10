import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff, resolveEtablissementId } from "@/lib/auth";
import { isValidTimeSlot } from "@/lib/schedule";

// GET /api/service-slots — weekly schedule grid entries
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const teacherId = url.searchParams.get("teacherId");
  const dayOfWeek = url.searchParams.get("dayOfWeek");

  // Isolation par établissement (via l'enseignant du créneau)
  const etabId = await resolveEtablissementId(user);
  const slots = await db.serviceSlot.findMany({
    where: {
      ...(teacherId ? { teacherId } : {}),
      ...(dayOfWeek ? { dayOfWeek: parseInt(dayOfWeek) } : {}),
      ...(etabId ? { teacher: { etablissementId: etabId } } : {}),
    },
    orderBy: [{ dayOfWeek: "asc" }, { startMin: "asc" }],
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      classe: { include: { niveau: true } },
      groupe: true,
    },
  });
  return NextResponse.json({ slots });
}

// POST /api/service-slots — create a schedule cell (surveillant only)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { teacherId, dayOfWeek, startMin, endMin, classeId, groupId, subject, subjectAr } = body;

    const dow = parseInt(dayOfWeek);
    const start = parseInt(startMin);
    const end = parseInt(endMin);

    if (!teacherId || !classeId || !subject || isNaN(dow) || isNaN(start) || isNaN(end)) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    // Validations: day 1..6 (Lundi..Samedi), hours within 8h-18h, durée 1h ou 2h
    if (dow < 1 || dow > 6) {
      return NextResponse.json({ error: "Jour invalide (Lundi à Samedi)" }, { status: 400 });
    }
    if (!isValidTimeSlot(start, end)) {
      return NextResponse.json(
        { error: "Créneau invalide : durée de 1h ou 2h, entre 08:00 et 18:00" },
        { status: 400 }
      );
    }

    // Conflict 1: teacher already booked on an overlapping slot that day
    const teacherSameDay = await db.serviceSlot.findMany({
      where: { teacherId, dayOfWeek: dow },
    });
    const teacherConflict = teacherSameDay.find((s) => start < s.endMin && end > s.startMin);
    if (teacherConflict) {
      return NextResponse.json(
        { error: "Conflit : cet enseignant a déjà une séance sur ce créneau" },
        { status: 409 }
      );
    }

    // Conflict 2: same classe+group already booked that day on this slot
    const classSameDay = await db.serviceSlot.findMany({
      where: { classeId, dayOfWeek: dow, ...(groupId ? { groupId } : { groupId: null }) },
    });
    const classConflict = classSameDay.find((s) => start < s.endMin && end > s.startMin);
    if (classConflict) {
      return NextResponse.json(
        { error: "Conflit : cette classe / ce groupe a déjà une séance sur ce créneau" },
        { status: 409 }
      );
    }

    const slot = await db.serviceSlot.create({
      data: {
        teacherId,
        dayOfWeek: dow,
        startMin: start,
        endMin: end,
        classeId,
        groupId: groupId || null,
        subject,
        subjectAr: subjectAr || null,
      },
      include: {
        teacher: true,
        classe: true,
        groupe: true,
      },
    });
    return NextResponse.json({ slot });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Cette séance existe déjà dans la grille" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
