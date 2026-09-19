import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { code, labelFr, labelAr, classeId } = body;
    if (!code || !labelFr || !labelAr || !classeId) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    const group = await db.groupe.create({
      data: {
        code: code.toUpperCase(),
        labelFr,
        labelAr,
        classeId,
      },
    });
    return NextResponse.json({ group });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Groupe déjà existant dans cette classe" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    await db.groupe.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }
}
