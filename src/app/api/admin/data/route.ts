import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff, resolveEtablissementId } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// ============================================================
// Gestion des données — vider une table ou les données de
// l'établissement. Accès : SURVEILLANT et DIRECTEUR uniquement.
//
// PÉRIMÈTRE ÉTABLISSEMENT : chaque opération (lecture des compteurs
// comme suppression) est strictement limitée aux données rattachées
// à l'établissement (AREF + DP) du compte connecté. Les données des
// autres établissements ne sont ni visibles ni supprimables ici.
// Les niveaux (référentiel partagé) et les comptes Surveillant /
// Directeur de l'établissement ne sont jamais touchés.
// ============================================================

// Tables vidables individuellement (référentiel "Niveaux" exclu :
// partagé entre tous les établissements, sa suppression casserait
// les classes des autres établissements).
const SCOPES = [
  "absences", // Absences enregistrées
  "orientations", // Rapports d'orientation
  "sessions", // Séances (appels enregistrés)
  "serviceSlots", // Grille horaire (créneaux hebdomadaires)
  "serviceTables", // Tables de service (affectations)
  "students", // Élèves
  "teachers", // Enseignants (+ leurs comptes utilisateur)
  "groups", // Groupes
  "classes", // Classes (cascade : groupes, élèves, séances…)
] as const;

type Scope = (typeof SCOPES)[number];

type DeletedCounts = Partial<Record<string, number>>;

