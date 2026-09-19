import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

const THRESHOLD_KEY = "absenceThreshold";
const DEFAULT_THRESHOLD = 3;

// GET /api/settings — read app settings (any authenticated user)
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const row = await db.setting.findUnique({ where: { key: THRESHOLD_KEY } });
  const value = row ? parseInt(row.value) : DEFAULT_THRESHOLD;
  return NextResponse.json({
    settings: {
      absenceThreshold: isNaN(value) ? DEFAULT_THRESHOLD : value,
    },
  });
}

// PUT /api/settings — update settings (surveillant only)
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { absenceThreshold } = body as { absenceThreshold?: number };

    if (absenceThreshold !== undefined) {
      const v = parseInt(String(absenceThreshold));
      if (isNaN(v) || v < 1 || v > 100) {
        return NextResponse.json(
          { error: "Seuil invalide (entre 1 et 100)" },
          { status: 400 }
        );
      }
      await db.setting.upsert({
        where: { key: THRESHOLD_KEY },
        update: { value: String(v) },
        create: { key: THRESHOLD_KEY, value: String(v) },
      });
    }

    const row = await db.setting.findUnique({ where: { key: THRESHOLD_KEY } });
    return NextResponse.json({
      settings: { absenceThreshold: row ? parseInt(row.value) : DEFAULT_THRESHOLD },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
