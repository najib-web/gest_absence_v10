import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  // Établissement de rattachement (AREF + DP) — utilisé notamment pour
  // l'en-tête officiel des rapports (AREF + DP + Nom de l'établissement).
  const etablissementId = user.etablissementId
    ? user.etablissementId
    : user.role === "SUPERADMIN"
      ? null
      : (
          await db.user.findUnique({
            where: { id: user.id },
            select: { etablissementId: true },
          })
        )?.etablissementId ?? null;

  const etablissement = etablissementId
    ? await db.etablissement.findUnique({
        where: { id: etablissementId },
        select: {
          id: true,
          code: true,
          nameFr: true,
          nameAr: true,
          arefFr: true,
          arefAr: true,
          dpFr: true,
          dpAr: true,
        },
      })
    : null;

  return NextResponse.json({ user: { ...user, etablissementId, etablissement } });
}
