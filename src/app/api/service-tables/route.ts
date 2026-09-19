import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const teacherId = url.searchParams.get("teacherId");

  const services = await db.serviceTable.findMany({
    where: teacherId ? { teacherId } : {},
    orderBy: [{ teacher: { lastName: "asc" } }, { classe: { code: "asc" } }],
    include: {
      teacher: { include: { user: { select: { name: true } } } },
      classe: { include: { niveau: true } },
      groupe: true,
      _count: { select: { sessions: true } },
    },
  });
  return NextResponse.json({ services });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { teacherId, classeId, groupId, subject, subjectAr, hoursPerWeek } = body;
    if (!teacherId || !classeId || !subject) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    const service = await db.serviceTable.create({
      data: {
        teacherId,
        classeId,
        groupId: groupId || null,
        subject,
        subjectAr: subjectAr || null,
        hoursPerWeek: hoursPerWeek ?? 2,
      },
      include: {
        teacher: true,
        classe: true,
        groupe: true,
      },
    });
    return NextResponse.json({ service });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Cette affectation existe déjà" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
