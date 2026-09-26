import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";

// POST /api/admin/etablissements/[id]/directeur — affecter un compte Directeur
// à l'établissement (SUPERADMIN). Le directeur créé rattache automatiquement
// ses surveillants, enseignants et élèves à l'AREF et la DP de l'établissement.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isSuperAdmin(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const etablissement = await db.etablissement.findUnique({ where: { id } });
    if (!etablissement) {
      return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const name = (body?.name || "").trim() || "Le Directeur";
    const email = (body?.email || "").toLowerCase().trim();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }

    const account = await db.user.create({
      data: { name, email, password, role: "DIRECTEUR", etablissementId: id },
      select: { id: true, email: true, name: true, role: true, etablissementId: true },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT — réinitialiser le mot de passe d'un directeur de cet établissement
// Body: { userId, password }
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isSuperAdmin(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const { userId, password } = body as { userId?: string; password?: string };
    if (!userId || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }

    const target = await db.user.findFirst({
      where: { id: userId, role: "DIRECTEUR", etablissementId: id },
    });
    if (!target) {
      return NextResponse.json({ error: "Directeur introuvable pour cet établissement" }, { status: 404 });
    }

    await db.user.update({ where: { id: userId }, data: { password } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
