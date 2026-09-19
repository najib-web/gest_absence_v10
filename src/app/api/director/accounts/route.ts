import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, resolveEtablissementId } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 4;
const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const PUBLIC_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET /api/director/accounts — liste des comptes Directeur + Surveillants (DIRECTEUR uniquement)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "DIRECTEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const etabId = await resolveEtablissementId(user);
  const accounts = await db.user.findMany({
    where: {
      role: { in: ["DIRECTEUR", "SURVEILLANT"] },
      ...(etabId ? { etablissementId: etabId } : {}),
    },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: PUBLIC_FIELDS,
  });
  return NextResponse.json({ accounts });
}

// POST /api/director/accounts — créer un compte Surveillant (accès complet)
// Body: { name, email, password }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "DIRECTEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // Héritage : le surveillant créé est rattaché à l'établissement du directeur (AREF + DP)
  const etabId = await resolveEtablissementId(user);
  try {
    const body = await req.json();
    const name = (body?.name || "").trim();
    const email = (body?.email || "").toLowerCase().trim();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!name) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    if (!emailValid(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères` },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }

    const account = await db.user.create({
      data: { name, email, password, role: "SURVEILLANT", ...(etabId ? { etablissementId: etabId } : {}) },
      select: PUBLIC_FIELDS,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
