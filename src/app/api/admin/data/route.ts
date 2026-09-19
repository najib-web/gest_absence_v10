import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isStaff, resetDefaultAccountsFlag } from "@/lib/auth";

// ============================================================
// Gestion des données — vider une table ou la totalité de la base
// Accès : SURVEILLANT et DIRECTEUR uniquement.
// ============================================================

// Scopes disponibles (modèles Prisma pouvant être vidés individuellement)
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
  "niveaux", // Niveaux (cascade : classes et tout le contenu)
] as const;

type Scope = (typeof SCOPES)[number];

type DeletedCounts = Partial<Record<string, number>>;

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
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
    niveaux,
    users,
  ] = await Promise.all([
    db.absence.count(),
    db.orientation.count(),
    db.session.count(),
    db.serviceSlot.count(),
    db.serviceTable.count(),
    db.student.count(),
    db.teacher.count(),
    db.groupe.count(),
    db.classe.count(),
    db.niveau.count(),
    db.user.count(),
  ]);

  return NextResponse.json({
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
      niveaux,
      users,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
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

  // ---- Vider TOUTE la base : double sécurité (confirmation tapée) ----
  if (scope === "all") {
    if (body.confirm !== "VIDER") {
      return NextResponse.json(
        { error: "Confirmation invalide : tapez VIDER pour confirmer" },
        { status: 400 }
      );
    }
    try {
      // Compteurs avant suppression (pour le rapport renvoyé à l'UI)
      const [
        absences, orientations, sessions, serviceSlots, serviceTables,
        students, groups, classes, niveaux, teachers, users, settings,
      ] = await Promise.all([
        db.absence.count(), db.orientation.count(), db.session.count(),
        db.serviceSlot.count(), db.serviceTable.count(), db.student.count(),
        db.groupe.count(), db.classe.count(), db.niveau.count(),
        db.teacher.count(), db.user.count(), db.setting.count(),
      ]);

      // NB : les transactions interactives de Prisma ne passent pas à travers
      // PgBouncer (mode transaction, Neon poolé). Un TRUNCATE ... CASCADE est
      // une instruction unique : atomique en PostgreSQL, et gère les cascades.
      await db.$executeRawUnsafe(
        `TRUNCATE TABLE "Absence", "Orientation", "Session", "ServiceSlot",
         "ServiceTable", "Student", "Groupe", "Classe", "Niveau", "Teacher",
         "User", "Setting" CASCADE`
      );

      // Les comptes par défaut (directeur, surveillant) sont recréés
      // automatiquement au prochain login : on ré-arme ensureDefaultAccounts().
      resetDefaultAccountsFlag();
      return NextResponse.json({
        ok: true,
        scope: "all",
        deleted: {
          absences, orientations, sessions, serviceSlots, serviceTables,
          students, groups, classes, niveaux, teachers, users, settings,
        } as DeletedCounts,
      });
    } catch (e) {
      console.error("Erreur vidage base complète:", e);
      return NextResponse.json(
        { error: "Erreur lors du vidage de la base" },
        { status: 500 }
      );
    }
  }

  // ---- Vider une table précise ----
  if (!(SCOPES as readonly string[]).includes(scope)) {
    return NextResponse.json({ error: "Table inconnue" }, { status: 400 });
  }

  try {
    let deleted: DeletedCounts = {};
    switch (scope as Scope) {
      case "absences":
        deleted = { absences: (await db.absence.deleteMany({})).count };
        break;
      case "orientations":
        deleted = { orientations: (await db.orientation.deleteMany({})).count };
        break;
      case "sessions":
        deleted = { sessions: (await db.session.deleteMany({})).count };
        break;
      case "serviceSlots":
        deleted = { serviceSlots: (await db.serviceSlot.deleteMany({})).count };
        break;
      case "serviceTables":
        deleted = { serviceTables: (await db.serviceTable.deleteMany({})).count };
        break;
      case "students":
        deleted = { students: (await db.student.deleteMany({})).count };
        break;
      case "groups":
        deleted = { groups: (await db.groupe.deleteMany({})).count };
        break;
      case "classes":
        deleted = { classes: (await db.classe.deleteMany({})).count };
        break;
      case "niveaux":
        deleted = { niveaux: (await db.niveau.deleteMany({})).count };
        break;
      case "teachers": {
        // Supprimer les comptes ENSEIGNANT supprime en cascade les profils
        // enseignant, leurs tables de service, créneaux et séances.
        // Les comptes Surveillant / Directeur ne sont jamais touchés ici.
        const r = await db.user.deleteMany({ where: { role: "ENSEIGNANT" } });
        deleted = { teachers: r.count };
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
