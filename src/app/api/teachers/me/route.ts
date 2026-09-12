import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PATCH /api/teachers/me — l'enseignant met à jour son propre profil :
// signature manuscrite (data URL), numéro PPR, téléphone, nom en arabe.
// Body: { signature?, ppr?, phone?, firstNameAr?, lastNameAr? }
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "ENSEIGNANT" || !user.teacherId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { signature, ppr, phone, firstNameAr, lastNameAr } = body as {
      signature?: string | null;
      ppr?: string;
      phone?: string;
      firstNameAr?: string;
      lastNameAr?: string;
    };

    if (signature && !signature.startsWith("data:image/")) {
      return NextResponse.json({ error: "Format de signature invalide" }, { status: 400 });
    }
    if (signature && signature.length > 400_000) {
      return NextResponse.json({ error: "Signature trop volumineuse" }, { status: 413 });
    }

    const updated = await db.teacher.update({
      where: { id: user.teacherId },
      data: {
        ...(signature !== undefined ? { signature: signature || null } : {}),
        ...(ppr !== undefined ? { ppr: ppr || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(firstNameAr !== undefined ? { firstNameAr: firstNameAr || null } : {}),
        ...(lastNameAr !== undefined ? { lastNameAr: lastNameAr || null } : {}),
      },
      select: { id: true, signature: true, ppr: true, phone: true },
    });
    return NextResponse.json({ teacher: updated });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/teachers/me — profil de l'enseignant connecté
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "ENSEIGNANT" || !user.teacherId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const teacher = await db.teacher.findUnique({
    where: { id: user.teacherId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      firstNameAr: true,
      lastNameAr: true,
      phone: true,
      ppr: true,
      signature: true,
      matiere: true,
      matiereAr: true,
      user: { select: { email: true } },
    },
  });
  return NextResponse.json({ teacher });
}
