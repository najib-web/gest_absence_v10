import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

// Mise à jour / suppression d'un enseignant par le surveillant ou le directeur.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      firstNameAr,
      lastNameAr,
      ppr,
      phone,
      matiere,
      matiereAr,
      email,
    } = body;

    const teacher = await db.teacher.findUnique({ where: { id }, include: { user: true } });
    if (!teacher) {
      return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
    }
    if (teacher.user.role !== "ENSEIGNANT") {
      return NextResponse.json({ error: "Ce compte n'est pas un enseignant" }, { status: 403 });
    }

    const updated = await db.teacher.update({
      where: { id },
      data: {
        ...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
        ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
        ...(firstNameAr !== undefined ? { firstNameAr: firstNameAr || null } : {}),
        ...(lastNameAr !== undefined ? { lastNameAr: lastNameAr || null } : {}),
        ...(ppr !== undefined ? { ppr: ppr || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(matiere !== undefined ? { matiere } : {}),
        ...(matiereAr !== undefined ? { matiereAr: matiereAr || null } : {}),
        // Nom affiché du compte synchronisé avec la fiche
        ...(firstName !== undefined || lastName !== undefined
          ? {
              user: {
                update: {
                  name: `${(lastName ?? teacher.lastName).trim()} ${(firstName ?? teacher.firstName).trim()}`.trim(),
                },
              },
            }
          : {}),
        ...(email !== undefined
          ? {
              user: {
                update: { email: email.toLowerCase().trim() },
              },
            }
          : {}),
      },
      include: { user: { select: { email: true, name: true } } },
    });
    return NextResponse.json({ teacher: updated });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
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
    const teacher = await db.teacher.findUnique({ where: { id }, include: { user: true } });
    if (!teacher) {
      return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
    }
    if (teacher.user.role !== "ENSEIGNANT") {
      return NextResponse.json({ error: "Ce compte n'est pas un enseignant" }, { status: 403 });
    }
    // La suppression du compte User entraîne celle du profil Teacher
    // (onDelete: Cascade) puis, en cascade, services/slots/séances/absences.
    await db.user.delete({ where: { id: teacher.userId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }
}
