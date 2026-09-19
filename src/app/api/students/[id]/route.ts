import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      classeId,
      groupId,
      codeMassar,
      firstNameAr,
      lastNameAr,
      parentPhone,
    } = body;
    const student = await db.student.update({
      where: { id },
      data: {
        ...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
        ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
        ...(classeId !== undefined ? { classeId } : {}),
        ...(groupId !== undefined ? { groupId: groupId || null } : {}),
        ...(codeMassar !== undefined ? { codeMassar: codeMassar.toUpperCase().trim() } : {}),
        ...(firstNameAr !== undefined ? { firstNameAr: firstNameAr || null } : {}),
        ...(lastNameAr !== undefined ? { lastNameAr: lastNameAr || null } : {}),
        ...(parentPhone !== undefined ? { parentPhone: parentPhone || null } : {}),
      },
      include: { classe: true, groupe: true },
    });
    return NextResponse.json({ student });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Code Massar déjà existant" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await db.student.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }
}
