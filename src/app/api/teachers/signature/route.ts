import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const MAX_SIGNATURE_LENGTH = 200_000; // ~200 Ko en data URL — largement suffisant pour un PNG de signature

// GET /api/teachers/signature — signature enregistrée de l'enseignant connecté
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!user.teacherId) {
    return NextResponse.json({ signature: null });
  }
  const teacher = await db.teacher.findUnique({
    where: { id: user.teacherId },
    select: { signature: true },
  });
  return NextResponse.json({ signature: teacher?.signature ?? null });
}

// POST /api/teachers/signature — enregistrer / effacer la signature par défaut de l'enseignant
// Body: { signature: string | null }  (data URL PNG)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (user.role !== "ENSEIGNANT" || !user.teacherId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const signature = typeof body?.signature === "string" ? body.signature : null;

    if (signature && !signature.startsWith("data:image/")) {
      return NextResponse.json({ error: "Format de signature invalide" }, { status: 400 });
    }
    if (signature && signature.length > MAX_SIGNATURE_LENGTH) {
      return NextResponse.json({ error: "Signature trop volumineuse" }, { status: 413 });
    }

    await db.teacher.update({
      where: { id: user.teacherId },
      data: { signature: signature || null },
    });

    return NextResponse.json({ success: true, signature: signature || null });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
