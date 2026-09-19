import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";

// PATCH /api/admin/etablissements/[id] — modifier un établissement (SUPERADMIN)
// DELETE — supprimer un établissement vide uniquement (aucun rattachement)
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isSuperAdmin(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const { code, nameFr, nameAr, arefFr, arefAr, dpFr, dpAr, address, phone, email } = body as Record<string, string | undefined>;

    if (!nameFr?.trim() || !nameAr?.trim() || !arefFr?.trim() || !arefAr?.trim() || !dpFr?.trim() || !dpAr?.trim()) {
      return NextResponse.json(
        { error: "Nom, AREF et Direction Provinciale (FR + AR) sont requis" },
        { status: 400 }
      );
    }

    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode) {
        const clash = await db.etablissement.findFirst({
          where: { code: normalizedCode, id: { not: id } },
        });
        if (clash) {
          return NextResponse.json({ error: "Ce code établissement existe déjà" }, { status: 409 });
        }
      }
    }

    const etablissement = await db.etablissement.update({
      where: { id },
      data: {
        ...(code !== undefined && code.trim() ? { code: code.trim().toUpperCase() } : {}),
        nameFr: nameFr.trim(),
        nameAr: nameAr.trim(),
        arefFr: arefFr.trim(),
        arefAr: arefAr.trim(),
        dpFr: dpFr.trim(),
        dpAr: dpAr.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
      },
      include: {
        users: { where: { role: "DIRECTEUR" }, select: { id: true, email: true, name: true } },
        _count: { select: { users: true, teachers: true, students: true, classes: true } },
      },
    });

    return NextResponse.json({ etablissement });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isSuperAdmin(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await ctx.params;

  try {
    const [users, teachers, students, classes] = await Promise.all([
      db.user.count({ where: { etablissementId: id } }),
      db.teacher.count({ where: { etablissementId: id } }),
      db.student.count({ where: { etablissementId: id } }),
      db.classe.count({ where: { etablissementId: id } }),
    ]);

    if (users + teachers + students + classes > 0) {
      return NextResponse.json(
        {
          error:
            `Suppression impossible : cet établissement rattache ${users} compte(s), ${teachers} enseignant(s), ${students} élève(s) et ${classes} classe(s).`,
        },
        { status: 409 }
      );
    }

    await db.etablissement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
