import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

// PATCH /api/orientations/[id] — resolve / reopen an orientation (surveillant only)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { status, resolutionNote } = body as { status?: string; resolutionNote?: string };

    const existing = await db.orientation.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    if (status && !["PENDING", "RESOLVED"].includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const orientation = await db.orientation.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        ...(status === "PENDING" ? { resolvedAt: null } : {}),
        ...(resolutionNote !== undefined ? { resolutionNote } : {}),
      },
      include: {
        student: { include: { classe: true, groupe: true } },
        teacher: { include: { user: { select: { name: true } } } },
        session: { select: { id: true, date: true, subject: true } },
      },
    });

    return NextResponse.json({ orientation });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/orientations/[id] — remove an orientation (surveillant only)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    await db.orientation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
