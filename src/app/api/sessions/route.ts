import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, resolveEtablissementId } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const teacherId = url.searchParams.get("teacherId");
  const classeId = url.searchParams.get("classeId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Isolation par établissement (via l'enseignant de la séance)
  const etabId = await resolveEtablissementId(user);
  const sessions = await db.session.findMany({
    where: {
      ...(teacherId ? { teacherId } : {}),
      ...(classeId ? { classeId } : {}),
      ...(etabId ? { teacher: { etablissementId: etabId } } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "desc" },
    include: {
      teacher: true,
      classe: true,
      groupe: true,
      service: true,
      _count: { select: { absences: true } },
    },
  });
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  try {
    const body = await req.json();
    const { teacherId, classeId, groupId, serviceId, date, subject, subjectAr, dedupeFrom } = body;
    if (!teacherId || !classeId || !date || !subject) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    // If teacher is creating, force their own teacherId
    const finalTeacherId = user.role === "ENSEIGNANT" && user.teacherId
      ? user.teacherId
      : teacherId;

    // Dedupe: when opening the roll call from the weekly grid, reuse the session
    // already created today for the same slot (teacher + classe + group + subject)
    if (dedupeFrom) {
      const fromDate = new Date(dedupeFrom);
      const existing = await db.session.findFirst({
        where: {
          teacherId: finalTeacherId,
          classeId,
          groupId: groupId || null,
          subject,
          date: { gte: fromDate },
        },
        orderBy: { date: "desc" },
        include: { teacher: true, classe: true, groupe: true },
      });
      if (existing) return NextResponse.json({ session: existing, existing: true });
    }

    const session = await db.session.create({
      data: {
        teacherId: finalTeacherId,
        classeId,
        groupId: groupId || null,
        serviceId: serviceId || null,
        date: new Date(date),
        subject,
        subjectAr: subjectAr || null,
      },
      include: { teacher: true, classe: true, groupe: true },
    });
    return NextResponse.json({ session });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
