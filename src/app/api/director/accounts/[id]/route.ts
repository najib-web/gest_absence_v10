import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 4;

// PATCH /api/director/accounts/[id] — modifier nom / email / mot de passe d'un compte
// Surveillant (ou du Directeur lui-même). Les comptes Enseignant ne sont pas concernés.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "DIRECTEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const target = await db.user.findUnique({ where: { id } });
    if (!target || (target.role !== "SURVEILLANT" && target.role !== "DIRECTEUR")) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }

    const data: { name?: string; email?: string; password?: string } = {};

    if (body?.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
      data.name = name;
    }
    if (body?.email !== undefined) {
      const email = String(body.email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Email invalide" }, { status: 400 });
      }
      const clash = await db.user.findFirst({ where: { email, id: { not: id } } });
      if (clash) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
      }
      data.email = email;
    }
    if (body?.password !== undefined) {
      const password = String(body.password);
      if (password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` },
          { status: 400 }
        );
      }
      data.password = password;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }

    const account = await db.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ account });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/director/accounts/[id] — supprimer un compte Surveillant.
// Les comptes Directeur (dont le sien) ne peuvent pas être supprimés.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "DIRECTEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    if (target.role !== "SURVEILLANT") {
      return NextResponse.json(
        { error: "Seuls les comptes Surveillant peuvent être supprimés" },
        { status: 400 }
      );
    }
    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }
}
