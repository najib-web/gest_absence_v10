import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";

// ============================================================
// Administration centrale — gestion des établissements scolaires
// Accès : SUPERADMIN uniquement.
// Un établissement = AREF + DP + Nom (+ coordonnées) et son compte Directeur.
// Les surveillants, enseignants et élèves créés sous ce directeur héritent
// automatiquement de l'AREF et de la DP de l'établissement.
// ============================================================

const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || !isSuperAdmin(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const etablissements = await db.etablissement.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { users: true, teachers: true, students: true, classes: true } },
      users: {
        where: { role: "DIRECTEUR" },
        select: { id: true, email: true, name: true },
      },
    },
  });

  // Compteurs globaux pour les statistiques
  const [surveillants, enseignants, totalEleves, totalClasses] = await Promise.all([
    db.user.count({ where: { role: "SURVEILLANT" } }),
    db.teacher.count(),
    db.student.count(),
    db.classe.count(),
  ]);

  return NextResponse.json({
    etablissements: etablissements.map((e) => ({
      id: e.id,
      code: e.code,
      nameFr: e.nameFr,
      nameAr: e.nameAr,
      arefFr: e.arefFr,
      arefAr: e.arefAr,
      dpFr: e.dpFr,
      dpAr: e.dpAr,
      address: e.address,
      phone: e.phone,
      email: e.email,
      createdAt: e.createdAt,
      counts: {
        users: e._count.users,
        teachers: e._count.teachers,
        students: e._count.students,
        classes: e._count.classes,
      },
      directeurs: e.users,
    })),
    stats: { etablissements: etablissements.length, surveillants, enseignants, totalEleves, totalClasses },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isSuperAdmin(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      code,
      nameFr,
      nameAr,
      arefFr,
      arefAr,
      dpFr,
      dpAr,
      address,
      phone,
      email,
      directeur,
    } = body as {
      code?: string;
      nameFr?: string;
      nameAr?: string;
      arefFr?: string;
      arefAr?: string;
      dpFr?: string;
      dpAr?: string;
      address?: string;
      phone?: string;
      email?: string;
      directeur?: { name?: string; email?: string; password?: string };
    };

    if (!code?.trim() || !nameFr?.trim() || !nameAr?.trim() || !arefFr?.trim() || !arefAr?.trim() || !dpFr?.trim() || !dpAr?.trim()) {
      return NextResponse.json(
        { error: "Code, nom, AREF et Direction Provinciale (FR + AR) sont requis" },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();
    const existing = await db.etablissement.findUnique({ where: { code: normalizedCode } });
    if (existing) {
      return NextResponse.json({ error: "Ce code établissement existe déjà" }, { status: 409 });
    }

    // Compte directeur optionnel créé dans la même opération
    let dirEmail = directeur?.email?.toLowerCase().trim();
    if (dirEmail) {
      if (!emailValid(dirEmail)) {
        return NextResponse.json({ error: "Email du directeur invalide" }, { status: 400 });
      }
      const pwd = directeur?.password ?? "";
      if (pwd.length < 6) {
        return NextResponse.json(
          { error: "Le mot de passe du directeur doit contenir au moins 6 caractères" },
          { status: 400 }
        );
      }
      const taken = await db.user.findUnique({ where: { email: dirEmail } });
      if (taken) {
        return NextResponse.json({ error: "Cet email directeur est déjà utilisé" }, { status: 409 });
      }
    } else {
      dirEmail = undefined;
    }

    const etablissement = await db.etablissement.create({
      data: {
        code: normalizedCode,
        nameFr: nameFr.trim(),
        nameAr: nameAr.trim(),
        arefFr: arefFr.trim(),
        arefAr: arefAr.trim(),
        dpFr: dpFr.trim(),
        dpAr: dpAr.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        ...(dirEmail
          ? {
              users: {
                create: {
                  email: dirEmail,
                  name: directeur?.name?.trim() || "Le Directeur",
                  password: directeur!.password!,
                  role: "DIRECTEUR",
                },
              },
            }
          : {}),
      },
      include: {
        users: { where: { role: "DIRECTEUR" }, select: { id: true, email: true, name: true } },
        _count: { select: { users: true, teachers: true, students: true, classes: true } },
      },
    });

    return NextResponse.json({ etablissement }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
