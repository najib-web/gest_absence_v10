import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

// Suppression manuelle des notifications « appel non fait ».
// - GET  : liste des suppressions (le client filtre sur le jour local courant)
// - POST : le surveillant/directeur supprime la notification d'une occurrence
//          de séance (slot + jour) — ex : appel fait sur papier, enseignant
//          absent, séance annulée. La suppression automatique reste gérée
//          par Session.attendanceDone dès l'enregistrement de l'appel.

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const dismissals = await db.attendanceDismissal.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, slotId: true, dateKey: true, teacherId: true },
  });
  return NextResponse.json({ dismissals });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { slotId, dateKey } = body ?? {};
    if (!slotId || typeof slotId !== "string" || !dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }
    const slot = await db.serviceSlot.findUnique({ where: { id: slotId } });
    if (!slot) {
      return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    }
    const dismissal = await db.attendanceDismissal.upsert({
      where: { slotId_dateKey: { slotId, dateKey } },
      update: { dismissedById: user.id },
      create: {
        slotId,
        dateKey,
        teacherId: slot.teacherId,
        dismissedById: user.id,
      },
    });
    return NextResponse.json({ dismissal });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
