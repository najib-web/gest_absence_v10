import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const url = new URL(req.url);
  const classeId = url.searchParams.get("classeId");
  const groupId = url.searchParams.get("groupId");
  const search = url.searchParams.get("search");

  const students = await db.student.findMany({
    where: {
      ...(classeId ? { classeId } : {}),
      ...(groupId ? { groupId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { codeMassar: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      classe: { include: { niveau: true } },
      groupe: true,
      absences: {
        select: { id: true, status: true, justified: true, oriented: true },
      },
    },
  });

  // Stats per student
  const enriched = students.map((s) => {
    const totalAbs = s.absences.filter((a) => a.status === "ABSENT").length;
    const totalLate = s.absences.filter((a) => a.status === "RETARD").length;
    const unjustified = s.absences.filter((a) => !a.justified && a.status !== "PRESENT").length;
    const oriented = s.absences.filter((a) => a.oriented).length;
    return { ...s, stats: { totalAbs, totalLate, unjustified, oriented } };
  });

  return NextResponse.json({ students: enriched });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { codeMassar, firstName, lastName, classeId, groupId, firstNameAr, lastNameAr, parentPhone } = body;
    if (!codeMassar || !firstName || !lastName || !classeId) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    const student = await db.student.create({
      data: {
        codeMassar: codeMassar.toUpperCase(),
        firstName,
        lastName,
        classeId,
        groupId: groupId || null,
        firstNameAr: firstNameAr || null,
        lastNameAr: lastNameAr || null,
        parentPhone: parentPhone || null,
      },
    });
    return NextResponse.json({ student });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Code Massar déjà existant" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
