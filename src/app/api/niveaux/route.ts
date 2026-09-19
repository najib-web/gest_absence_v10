import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const niveaux = await db.niveau.findMany({
    orderBy: { order: "asc" },
    include: { classes: { orderBy: { code: "asc" } } },
  });
  return NextResponse.json({ niveaux });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { code, labelFr, labelAr, order } = body;
    if (!code || !labelFr || !labelAr) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    const niveau = await db.niveau.create({
      data: {
        code: code.toUpperCase(),
        labelFr,
        labelAr,
        order: order ?? 0,
      },
    });
    return NextResponse.json({ niveau });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Code niveau déjà existant" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
