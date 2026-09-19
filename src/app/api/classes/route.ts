import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff, resolveEtablissementId } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const withCounts = url.searchParams.get("withCounts") === "true";

  // Isolation par établissement
  const etabId = await resolveEtablissementId(user);
  const classes = await db.classe.findMany({
    where: etabId ? { etablissementId: etabId } : {},
    orderBy: { code: "asc" },
    include: {
      niveau: true,
      groups: { orderBy: { code: "asc" } },
      _count: withCounts ? { select: { students: true } } : undefined,
    },
  });
  return NextResponse.json({ classes });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  // Héritage : la classe créée est rattachée à l'établissement du staff (AREF + DP)
  const etabId = await resolveEtablissementId(user);
  try {
    const body = await req.json();
    const { code, labelFr, labelAr, niveauId, capacity } = body;
    if (!code || !labelFr || !labelAr || !niveauId) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    const classe = await db.classe.create({
      data: {
        code: code.toUpperCase(),
        labelFr,
        labelAr,
        niveauId,
        capacity: capacity ?? 40,
        ...(etabId ? { etablissementId: etabId } : {}),
      },
      include: { niveau: true, groups: true },
    });
    return NextResponse.json({ classe });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Code classe déjà existant" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
