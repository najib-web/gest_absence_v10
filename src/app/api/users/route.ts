import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, resolveEtablissementId } from "@/lib/auth";

// GET /api/users — liste des comptes (Directeur uniquement)
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "DIRECTEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const etabId = await resolveEtablissementId(user);
  const users = await db.user.findMany({
    where: {
      role: { not: "SUPERADMIN" },
      ...(etabId ? { etablissementId: etabId } : {}),
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      teacher: { select: { id: true, matiere: true, ppr: true } },
    },
  });
  return NextResponse.json({ users });
}

// POST /api/users — créer un compte (Directeur uniquement)
// Body: { email, name, password, role: "SURVEILLANT" | "ENSEIGNANT", firstName?, lastName?, matiere? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "DIRECTEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // Héritage : le compte créé est rattaché à l'établissement du directeur (AREF + DP)
  const etabId = await resolveEtablissementId(user);

  try {
    const body = await req.json();
    const { email, name, password, role, firstName, lastName, matiere } = body as {
      email: string;
      name?: string;
      password: string;
      role: string;
      firstName?: string;
      lastName?: string;
      matiere?: string;
    };

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    if (!["SURVEILLANT", "ENSEIGNANT"].includes(role)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
    }

    const displayName =
      name?.trim() ||
      [lastName, firstName].filter(Boolean).join(" ") ||
      normalizedEmail.split("@")[0];

    const created = await db.user.create({
      data: {
        email: normalizedEmail,
        name: displayName,
        password,
        role,
        ...(etabId ? { etablissementId: etabId } : {}),
        ...(role === "ENSEIGNANT" && firstName && lastName
          ? {
              teacher: {
                create: {
                  firstName,
                  lastName,
                  matiere: matiere || "—",
                  ...(etabId ? { etablissementId: etabId } : {}),
                },
              },
            }
          : {}),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
