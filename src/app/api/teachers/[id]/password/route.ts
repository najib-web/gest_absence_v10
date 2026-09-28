import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 4;

// PATCH /api/teachers/[id]/password
// Le surveillant définit/modifie le mot de passe d'authentification d'un enseignant.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password.trim()) {
      return NextResponse.json({ error: "Le mot de passe est requis" }, { status: 400 });
    }
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` },
        { status: 400 }
      );
    }

    const teacher = await db.teacher.findUnique({
      where: { id },
      select: { id: true, userId: true, user: { select: { role: true } } },
    });
    if (!teacher) {
      return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
    }
    if (teacher.user.role !== "ENSEIGNANT") {
      return NextResponse.json(
        { error: "Impossible de modifier le mot de passe de ce compte" },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: teacher.userId },
      data: { password: password.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
