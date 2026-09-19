import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff, resolveEtablissementId } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Isolation par établissement : chaque directeur ne voit que son personnel
  const etabId = await resolveEtablissementId(user);
  const teachers = await db.teacher.findMany({
    where: etabId ? { etablissementId: etabId } : {},
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      user: { select: { email: true, name: true } },
      services: { include: { classe: true, groupe: true } },
      _count: { select: { sessions: true } },
    },
  });
  return NextResponse.json({ teachers });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // Héritage : l'enseignant créé est rattaché à l'établissement du staff (AREF + DP)
  const etabId = await resolveEtablissementId(user);
  try {
    const body = await req.json();
    const { firstName, lastName, matiere, matiereAr, email, password, ppr, firstNameAr, lastNameAr, phone } = body;
    if (!firstName || !lastName || !matiere || !email || !password) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    // Create user account + teacher profile
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
    }
    const newUser = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: `${firstName} ${lastName}`,
        password,
        role: "ENSEIGNANT",
        ...(etabId ? { etablissementId: etabId } : {}),
      },
    });
    const teacher = await db.teacher.create({
      data: {
        userId: newUser.id,
        firstName,
        lastName,
        matiere,
        matiereAr: matiereAr || null,
        ppr: ppr || null,
        firstNameAr: firstNameAr || null,
        lastNameAr: lastNameAr || null,
        phone: phone || null,
        ...(etabId ? { etablissementId: etabId } : {}),
      },
      include: { user: { select: { email: true, name: true } } },
    });
    return NextResponse.json({ teacher });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