// Filtres de rattachement à l'établissement — identiques pour la
// lecture des compteurs (GET) et les suppressions (POST), afin que
// l'interface affiche exactement ce qui sera supprimé.
const filters = {
  absences: (id: string): Prisma.AbsenceWhereInput => ({
    OR: [
      { student: { etablissementId: id } },
      { session: { teacher: { etablissementId: id } } },
    ],
  }),
  orientations: (id: string): Prisma.OrientationWhereInput => ({
    OR: [
      { student: { etablissementId: id } },
      { teacher: { etablissementId: id } },
    ],
  }),
  sessions: (id: string): Prisma.SessionWhereInput => ({
    OR: [
      { teacher: { etablissementId: id } },
      { classe: { etablissementId: id } },
    ],
  }),
  serviceSlots: (id: string): Prisma.ServiceSlotWhereInput => ({
    OR: [
      { teacher: { etablissementId: id } },
      { classe: { etablissementId: id } },
    ],
  }),
  serviceTables: (id: string): Prisma.ServiceTableWhereInput => ({
    OR: [
      { teacher: { etablissementId: id } },
      { classe: { etablissementId: id } },
    ],
  }),
  students: (id: string): Prisma.StudentWhereInput => ({ etablissementId: id }),
  teachers: (id: string): Prisma.TeacherWhereInput => ({ etablissementId: id }),
  teacherUsers: (id: string): Prisma.UserWhereInput => ({
    role: "ENSEIGNANT",
    etablissementId: id,
  }),
  groups: (id: string): Prisma.GroupeWhereInput => ({
    classe: { etablissementId: id },
  }),
  classes: (id: string): Prisma.ClasseWhereInput => ({ etablissementId: id }),
  dismissals: (id: string): Prisma.AttendanceDismissalWhereInput => ({
    OR: [
      { slot: { teacher: { etablissementId: id } } },
      { slot: { classe: { etablissementId: id } } },
    ],
  }),
};

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Périmètre : l'établissement du compte connecté.
  const etabId = await resolveEtablissementId(user);
  if (!etabId) {
    return NextResponse.json(
      { error: "Aucun établissement rattaché à votre compte" },
      { status: 400 }
    );
  }

  const [
    absences,
    orientations,
    sessions,
    serviceSlots,
    serviceTables,
    students,
    teachers,
    groups,
    classes,
    users,
    etablissement,
  ] = await Promise.all([
    db.absence.count({ where: filters.absences(etabId) }),
    db.orientation.count({ where: filters.orientations(etabId) }),
    db.session.count({ where: filters.sessions(etabId) }),
    db.serviceSlot.count({ where: filters.serviceSlots(etabId) }),
    db.serviceTable.count({ where: filters.serviceTables(etabId) }),
    db.student.count({ where: filters.students(etabId) }),
    db.teacher.count({ where: filters.teachers(etabId) }),
    db.groupe.count({ where: filters.groups(etabId) }),
    db.classe.count({ where: filters.classes(etabId) }),
    db.user.count({ where: { etablissementId: etabId } }),
    db.etablissement.findUnique({
      where: { id: etabId },
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
    }),
  ]);

  return NextResponse.json({
    etablissement,
    counts: {
      absences,
      orientations,
      sessions,
      serviceSlots,
      serviceTables,
      students,
      teachers,
      groups,
      classes,
      users,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Périmètre : l'établissement du compte connecté. Sans établissement
  // rattaché, aucune suppression n'est autorisée (garde-fou).
  const etabId = await resolveEtablissementId(user);
  if (!etabId) {
    return NextResponse.json(
      { error: "Aucun établissement rattaché à votre compte" },
      { status: 400 }
    );
  }

  let body: { scope?: string; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const scope = body.scope;
  if (!scope) {
    return NextResponse.json({ error: "Paramètre « scope » requis" }, { status: 400 });
  }

  // ---- Vider les données de l'établissement : double sécurité ----
  if (scope === "all") {
    if (body.confirm !== "VIDER") {
      return NextResponse.json(
        { error: "Confirmation invalide : tapez VIDER pour confirmer" },
        { status: 400 }
      );
    }
    try {
      const deleted = await purgeEtablissement(etabId);
      // Les comptes Surveillant / Directeur de l'établissement sont
      // conservés : pas de déconnexion, pas de recréation nécessaire.
      return NextResponse.json({ ok: true, scope: "all", deleted });
    } catch (e) {
      console.error("Erreur vidage données établissement:", e);
      return NextResponse.json(
        { error: "Erreur lors du vidage des données de l'établissement" },
        { status: 500 }
      );
    }
  }

  // ---- Vider une table précise ----
  if (!(SCOPES as readonly string[]).includes(scope)) {
    return NextResponse.json(
      {
        error:
          "Table inconnue — les niveaux (référentiel partagé) ne peuvent pas être vidés depuis un établissement",
      },
      { status: 400 }
    );
  }

  try {
    let deleted: DeletedCounts = {};
    switch (scope as Scope) {
      case "absences":
        deleted = {
          absences: (
            await db.absence.deleteMany({ where: filters.absences(etabId) })
          ).count,
        };
        break;
      case "orientations":
        deleted = {
          orientations: (
            await db.orientation.deleteMany({ where: filters.orientations(etabId) })
          ).count,
        };
        break;
      case "sessions":
        deleted = {
          sessions: (
            await db.session.deleteMany({ where: filters.sessions(etabId) })
          ).count,
        };
        break;
      case "serviceSlots":
        deleted = {
          serviceSlots: (
            await db.serviceSlot.deleteMany({ where: filters.serviceSlots(etabId) })
          ).count,
        };
        break;
      case "serviceTables":
        deleted = {
          serviceTables: (
            await db.serviceTable.deleteMany({ where: filters.serviceTables(etabId) })
          ).count,
        };
        break;
      case "students":
        deleted = {
          students: (
            await db.student.deleteMany({ where: filters.students(etabId) })
          ).count,
        };
        break;
      case "groups":
        deleted = {
          groups: (
            await db.groupe.deleteMany({ where: filters.groups(etabId) })
          ).count,
        };
        break;
      case "classes":
        deleted = {
          classes: (
            await db.classe.deleteMany({ where: filters.classes(etabId) })
          ).count,
        };
        break;
      case "teachers": {
        // Supprimer les comptes ENSEIGNANT de l'établissement supprime en
        // cascade leurs profils, tables de service, créneaux et séances.
        // Les comptes Surveillant / Directeur ne sont jamais touchés ici,
        // et les enseignants des autres établissements sont inaccessibles.
        const r = await db.user.deleteMany({ where: filters.teacherUsers(etabId) });
        // Sécurité : profils enseignant restants rattachés à l'établissement
        // (compte utilisateur déjà parti ou dans un autre établissement).
        const orphans = await db.teacher.deleteMany({
          where: filters.teachers(etabId),
        });
        deleted = { teachers: r.count + orphans.count };
        break;
      }
    }
    return NextResponse.json({ ok: true, scope, deleted });
  } catch (e) {
    console.error(`Erreur vidage table ${scope}:`, e);
    return NextResponse.json(
      { error: "Erreur lors du vidage de la table" },
      { status: 500 }
    );
  }
}

// ============================================================
// Purge des données d'un établissement — du plus dépendant au
// moins dépendant (ordre des clés étrangères). Ne touche JAMAIS :
// aux autres établissements, au référentiel des niveaux, aux comptes
// Surveillant / Directeur, aux réglages et à l'établissement lui-même.
// ============================================================
async function purgeEtablissement(etabId: string): Promise<DeletedCounts> {
  const counts: DeletedCounts = {};

  // 1. Absences (dépendent des élèves et des séances)
  counts.absences = (
    await db.absence.deleteMany({ where: filters.absences(etabId) })
  ).count;

  // 2. Rapports d'orientation (dépendent des élèves et des enseignants)
  counts.orientations = (
    await db.orientation.deleteMany({ where: filters.orientations(etabId) })
  ).count;

  // 3. Séances (dépendent des enseignants et des classes)
  counts.sessions = (
    await db.session.deleteMany({ where: filters.sessions(etabId) })
  ).count;

  // 4. Notifications d'appel non fait (dépendent des créneaux/enseignants)
  counts.dismissals = (
    await db.attendanceDismissal.deleteMany({ where: filters.dismissals(etabId) })
  ).count;

  // 5. Grille horaire (dépend des enseignants et des classes)
  counts.serviceSlots = (
    await db.serviceSlot.deleteMany({ where: filters.serviceSlots(etabId) })
  ).count;

  // 6. Tables de service (dépendent des enseignants et des classes)
  counts.serviceTables = (
    await db.serviceTable.deleteMany({ where: filters.serviceTables(etabId) })
  ).count;

  // 7. Élèves
  counts.students = (
    await db.student.deleteMany({ where: filters.students(etabId) })
  ).count;

  // 8. Comptes enseignants de l'établissement (cascade : profils,
  //    tables, créneaux et séances restants le cas échéant)
  const teacherUsers = await db.user.deleteMany({
    where: filters.teacherUsers(etabId),
  });
  // Profils enseignant restants (orphelins éventuels)
  const teachersLeft = await db.teacher.deleteMany({
    where: filters.teachers(etabId),
  });
  counts.teachers = teacherUsers.count + teachersLeft.count;

  // 9. Groupes (dépendent des classes)
  counts.groups = (
    await db.groupe.deleteMany({ where: filters.groups(etabId) })
  ).count;

  // 10. Classes (cascade sur les groupes/élèves restants le cas échéant)
  counts.classes = (
    await db.classe.deleteMany({ where: filters.classes(etabId) })
  ).count;

  return counts;
}
