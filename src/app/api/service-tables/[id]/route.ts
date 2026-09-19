import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const { teacherId, classeId, groupId, subject, subjectAr, hoursPerWeek } = body;
    const service = await db.serviceTable.update({
      where: { id },
      data: {
        ...(teacherId !== undefined ? { teacherId } : {}),
        ...(classeId !== undefined ? { classeId } : {}),
        ...(groupId !== undefined ? { groupId: groupId || null } : {}),
        ...(subject !== undefined ? { subject } : {}),
        ...(subjectAr !== undefined ? { subjectAr: subjectAr || null } : {}),
        ...(hoursPerWeek !== undefined
          ? { hoursPerWeek: Math.max(1, Math.min(20, parseInt(hoursPerWeek) || 2)) }
          : {}),
      },
      include: { teacher: true, classe: true, groupe: true },
    });
    return NextResponse.json({ service });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Cette table de service existe déjà" }, { status: 409 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Table de service introuvable" }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await db.serviceTable.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }
}
