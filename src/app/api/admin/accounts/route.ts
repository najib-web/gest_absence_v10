import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 4;
const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// GET /api/admin/accounts — liste des comptes Administrateurs + Surveillants (ADMIN uniquement)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const accounts = await db.user.findMany({
    where: { role: { in: ["ADMIN", "SURVEILLANT"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ accounts });
}

// POST /api/admin/accounts — créer un compte Surveillant (ou Administrateur)
// Body: { name, email, password, role? }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const name = (body?.name || "").trim();
    const email = (body?.email || "").toLowerCase().trim();
    const password = typeof body?.password === "string" ? body.password : "";
    const role = body?.role === "ADMIN" ? "ADMIN" : "SURVEILLANT";

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
      data: { name, email, password, role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
