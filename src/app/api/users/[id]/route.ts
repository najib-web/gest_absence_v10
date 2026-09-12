import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/users/[id] — modifier un compte
//  - Directeur : peut modifier n'importe quel compte (mot de passe, nom).
//  - Surveillant : peut réinitialiser le mot de passe des enseignants uniquement.
// Body: { password?, name? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const target = await db.user.findUnique({ where: { id }, include: { teacher: true } });
  if (!target) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  const isSelf = user.id === id;
  if (user.role === "SURVEILLANT") {
    // Le surveillant ne peut réinitialiser que le mot de passe des enseignants
    if (!isSelf && target.role !== "ENSEIGNANT") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  } else if (user.role !== "DIRECTEUR" && !isSelf) {
    // Chacun peut modifier son propre compte, sinon seul le Directeur le peut
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { password, name } = body as { password?: string; name?: string };

    if (password !== undefined && password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(password ? { password } : {}),
        ...(name ? { name } : {}),
      },
      select: { id: true, email: true, name: true, role: true },
    });
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/users/[id] — supprimer un compte (Directeur uniquement)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "DIRECTEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  if (id === user.id) {
    return NextResponse.json({ error: "Impossible de supprimer votre propre compte" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  await db.user.delete({ where: { id } }); // Teacher lié supprimé en cascade
  return NextResponse.json({ ok: true });
}
