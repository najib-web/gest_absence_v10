import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isSupervisor } from "@/lib/auth";

/**
 * Réinitialisation complète de la base de données ("reconstituer la base") :
 * - supprime toutes les données (absences, orientations, séances, table de service,
 *   élèves, enseignants, classes, groupes, niveaux, paramètres)
 * - conserve les comptes Surveillant pour ne pas verrouiller l'accès
 * L'import des fichiers modèles permet ensuite de remplir à nouveau la base.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isSupervisor(user)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const counts = {
      absences: 0,
      orientations: 0,
      sessions: 0,
      serviceSlots: 0,
      serviceTables: 0,
      students: 0,
      groups: 0,
      classes: 0,
      niveaux: 0,
      teachers: 0,
      settings: 0,
    };

    // Ordre de suppression respectant les clés étrangères
    counts.absences = (await db.absence.deleteMany({})).count;
    counts.orientations = (await db.orientation.deleteMany({})).count;
    counts.sessions = (await db.session.deleteMany({})).count;
    counts.serviceSlots = (await db.serviceSlot.deleteMany({})).count;
    counts.serviceTables = (await db.serviceTable.deleteMany({})).count;
    counts.students = (await db.student.deleteMany({})).count;
    counts.groups = (await db.groupe.deleteMany({})).count;
    counts.classes = (await db.classe.deleteMany({})).count;
    counts.niveaux = (await db.niveau.deleteMany({})).count;

    // Enseignants + leurs comptes utilisateur (le compte Surveillant est conservé)
    const teachers = await db.teacher.findMany({ select: { id: true, userId: true } });
    counts.teachers = teachers.length;
    await db.teacher.deleteMany({});
    await db.user.deleteMany({ where: { role: "ENSEIGNANT" } });

    // Paramètres (seuil d'absences → valeur par défaut)
    counts.settings = (await db.setting.deleteMany({})).count;

    return NextResponse.json({ success: true, counts });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Erreur lors de la réinitialisation : " + (e as Error).message },
      { status: 500 }
    );
  }
}

/** Statistiques de la base (affichées avant la réinitialisation) */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isSupervisor(user)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const [absences, orientations, students, groups, classes, niveaux, teachers, serviceSlots] = await Promise.all([
    db.absence.count(),
    db.orientation.count(),
    db.student.count(),
    db.groupe.count(),
    db.classe.count(),
    db.niveau.count(),
    db.teacher.count(),
    db.serviceSlot.count(),
  ]);
  return NextResponse.json({
    stats: { absences, orientations, students, groups, classes, niveaux, teachers, serviceSlots },
  });
}
