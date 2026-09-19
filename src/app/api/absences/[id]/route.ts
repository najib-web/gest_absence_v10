import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

// PATCH — update absence: justify, orient, set status
// Body: { justified?, oriented?, status?, reason? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  try {
    const body = await req.json();
    const { justified, oriented, status, reason } = body;

    const absence = await db.absence.findUnique({ where: { id } });
    if (!absence) return NextResponse.json({ error: "Absence introuvable" }, { status: 404 });

    const updated = await db.absence.update({
      where: { id },
      data: {
        ...(justified !== undefined ? { justified } : {}),
        ...(oriented !== undefined ? { oriented } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(reason !== undefined ? { reason } : {}),
      },
      include: {
        student: { include: { classe: true, groupe: true } },
        session: { include: { teacher: true, classe: true } },
      },
    });

    return NextResponse.json({ absence: updated });
  } catch (e) {
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
    await db.absence.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }
}
